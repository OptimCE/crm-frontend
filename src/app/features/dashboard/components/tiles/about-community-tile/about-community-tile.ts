import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { ActiveCommunityStore } from '../../../../../core/services/active-community.store';
import { CommunityDetailDTO } from '../../../../../shared/dtos/community.dtos';
import { TileState } from '../../../dashboard-format';
import { DashboardTile } from '../dashboard-tile/dashboard-tile';

/**
 * Who runs this community, and under which regulator.
 *
 * Non-sensitive aggregate only. `GET /communities/:id` carries `idChecker()` and
 * no role check, so this is member-safe — but the legal/bank fields it also
 * returns are deliberately not shown here: a member has no use for the IBAN, and
 * the manager readiness tile is where the gaps in them belong.
 */
@Component({
  selector: 'app-about-community-tile',
  standalone: true,
  imports: [TranslatePipe, RouterLink, DashboardTile],
  templateUrl: './about-community-tile.html',
})
export class AboutCommunityTile {
  private readonly activeCommunity = inject(ActiveCommunityStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly reloadKey = input<number>(0);

  readonly community = signal<CommunityDetailDTO | null>(null);
  private readonly failed = signal<boolean>(false);
  private readonly loading = signal<boolean>(true);

  readonly state = computed<TileState>(() => {
    if (this.loading()) return 'loading';
    if (this.failed()) return 'error';
    return this.community() ? 'ready' : 'empty';
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
    this.activeCommunity
      .ensureLoaded()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (community) => {
          this.community.set(community);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }
}
