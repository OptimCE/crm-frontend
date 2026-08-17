import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';

import { environments } from '../../../../environments/environments';
import { RealtimeService } from './realtime.service';
import {
  REALTIME_ERROR_DISABLED,
  REALTIME_RECONNECTED,
  REALTIME_TOPICS,
  type RealtimeEvent,
} from './realtime.types';

/** Minimal EventSource stand-in that records construction and lets a test drive it. */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  static reset(): void {
    FakeEventSource.instances = [];
  }

  closed = false;
  onmessage: ((ev: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  private readonly listeners = new Map<string, (() => void)[]>();

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, fn: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }

  close(): void {
    this.closed = true;
  }

  fire(type: string): void {
    for (const fn of this.listeners.get(type) ?? []) fn();
  }

  message(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent<string>);
  }

  /** The `?t=` value this instance was constructed with. */
  get token(): string {
    return new URL(this.url, 'http://localhost').searchParams.get('t') ?? '';
  }
}

const TICKET_URL = `${environments.apiUrl}/notifications/realtime/ticket`;

function envelope(over: Partial<RealtimeEvent> = {}): RealtimeEvent {
  return {
    v: 1,
    id: 'aaaaaaaaaaaaaaaa',
    topic: REALTIME_TOPICS.GENERATION_FINISHED,
    at: '2026-08-16T09:41:02.118Z',
    scope: { community_id: 12 },
    ref: { kind: 'generation', id: '418' },
    hint: { status: 'success' },
    ...over,
  };
}

