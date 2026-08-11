import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, forkJoin, map, of } from 'rxjs';

import { InvitationService } from '../../../../../shared/services/invitation.service';
import { TileState } from '../../../dashboard-format';
import { DashboardTile } from '../dashboard-tile/dashboard-tile';

interface FunnelCounts {
  memberInvitations: number;
  toBeEncoded: number;
  managerInvitations: number;
}

/**
 * Who is part-way through joining the community.
 *
 * Counts come from `limit=1` reads and `pagination.total`: every list endpoint
 * returns the total, so a counter costs one tiny page rather than the whole list.
 */
@Component({
  selector: 'app-onboarding-funnel-tile',
  standalone: true,
  imports: [TranslatePipe, RouterLink, DashboardTile],
  templateUrl: './onboarding-funnel-tile.html',
})
export class OnboardingFunnelTile {
  private readonly invitationService = inject(InvitationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly reloadKey = input<number>(0);

  readonly counts = signal<FunnelCounts | null>(null);
  private readonly failed = signal<boolean>(false);
  private readonly loading = signal<boolean>(true);

  readonly total = computed(() => {
    const counts = this.counts();
    return counts ? counts.memberInvitations + counts.managerInvitations : 0;
  });

  readonly state = computed<TileState>(() => {
    if (this.loading()) return 'loading';
    if (this.failed()) return 'error';
    return this.total() === 0 ? 'empty' : 'ready';
  });

  constructor() {
    effect(() => {
      this.reloadKey();
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);

    forkJoin({
      memberInvitations: this.invitationService
        .getMembersPendingInviation({ page: 1, limit: 1 })
        .pipe(map((response) => response.pagination.total)),
      toBeEncoded: this.invitationService
        .getMembersPendingInviation({ page: 1, limit: 1, to_be_encoded: true })
        .pipe(map((response) => response.pagination.total)),
      managerInvitations: this.invitationService
        .getManagerPendingInvitation({ page: 1, limit: 1 })
        .pipe(map((response) => response.pagination.total)),
    })
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((counts) => {
        if (counts) this.counts.set(counts);
        else this.failed.set(true);
        this.loading.set(false);
      });
  }
}
