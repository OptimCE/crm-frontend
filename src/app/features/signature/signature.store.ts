import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import Keycloak from 'keycloak-js';
import { Subject, catchError, filter, interval, merge, of, startWith, switchMap } from 'rxjs';

import { RealtimeService } from '../../core/services/realtime/realtime.service';
import { REALTIME_TOPICS } from '../../core/services/realtime/realtime.types';
import { MySignatureRow } from '../../shared/dtos/signature.dtos';
import { SignatureService } from '../../shared/services/signature.service';
import { pendingCount } from './signature-format';

/** A badge never needs to be exact to the second, only never stale for long. */
export const SIGNATURE_REFRESH_EVERY_MS = 5 * 60_000;

/**
 * The user's signature slots (`/me/requests`, every community): the « À
 * signer » inbox, the navigation's badge and the /home band read the same rows.
 *
 * Read on start, on the annexe's realtime hints (`signature.request.updated`,
 * `signature.signed`), on `notification.created` (an invitation is a
 * notification first), on a reconnect, every 5 minutes, and whenever a screen
 * asks. Realtime is off in production: the 5-minute read is the floor.
 *
 * Signed out, nothing is asked (the navigation mounts on the way to /auth).
 */
@Injectable({ providedIn: 'root' })
export class SignatureStore {
  private readonly service = inject(SignatureService);
  private readonly realtime = inject(RealtimeService);
  private readonly keycloak = inject(Keycloak, { optional: true });
  private readonly destroyRef = inject(DestroyRef);
  private readonly refresh$ = new Subject<void>();

  readonly rows = signal<MySignatureRow[]>([]);
  /** The first answer arrived (rows may still be empty). */
  readonly loaded = signal(false);
  /** The last read failed; the rows are the previous ones. */
  readonly failed = signal(false);
  /** The slots the user can sign now: the badge. */
  readonly pendingCount = computed(() => pendingCount(this.rows()));
  /** Anything to show at all, pending or past: whether the entry is in the navigation. */
  readonly hasAny = computed(() => this.rows().length > 0);

  constructor() {
    merge(
      this.realtime.on(
        REALTIME_TOPICS.SIGNATURE_REQUEST_UPDATED,
        REALTIME_TOPICS.SIGNATURE_SIGNED,
        REALTIME_TOPICS.NOTIFICATION_CREATED,
      ),
      interval(SIGNATURE_REFRESH_EVERY_MS),
      this.refresh$,
    )
      .pipe(
        startWith(null),
        filter(() => this.keycloak?.authenticated === true),
        switchMap(() => this.service.myRequests(undefined, true).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        const data = response?.data;
        if (!Array.isArray(data)) {
          this.failed.set(true);
          this.loaded.set(true);
          return;
        }
        this.failed.set(false);
        this.rows.set([...data]);
        this.loaded.set(true);
      });
  }

  /** Read again now (a screen opened, a signature was sent). */
  refresh(): void {
    this.refresh$.next();
  }
}