describe('RealtimeService', () => {
  let service: RealtimeService;
  let http: HttpTestingController;
  let originalEventSource: unknown;

  beforeEach(() => {
    FakeEventSource.reset();
    originalEventSource = (globalThis as Record<string, unknown>)['EventSource'];
    (globalThis as Record<string, unknown>)['EventSource'] = FakeEventSource;

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), RealtimeService],
    });
    service = TestBed.inject(RealtimeService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>)['EventSource'] = originalEventSource;
    TestBed.resetTestingModule();
  });

  /** Mint a ticket and open the stream, returning the fake source. */
  function connect(ticket = 'ticket-1'): FakeEventSource {
    service.connect();
    http.expectOne(TICKET_URL).flush({ data: { ticket, expires_in: 30 }, error_code: 0 });
    const source = FakeEventSource.instances.at(-1);
    if (!source) throw new Error('no EventSource was constructed');
    return source;
  }

  it('fetches the ticket BEFORE constructing the stream, and puts it in the url', () => {
    service.connect();
    // Nothing may be opened until the ticket exists — the stream endpoint is
    // reachable without the gateway and the ticket is its only credential.
    expect(FakeEventSource.instances).toHaveLength(0);

    http.expectOne(TICKET_URL).flush({ data: { ticket: 'abc', expires_in: 30 }, error_code: 0 });

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].token).toBe('abc');
  });

  it('mints through /api so the bearer interceptor applies, and streams outside it', () => {
    // If the ticket URL fell outside keycloak.urlPattern the request would go out
    // unauthenticated and the whole feature would silently fail; if the STREAM
    // url fell inside it, an interceptor would try to attach a token EventSource
    // cannot send.
    expect(TICKET_URL).toMatch(environments.keycloak.urlPattern);
    expect(environments.realtimeUrl).not.toMatch(environments.keycloak.urlPattern);
    connect();
  });

  it('goes live and replays a reconnect event on `ready`', () => {
    const seen: RealtimeEvent[] = [];
    service.on(REALTIME_TOPICS.GENERATION_FINISHED).subscribe((e) => seen.push(e));

    connect().fire('ready');

    expect(service.status()).toBe('live');
    // Every consumer must refetch on connect — that is what makes an at-most-once
    // transport safe without a replay buffer.
    expect(seen.map((e) => e.topic)).toEqual([REALTIME_RECONNECTED]);
  });

  // ---- The anti-regression test for the 401 loop -------------------------

  it('on error, CLOSES the stream and re-mints a DIFFERENT ticket', () => {
    vi.useFakeTimers();
    try {
      const first = connect('ticket-1');
      first.fire('ready');

      first.onerror?.();

      // EventSource auto-reconnects to the same URL, which holds an
      // already-redeemed single-use ticket — leaving it open is a 401 loop
      // forever. Closing first is mandatory, not an optimisation.
      expect(first.closed).toBe(true);
      http.expectNone(TICKET_URL); // backs off first, does not hammer

      // First retry is a jittered fraction of 1s; 5s clears it comfortably.
      vi.advanceTimersByTime(5_000);

      const pending = http.match(TICKET_URL);
      expect(pending).toHaveLength(1);
      pending[0].flush({ data: { ticket: 'ticket-2', expires_in: 30 }, error_code: 0 });

      const second = FakeEventSource.instances.at(-1);
      expect(second?.token).toBe('ticket-2');
      expect(second?.token).not.toBe(first.token);
    } finally {
      vi.useRealTimers();
    }
  });

  it('backs off, reaches fallback after 3 failures, and keeps retrying', () => {
    vi.useFakeTimers();
    try {
      for (let attempt = 1; attempt <= 3; attempt++) {
        const pending = http.match(TICKET_URL);
        if (pending.length === 0) service.connect();
        http.expectOne(TICKET_URL).error(new ProgressEvent('error'));
        vi.advanceTimersByTime(60_000);
      }
      // `fallback` is not terminal — the pollers carry the app meanwhile, and a
      // transient outage must self-heal without a page reload.
      expect(service.status()).toBe('fallback');
      expect(http.match(TICKET_URL).length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('re-mints immediately on `expiring`, so the lifetime cap leaves no gap', () => {
    const first = connect('ticket-1');
    first.fire('ready');

    first.fire('expiring');

    expect(first.closed).toBe(true);
    http
      .expectOne(TICKET_URL)
      .flush({ data: { ticket: 'ticket-2', expires_in: 30 }, error_code: 0 });
    expect(FakeEventSource.instances.at(-1)?.token).toBe('ticket-2');
  });

  it('does NOT reconnect immediately on `superseded`', () => {
    const source = connect();
    source.fire('ready');

    source.fire('superseded');

    // Another tab won the per-user slot. Reconnecting now would make two tabs
    // evict each other forever.
    expect(service.status()).toBe('fallback');
    http.expectNone(TICKET_URL);
  });

  it('falls back without constructing a stream when the feature is disabled', () => {
    service.connect();
    http
      .expectOne(TICKET_URL)
      .flush(
        { error_code: REALTIME_ERROR_DISABLED },
        { status: 503, statusText: 'Service Unavailable' },
      );

    expect(service.status()).toBe('fallback');
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  // ---- connect() must be idempotent --------------------------------------

  it('ignores a second connect() while one is already in flight or live', () => {
    service.connect();
    service.connect(); // mint in flight
    http.expectOne(TICKET_URL).flush({ data: { ticket: 'a', expires_in: 30 }, error_code: 0 });

    service.connect(); // stream already open
    http.expectNone(TICKET_URL);

    // Without the guard, waking a live tab mints a second ticket, opens a second
    // EventSource and orphans the first — which is never closed and holds a
    // server slot until TCP notices.
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  // ---- dispatch ----------------------------------------------------------

  it('delivers only the subscribed topics', () => {
    const generation: RealtimeEvent[] = [];
    service.on(REALTIME_TOPICS.GENERATION_FINISHED).subscribe((e) => generation.push(e));
    const source = connect();

    source.message(envelope({ id: 'a1', topic: REALTIME_TOPICS.GENERATION_FINISHED }));
    source.message(envelope({ id: 'b2', topic: REALTIME_TOPICS.SIMULATION_FINISHED }));

    expect(generation.map((e) => e.id)).toEqual(['a1']);
  });

  it('emits a duplicate id only once', () => {
    const seen: RealtimeEvent[] = [];
    service.on(REALTIME_TOPICS.GENERATION_FINISHED).subscribe((e) => seen.push(e));
    const source = connect();

    source.message(envelope({ id: 'dup' }));
    source.message(envelope({ id: 'dup' }));

    expect(seen).toHaveLength(1);
  });

  it('survives a malformed frame and an unknown envelope version', () => {
    const seen: RealtimeEvent[] = [];
    service.on(REALTIME_TOPICS.GENERATION_FINISHED).subscribe((e) => seen.push(e));
    const source = connect();

    source.onmessage?.({ data: 'not json' } as MessageEvent<string>);
    source.message(envelope({ id: 'v2', v: 2 as 1 }));
    source.message(envelope({ id: 'ok' }));

    // One bad frame must not kill the Subject for the rest of the session.
    expect(seen.map((e) => e.id)).toEqual(['ok']);
  });
});
