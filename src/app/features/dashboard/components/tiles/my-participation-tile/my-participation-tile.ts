import { PercentPipe } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';

import { ActiveCommunityStore } from '../../../../../core/services/active-community.store';
import { MeAllocationShareDTO } from '../../../../../shared/dtos/me.dtos';
import { FieldLabelHelper } from '../../../../../shared/components/field-label-helper/field-label-helper';
import { MeService } from '../../../../../shared/services/me.service';
import { envelopeData, shareDisplay, TileState } from '../../../dashboard-format';
import { DashboardTile } from '../dashboard-tile/dashboard-tile';

/**
 * "Which sharing operations am I in, and what fraction am I allocated?"
 *
 * Arguably the single most interesting number in the product for a member, and
 * until now there was no way for them to see it: every allocation-key endpoint is
 * manager-gated. `GET /me/allocation-shares` exists for this tile.
 *
 * The four outcomes are genuinely different and the tile must not flatten them:
 *  - a fraction;
 *  - PRORATA, which is only resolved at settlement;
 *  - the key is in force but does not name this meter (`matched: false`) —
 *    rendered as "not listed", **never** as 0 %, because the member is not
 *    receiving nothing, the key simply does not say;
 *  - no approved key in force at all.
 *
 * There is nowhere to link: `/keys` is `minRole GESTIONNAIRE`. So the copy tells
 * the member to ask their community manager instead of offering a dead link.
 */
@Component({
  selector: 'app-my-participation-tile',
  standalone: true,
  imports: [PercentPipe, TranslatePipe, FieldLabelHelper, DashboardTile],
  templateUrl: './my-participation-tile.html',
})
export class MyParticipationTile {
  private readonly meService = inject(MeService);
  private readonly activeCommunity = inject(ActiveCommunityStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly reloadKey = input<number>(0);

  readonly rows = signal<MeAllocationShareDTO[]>([]);
  private readonly failed = signal<boolean>(false);
  private readonly loading = signal<boolean>(true);

  readonly state = computed<TileState>(() => {
    if (this.loading()) return 'loading';
    if (this.failed()) return 'error';
    return this.rows().length === 0 ? 'empty' : 'ready';
  });

  protected readonly shareDisplay = shareDisplay;

  constructor() {
    effect(() => {
      this.reloadKey();
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);

    // The endpoint answers for every community at once, so the active one is
    // filtered here — on the internal id the payload carries, not on the name.
    forkJoin({
      community: this.activeCommunity.ensureLoaded(),
      shares: this.meService.getAllocationShares(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ community, shares }) => {
          const data = envelopeData(shares);
          if (!data) {
            this.failed.set(true);
          } else {
            this.rows.set(
              community ? data.shares.filter((row) => row.community.id === community.id) : [],
            );
          }
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }
}
