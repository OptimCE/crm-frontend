import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { NotificationService } from '../../../notifications/services/notification.service';
import { SignatureStore } from '../../../signature/signature.store';
import { MeService } from '../../../../shared/services/me.service';
import {
  NeedsYouItem,
  envelopeData,
  incompleteRecordItems,
  invitationItems,
  signatureItems,
  unreadNotificationItems,
} from '../../home-format';

/**
 * "N choses vous attendent" — the first thing on `/home`, and the reason the
 * page exists for a member who is not sure why they are here.
 *
 * Four sources, one list: documents to sign, a pending invitation, a member
 * record missing a field, and unread notifications. To the reader they are one
 * question — *do I have to do something?* — so the API's shape (two invitation
 * endpoints with two DTOs) is flattened in `home-format` rather than shown.
 *
 * **When nothing is waiting, this collapses to a single reassuring line**, not
 * an empty card. A box saying "no items" is worse than no box: it makes the
 * absence of work look like a failure to load something.
 *
 * Every source degrades independently — a dead notification count must not hide
 * a pending invitation, which is the row that actually blocks somebody.
 *
 * The host carries `needs-you` whatever the state: the onboarding tours point
 * at it, and `needs-you__clear` / `__band` each exist in one state only.
 */
@Component({
  selector: 'app-needs-you-band',
  standalone: true,
  imports: [TranslatePipe, RouterLink],
  templateUrl: './needs-you-band.html',
  host: { class: 'block', 'data-testid': 'needs-you' },
})
export class NeedsYouBand {
  private readonly meService = inject(MeService);
  private readonly notificationService = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly signatures = inject(SignatureStore);

  /** What the requests below found; the documents to sign come from SignatureStore. */
  private readonly loaded = signal<NeedsYouItem[]>([]);
  /**
   * The documents to sign first: they have a deadline and a counterparty
   * waiting. The store refreshes on its own (realtime hints, every 5 min).
   */
  readonly items = computed(() => [
    ...signatureItems(this.signatures.pendingCount()),
    ...this.loaded(),
  ]);
  readonly loading = signal<boolean>(true);

  readonly count = computed(() => this.items().length);
  readonly isClear = computed(() => !this.loading() && this.count() === 0);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);

    forkJoin({
      memberInvitations: this.meService
        .getOwnMembersPendingInviation({ page: 1, limit: 50 })
        .pipe(catchError(() => of(null))),
      managerInvitations: this.meService
        .getOwnManagerPendingInvitation({ page: 1, limit: 50 })
        .pipe(catchError(() => of(null))),
      members: this.meService.getMembers({ page: 1, limit: 100 }).pipe(catchError(() => of(null))),
      unread: this.notificationService.unreadCount().pipe(catchError(() => of(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ memberInvitations, managerInvitations, members, unread }) => {
        this.loaded.set([
          ...invitationItems(
            envelopeData(memberInvitations) ?? [],
            envelopeData(managerInvitations) ?? [],
          ),
          // `instant` is typed `any`; the field label is a plain string and
          // nothing downstream treats it as anything else.
          ...incompleteRecordItems(
            envelopeData(members) ?? [],
            (key) => this.translate.instant(key) as string,
          ),
          ...unreadNotificationItems(envelopeData(unread)?.count ?? 0),
        ]);
        this.loading.set(false);
      });
  }
}
