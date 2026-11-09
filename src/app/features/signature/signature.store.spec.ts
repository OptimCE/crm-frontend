import { TestBed } from '@angular/core/testing';
import Keycloak from 'keycloak-js';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { RealtimeService } from '../../core/services/realtime/realtime.service';
import {
  REALTIME_TOPICS,
  RealtimeEvent,
  RealtimeSubscribable,
} from '../../core/services/realtime/realtime.types';
import { MySignatureRow } from '../../shared/dtos/signature.dtos';
import { SignatureService } from '../../shared/services/signature.service';
import { SIGNATURE_REFRESH_EVERY_MS, SignatureStore } from './signature.store';
import { signatureRow } from './signature-fixtures';

function event(topic: RealtimeSubscribable): RealtimeEvent {
  return {
    v: 1,
    id: Math.random().toString(16).slice(2),
    topic,
    at: '',
    scope: { community_id: 1 },
    ref: { kind: 'signature_request', id: 'r1' },
    hint: { status: 'ready' },
  };
}

describe('SignatureStore', () => {
  let myRequests: ReturnType<typeof vi.fn>;
  let events: Subject<RealtimeEvent>;
  let topics: RealtimeSubscribable[];

  function setup(rows: MySignatureRow[], authenticated = true): SignatureStore {
    myRequests = vi.fn().mockReturnValue(of({ data: rows }));
    events = new Subject<RealtimeEvent>();
    topics = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: SignatureService, useValue: { myRequests } },
        {
          provide: RealtimeService,
          useValue: {
            on: (...wanted: RealtimeSubscribable[]) => {
              topics.push(...wanted);
              return events;
            },
          },
        },
        { provide: Keycloak, useValue: { authenticated } },
      ],
    });
    return TestBed.inject(SignatureStore);
  }

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('counts the slots the user can sign now, not the waiting or past ones', () => {
    const store = setup([
      signatureRow({ your_turn: true }),
      signatureRow({ your_turn: true }, { id: 's2' }),
      signatureRow({ your_turn: false }, { id: 's3', status: 'WAITING' }),
      signatureRow({ pending: false, your_turn: false }, { id: 's4', status: 'SIGNED' }),
    ]);
    expect(store.loaded()).toBe(true);
    expect(store.pendingCount()).toBe(2);
    expect(store.hasAny()).toBe(true);
    // Fresh, never a cached copy.
    expect(myRequests).toHaveBeenCalledWith(undefined, true);
  });

  it('has nothing to show with no rows', () => {
    const store = setup([]);
    expect(store.pendingCount()).toBe(0);
    expect(store.hasAny()).toBe(false);
  });

  it('asks nothing while signed out', () => {
    const store = setup([signatureRow()], false);
    expect(myRequests).not.toHaveBeenCalled();
    expect(store.loaded()).toBe(false);
  });

  it('reads again on the annexe’s hints and on a new notification', () => {
    setup([]);
    expect(topics).toEqual(
      expect.arrayContaining([
        REALTIME_TOPICS.SIGNATURE_REQUEST_UPDATED,
        REALTIME_TOPICS.SIGNATURE_SIGNED,
        REALTIME_TOPICS.NOTIFICATION_CREATED,
      ]),
    );
    expect(myRequests).toHaveBeenCalledTimes(1);

    myRequests.mockReturnValue(of({ data: [signatureRow({ your_turn: true })] }));
    events.next(event(REALTIME_TOPICS.SIGNATURE_REQUEST_UPDATED));
    expect(myRequests).toHaveBeenCalledTimes(2);
    events.next(event(REALTIME_TOPICS.SIGNATURE_SIGNED));
    events.next(event(REALTIME_TOPICS.NOTIFICATION_CREATED));
    expect(myRequests).toHaveBeenCalledTimes(4);
    expect(TestBed.inject(SignatureStore).pendingCount()).toBe(1);
  });

  it('reads again every 5 minutes, and when a screen asks', () => {
    vi.useFakeTimers();
    const store = setup([]);
    expect(myRequests).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(SIGNATURE_REFRESH_EVERY_MS);
    expect(myRequests).toHaveBeenCalledTimes(2);
    store.refresh();
    expect(myRequests).toHaveBeenCalledTimes(3);
  });

  it('keeps the previous rows when a read fails, and says so', () => {
    const store = setup([signatureRow({ your_turn: true })]);
    myRequests.mockReturnValue(throwError(() => new Error('boom')));
    store.refresh();
    expect(store.failed()).toBe(true);
    expect(store.pendingCount()).toBe(1);
  });
});
