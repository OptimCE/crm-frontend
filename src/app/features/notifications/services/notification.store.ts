import { DestroyRef, inject, Injectable, Injector, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { EMPTY, fromEvent, merge, Subject, timer } from 'rxjs';
import { catchError, filter, switchMap } from 'rxjs';

import { ERROR_TYPE, VALIDATION_TYPE } from '../../../core/dtos/notification';
import { RealtimeService } from '../../../core/services/realtime/realtime.service';
import { REALTIME_TOPICS } from '../../../core/services/realtime/realtime.types';
import { SnackbarNotification } from '../../../shared/services-ui/snackbar.notifcation.service';
import { NotificationDTO } from '../dtos/notification.dto';
import { NotificationService } from './notification.service';

/** Poll cadence when realtime is NOT delivering. Unchanged from before SSE. */
const POLL_INTERVAL_MS = 30_000;
/**
 * Poll cadence while the realtime stream is live.
 *
 * The poll KEEPS RUNNING when live — it is a durability backstop, not a fallback.
 * SSE is at-most-once, and the bell has no "pending" state to re-check, so this
 * is the only thing that can heal a dropped `notification.created`. It also
 * covers the nastiest failure mode: a perfectly healthy stream that delivers
 * nothing because one service is missing REALTIME_REDIS_URL.
 */
const SAFETY_POLL_INTERVAL_MS = 120_000;
/** How many recent items the bell popover shows. */
const RECENT_LIMIT = 8;

/**
 * Single source of truth for notification state shared between the sidebar bell
 * and the full page. Holds the unread count + a small "recent" slice for the
 * popover, polls the unread count on an interval (paused while the tab is
 * hidden), and applies optimistic updates on mark-read actions.
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationStore {
  private readonly service = inject(NotificationService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly realtime = inject(RealtimeService);
  /** toObservable() needs an injection context; startPolling runs outside one. */
  private readonly injector = inject(Injector);

  readonly unreadCount = signal(0);
  readonly recent = signal<NotificationDTO[]>([]);
  readonly loadingRecent = signal(false);

  /** -1 until the first poll resolves, so we never toast on initial load. */
  private lastCount = -1;
  private polling = false;
  private readonly refresh$ = new Subject<void>();

  /**
   * Start the unread-count feed. Idempotent — safe to call once from the shell.
   *
   * Also owns the realtime connection's lifecycle, because the bell is the one
   * component guaranteed to be mounted for the whole session (see
   * layout/navbar/navbar.css, which hides it with display:none rather than @if
   * specifically so this keeps running).
   */
  startPolling(): void {
    if (this.polling) return;
    this.polling = true;

    this.realtime.connect();

    const visibleAgain$ = fromEvent(document, 'visibilitychange').pipe(
      filter(() => !document.hidden),
    );

    merge(
      // The `!document.hidden` filter belongs HERE, on the timer alone. It used
      // to sit on the merged pipe, which also gated `refresh$` — and would now
      // silently swallow every realtime event in a hidden tab, defeating the
      // whole point of keeping the stream open while hidden.
      toObservable(this.realtime.live, { injector: this.injector }).pipe(
        switchMap((live) => timer(0, live ? SAFETY_POLL_INTERVAL_MS : POLL_INTERVAL_MS)),
        filter(() => !document.hidden),
      ),
      visibleAgain$,
      this.refresh$,
      // A hint, never data: it triggers the same authoritative refetch a timer
      // tick does. `realtime.reconnected` is included automatically, so a
      // dropped event heals on the next connect.
      this.realtime.on(REALTIME_TOPICS.NOTIFICATION_CREATED),
    )
      .pipe(
        // catchError sits INSIDE switchMap, on the inner request, and that
        // placement is the whole point. An error allowed to escape switchMap
        // terminates this merged subscription — and with it the timer, the
        // visibility trigger, refresh$ AND the realtime handler, because all four
        // are merged into it. A single failed request (a deploy, a DB hiccup, one
        // dropped request on flaky wifi) used to freeze the badge until a full
        // document reload: there is no "next tick" once the stream is finished.
        //
        // That inverted invariant 7 — the poller was not slowed, it was
        // destroyed. An outer `error:` handler cannot fix it; a terminated
        // observable cannot be resumed. EMPTY makes the failed fetch a no-op and
        // leaves every trigger alive for the next one.
        switchMap(() => this.service.unreadCount().pipe(catchError(() => EMPTY))),
        takeUntilDestroyed(this.destroyRef),
      )
      // No `error:` handler on purpose: nothing can reach it now, and having one
      // here is what made the bug above look handled.
      .subscribe((res) => this.applyCount(res.data.count));

    // Keep the popover's slice fresh too, but only while it is actually open —
    // otherwise every event costs a paginated list request nobody looks at.
    this.realtime
      .on(REALTIME_TOPICS.NOTIFICATION_CREATED)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.popoverOpen()) return;
        this.service.invalidate();
        this.refreshRecent();
      });
  }

  /** Set by the bell so realtime knows whether the popover slice is on screen. */
  readonly popoverOpen = signal(false);

  /** Force an immediate unread-count refresh (e.g. after navigating). */
  refreshUnread(): void {
    this.refresh$.next();
  }

  /** Reload the recent slice shown in the popover. */
  refreshRecent(): void {
    this.loadingRecent.set(true);
    this.service
      .list({ page: 1, limit: RECENT_LIMIT })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.recent.set(Array.isArray(res.data) ? res.data : []);
          this.loadingRecent.set(false);
        },
        error: () => this.loadingRecent.set(false),
      });
  }

  /** Optimistically mark one notification read, then persist. */
  markRead(id: string): void {
    const target = this.recent().find((n) => n.id === id);
    if (target && target.read_at) return; // already read — no-op

    this.patchRecent(id);
    this.unreadCount.update((c) => Math.max(0, c - 1));

    this.service
      .markRead(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => (this.lastCount = this.unreadCount()),
        error: () => this.reconcileAfterError(),
      });
  }

  /** Optimistically mark all read, then persist. */
  markAllRead(): void {
    if (this.unreadCount() === 0) return;

    const now = new Date().toISOString();
    this.recent.update((list) => list.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    this.unreadCount.set(0);

    this.service
      .markAllRead()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => (this.lastCount = 0),
        error: () => this.reconcileAfterError(),
      });
  }

  private applyCount(count: number): void {
    if (this.lastCount >= 0 && count > this.lastCount) {
      this.snackbar.openSnackBar(
        this.translate.instant('NOTIFICATIONS.NEW_TOAST') as string,
        VALIDATION_TYPE,
      );
    }
    this.lastCount = count;
    this.unreadCount.set(count);
  }

  private patchRecent(id: string): void {
    const now = new Date().toISOString();
    this.recent.update((list) => list.map((n) => (n.id === id ? { ...n, read_at: now } : n)));
  }

  /** A persist call failed — drop optimistic state and refetch the truth. */
  private reconcileAfterError(): void {
    this.snackbar.openSnackBar(
      this.translate.instant('COMMON.ERRORS.EXCEPTION') as string,
      ERROR_TYPE,
    );
    this.service.invalidate();
    this.refreshRecent();
    this.refreshUnread();
  }
}
