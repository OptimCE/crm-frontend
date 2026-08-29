import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { RealtimeService } from '../../../core/services/realtime/realtime.service';
import {
  REALTIME_TOPICS,
  type RealtimeEvent,
} from '../../../core/services/realtime/realtime.types';
import { SnackbarNotification } from '../../../shared/services-ui/snackbar.notifcation.service';
import { NotificationService } from './notification.service';
import { NotificationStore } from './notification.store';

/** Drives the store's realtime dependency without any transport. */
class FakeRealtime {
  readonly status = signal<'idle' | 'connecting' | 'live' | 'fallback'>('idle');
  readonly live = signal(false);
  readonly events$ = new Subject<RealtimeEvent>();
  connectCalls = 0;

  connect(): void {
    this.connectCalls++;
  }

  on(): Subject<RealtimeEvent> {
    return this.events$;
  }
}

function event(
  topic: RealtimeEvent['topic'] = REALTIME_TOPICS.NOTIFICATION_CREATED,
): RealtimeEvent {
  return {
    v: 1,
    id: Math.random().toString(16).slice(2),
    topic,
    at: '2026-08-16T09:41:02.118Z',
    scope: { community_id: 1 },
    ref: { kind: 'notification', id: '0' },
    hint: {},
  };
}

describe('NotificationStore', () => {
  let store: NotificationStore;
  let realtime: FakeRealtime;
  let unreadCount: ReturnType<typeof vi.fn>;
  let snackbar: { openSnackBar: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    realtime = new FakeRealtime();
    unreadCount = vi.fn(() => of({ data: { count: 0 }, error_code: 0 }));
    snackbar = { openSnackBar: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        NotificationStore,
        { provide: RealtimeService, useValue: realtime },
        { provide: SnackbarNotification, useValue: snackbar },
        // The store resolves its toast copy through `instant`. These specs assert
        // THAT a toast happened, never its text, so echoing the key back is
        // enough — but the provider itself is mandatory: the store injects
        // TranslateService in a field initialiser, so without it every test here
        // dies at construction with NG0201 before reaching its own assertions.
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        {
          provide: NotificationService,
          useValue: {
            unreadCount,
            list: () => of({ data: [], pagination: {}, error_code: 0 }),
            invalidate: () => undefined,
          },
        },
      ],
    });
    store = TestBed.inject(NotificationStore);
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  const counting = (n: number) => () => of({ data: { count: n }, error_code: 0 });

  /**
   * Start the feed AND let its first poll actually happen.
   *
   * `startPolling()` on its own is not enough, and the reason is worth knowing:
   * the poll trigger is `toObservable(realtime.live)`, which emits from an
   * EFFECT. The effect has not run by the time `startPolling()` returns, so no
   * `timer(0, …)` exists yet — hence `TestBed.tick()` to flush it. The extra 0ms
   * advance is then needed because rxjs schedules even a zero delay through a
   * real timer, which the installed fake timers hold until time moves.
   *
   * Only the FIRST poll needs this; once the timer exists, the plain
   * `advanceTimersByTime(30_000)` calls below drive it as they always did.
   */
  function start(): void {
    store.startPolling();
    TestBed.tick();
    vi.advanceTimersByTime(0);
  }

  it('opens the realtime stream when polling starts, and is idempotent', () => {
    store.startPolling();
    store.startPolling();
    expect(realtime.connectCalls).toBe(1);
  });

  // ---- The regression guard for the frozen-badge bug ----------------------

  it('KEEPS POLLING after a failed request', () => {
    // The bug: catchError used to be absent, so an errored unreadCount()
    // propagated out of switchMap and terminated the merged subscription — taking
    // the timer, the visibility trigger, refresh$ and the realtime handler with
    // it. One HTTP blip froze the badge until a full document reload. There is no
    // "next tick" once the stream is finished, so an outer `error:` handler could
    // never have saved it.
    start();
    expect(unreadCount).toHaveBeenCalledTimes(1); // timer(0, …), see start()

    unreadCount.mockImplementation(() => throwError(() => new Error('500')));
    vi.advanceTimersByTime(30_000);
    expect(unreadCount).toHaveBeenCalledTimes(2); // the failing one

    unreadCount.mockImplementation(counting(7));
    vi.advanceTimersByTime(30_000);
    expect(unreadCount).toHaveBeenCalledTimes(3); // <-- 3 only if the stream survived
    expect(store.unreadCount()).toBe(7);
  });

  it('still reacts to a realtime event after a failed request', () => {
    // The nastier half: realtime and the poll share one subscription, so a failed
    // poll used to kill push delivery too — including the `realtime.reconnected`
    // refetch that is supposed to resync after a reconnect.
    start();
    unreadCount.mockImplementation(() => throwError(() => new Error('500')));
    vi.advanceTimersByTime(30_000);

    unreadCount.mockImplementation(counting(3));
    realtime.events$.next(event());

    expect(store.unreadCount()).toBe(3);
  });

  it('survives several consecutive failures', () => {
    start();
    unreadCount.mockImplementation(() => throwError(() => new Error('500')));
    for (let i = 0; i < 5; i++) vi.advanceTimersByTime(30_000);

    unreadCount.mockImplementation(counting(1));
    vi.advanceTimersByTime(30_000);
    expect(store.unreadCount()).toBe(1);
  });

  // NOT tested here: that the cadence switches 30s -> 120s when realtime goes
  // live. It depends on toObservable() propagating a signal change through an
  // effect while fake timers are installed, which is fragile enough that the test
  // would report on its own plumbing rather than on the store. Invariant 7 is
  // covered end-to-end instead, by the negative control in
  // ../../../../../e2e/REALTIME_SCENARIOS_SPEC.md §5.

  // ---- Toast semantics ---------------------------------------------------

  it('never toasts on the first resolution', () => {
    // lastCount starts at -1 precisely so a page load is silent, whether the
    // first value arrives from timer(0, …) or from an event that beat it.
    unreadCount.mockImplementation(counting(5));
    start();
    expect(store.unreadCount()).toBe(5);
    expect(snackbar.openSnackBar).not.toHaveBeenCalled();
  });

  it('toasts once when the count rises, and not when it falls', () => {
    unreadCount.mockImplementation(counting(1));
    start();
    expect(snackbar.openSnackBar).not.toHaveBeenCalled();

    unreadCount.mockImplementation(counting(2));
    vi.advanceTimersByTime(30_000);
    expect(snackbar.openSnackBar).toHaveBeenCalledTimes(1);

    unreadCount.mockImplementation(counting(1));
    vi.advanceTimersByTime(30_000);
    expect(snackbar.openSnackBar).toHaveBeenCalledTimes(1);
  });

  it('produces ONE toast when an event and a timer tick race', () => {
    // Both funnel into one switchMap, so the later trigger cancels the in-flight
    // request rather than producing a second applyCount.
    unreadCount.mockImplementation(counting(1));
    start();

    unreadCount.mockImplementation(counting(4));
    realtime.events$.next(event());
    vi.advanceTimersByTime(30_000);

    expect(snackbar.openSnackBar).toHaveBeenCalledTimes(1);
  });
});
