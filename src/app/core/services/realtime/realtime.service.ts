import { computed, DestroyRef, inject, Injectable, NgZone, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { filter, Observable, Subject } from 'rxjs';

import { environments } from '../../../../environments/environments';
import { ApiResponse } from '../../dtos/api.response';
import {
  REALTIME_ERROR_DISABLED,
  REALTIME_RECONNECTED,
  type RealtimeEvent,
  type RealtimeStatus,
  type RealtimeSubscribable,
  type RealtimeTicketDTO,
} from './realtime.types';

/** Give up and let the pollers carry it after this many consecutive failures. */
const FALLBACK_AFTER_ATTEMPTS = 3;
/** Flat retry once in `fallback`, so an outage self-heals without a reload. */
const FALLBACK_RETRY_MS = 60_000;
/** The feature is switched off server-side; re-check rarely, it needs a deploy. */
const DISABLED_RETRY_MS = 600_000;
/** Another tab took our slot. Retry rarely, so a closed tab eventually frees us. */
const SUPERSEDED_RETRY_MS = 420_000;
const MAX_BACKOFF_MS = 30_000;
/** Bounded dedupe window. A plain Set would grow for the tab's whole lifetime. */
const SEEN_LIMIT = 200;

/**
 * The realtime client: a ticketed SSE stream that replaces most polling.
 *
 * TWO-LEG DESIGN. The ticket is fetched from `${apiUrl}/notifications/realtime/ticket`,
 * i.e. THROUGH the gateway, so `includeBearerTokenInterceptor` attaches the
 * Keycloak token (its condition is `keycloak.urlPattern`, which matches `apiUrl`).
 * The stream is opened on `environments.realtimeUrl`, which deliberately does NOT
 * match that pattern — `EventSource` cannot send an Authorization header, which is
 * the whole reason the ticket exists.
 *
 * REALTIME NEVER REPLACES A POLLER, IT ONLY SPEEDS ONE UP. `live()` proves the
 * TCP stream is healthy; it cannot prove events are being published (a single
 * missing REALTIME_REDIS_URL in one service yields a perfectly healthy stream that
 * delivers nothing). So consumers slow their polling when live and never stop it.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly http = inject(HttpClient);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<RealtimeStatus>('idle');
  /** Read by pollers to choose a cadence — never to decide whether to run. */
  readonly live = computed(() => this.status() === 'live');

  private readonly events$ = new Subject<RealtimeEvent>();
  private source: EventSource | null = null;
  private minting = false;
  private attempts = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private readonly seen = new Set<string>();

  constructor() {
    // A hidden tab keeps its stream open on purpose: a 20s comment frame is
    // nearly free, the user expects a fresh badge the moment they come back, and
    // closing on hide would produce a re-mint storm when someone with eight tabs
    // alt-tabs. Reconnect on return only if we are NOT already live.
    document.addEventListener('visibilitychange', this.onWake);
    window.addEventListener('online', this.onWake);
    // Tell the server promptly instead of leaving it to a TCP timeout, so the
    // per-user connection slot is freed before the next tab opens one.
    window.addEventListener('beforeunload', this.onUnload);

    this.destroyRef.onDestroy(() => {
      this.stopped = true;
      document.removeEventListener('visibilitychange', this.onWake);
      window.removeEventListener('online', this.onWake);
      window.removeEventListener('beforeunload', this.onUnload);
      this.clearTimer();
      this.hardClose();
    });
  }

  /**
   * Open the stream. Idempotent and safe to call from anywhere.
   *
   * The guard is load-bearing: this is reachable from the notification store, the
   * retry timer, the `expiring` handler, the disabled re-check, `online` and
   * `visibilitychange`. Without it, waking a tab that is already live mints a
   * second ticket, opens a second EventSource and orphans the first — which is
   * never closed and holds a server slot until TCP notices.
   */
  connect(): void {
    if (this.stopped || this.source || this.minting) return;

    this.minting = true;
    if (this.status() === 'idle') this.status.set('connecting');

    // Raw http.post, NOT ServiceBase: a ticket must never be cached, and
    // ServiceBase's retry would replay a request whose ticket is already spent.
    this.http
      .post<
        ApiResponse<RealtimeTicketDTO>
      >(`${environments.apiUrl}/notifications/realtime/ticket`, {})
      .subscribe({
        next: (res) => {
          this.minting = false;
          if (res?.data?.ticket) this.open(res.data);
          else this.retry();
        },
        error: (err: HttpErrorResponse) => {
          this.minting = false;
          if (err.status === 503 && this.errorCodeOf(err) === REALTIME_ERROR_DISABLED) {
            // Deliberately off server-side. Stop hammering it; the pollers are
            // already carrying the app and a flip needs a deploy.
            this.status.set('fallback');
            this.schedule(DISABLED_RETRY_MS);
            return;
          }
          this.retry();
        },
      });
  }

  /**
   * Events for the given topics, plus the synthetic `realtime.reconnected`.
   *
   * Always handle `realtime.reconnected` by refetching: that is what makes a
   * dropped event harmless, and why no replay buffer is needed.
   *
   * The payload is a HINT. Use `topic`, `ref.id`, `scope.community_id` and
   * `hint.status` to decide WHAT to refetch — never render them.
   */
  on(...topics: RealtimeSubscribable[]): Observable<RealtimeEvent> {
    const wanted = new Set<RealtimeSubscribable>([...topics, REALTIME_RECONNECTED]);
    return this.events$.pipe(filter((event) => wanted.has(event.topic)));
  }

  private open(ticket: RealtimeTicketDTO): void {
    this.hardClose();
    // withCredentials deliberately unset: nothing here uses cookie auth, and the
    // response carries no CORS headers (same-origin), which is also what blocks a
    // cross-origin page from opening this stream.
    const source = new EventSource(
      `${environments.realtimeUrl}?t=${encodeURIComponent(ticket.ticket)}`,
    );
    this.source = source;

    source.addEventListener('ready', () =>
      this.zone.run(() => {
        this.attempts = 0;
        this.status.set('live');
        // One authoritative refetch per consumer, every time the stream comes up.
        this.emit({ topic: REALTIME_RECONNECTED } as RealtimeEvent);
      }),
    );

    // The broker died under a healthy socket. The server closes us; treat it as
    // a normal reconnect so we do not sit on a stream that delivers nothing.
    source.addEventListener('degraded', () => this.zone.run(() => this.retry()));

    // Another tab won our per-user slot. Do NOT reconnect immediately — two tabs
    // would evict each other forever. Retry slowly so that when the other tab
    // closes, this one recovers instead of staying dead for the session.
    source.addEventListener('superseded', () =>
      this.zone.run(() => {
        this.hardClose();
        this.status.set('fallback');
        this.schedule(SUPERSEDED_RETRY_MS);
      }),
    );

    // The server's absolute lifetime cap is about to fire. Re-mint at once so
    // there is no observable gap; this is also the revocation point, because a
    // new ticket means a fresh JWT check and a fresh read of roles.
    source.addEventListener('expiring', () =>
      this.zone.run(() => {
        this.hardClose();
        this.connect();
      }),
    );

    source.onmessage = (ev: MessageEvent<string>) =>
      this.zone.run(() => {
        let event: RealtimeEvent;
        try {
          event = JSON.parse(ev.data) as RealtimeEvent;
        } catch {
          return; // malformed frame: drop it, keep the Subject alive
        }
        if (event?.v !== 1 || !event.topic) return;
        if (this.seen.has(event.id)) return;
        this.remember(event.id);
        this.emit(event);
      });

    source.onerror = () => {
      // MANDATORY, and the single most important line in this file. EventSource
      // auto-reconnects to the SAME url — which holds an already-redeemed
      // single-use ticket — so leaving it alone is a 401 loop forever. Close
      // first, then mint a fresh ticket.
      this.hardClose();
      this.zone.run(() => this.retry());
    };
  }

  private hardClose(): void {
    this.source?.close();
    this.source = null;
  }

  private retry(): void {
    this.hardClose();
    this.attempts++;
    if (this.attempts >= FALLBACK_AFTER_ATTEMPTS) this.status.set('fallback');
    else this.status.set('connecting');

    const base =
      this.attempts >= FALLBACK_AFTER_ATTEMPTS
        ? FALLBACK_RETRY_MS
        : Math.min(MAX_BACKOFF_MS, 1_000 * 2 ** (this.attempts - 1));
    // Full jitter: without it, every tab of every user reconnects in lockstep
    // after an outage and the ticket endpoint takes the whole herd at once.
    this.schedule(base * (0.5 + Math.random() / 2));
  }

  private schedule(delayMs: number): void {
    this.clearTimer();
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.connect();
    }, delayMs);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private emit(event: RealtimeEvent): void {
    this.events$.next(event);
  }

  private remember(id: string): void {
    if (this.seen.size >= SEEN_LIMIT) {
      // Insertion-ordered, so the first key is the oldest.
      const oldest = this.seen.values().next().value;
      if (oldest !== undefined) this.seen.delete(oldest);
    }
    this.seen.add(id);
  }

  private errorCodeOf(err: HttpErrorResponse): number | undefined {
    const body = err.error as { error_code?: number } | null;
    return body?.error_code;
  }

  private readonly onWake = (): void => {
    if (document.hidden || this.status() === 'live') return;
    // A deliberate reset: coming back to the tab (or regaining network) is new
    // information, so start from a short backoff rather than the long one.
    this.attempts = 0;
    this.clearTimer();
    this.connect();
  };

  private readonly onUnload = (): void => {
    this.hardClose();
  };
}
