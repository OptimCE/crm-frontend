import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';

import { ActiveCommunityStore } from '../../../../../core/services/active-community.store';
import { MeMembersPartialDTO } from '../../../../../shared/dtos/me.dtos';
import { MemberStatus } from '../../../../../shared/types/member.types';
import { MeService } from '../../../../../shared/services/me.service';
import { envelopeData, TileState } from '../../../dashboard-format';
import { DashboardTile } from '../dashboard-tile/dashboard-tile';

/**
 * "Is my own record in this community in order?"
 *
 * The member counterpart of the manager's readiness tile — same idea, different
 * subject and different endpoint, which is why they are not one component.
 *
 * The list endpoint only carries `{id, name, member_type, status}`, so the only
 * signal available without an extra call per member is the status. That is
 * honest: a PENDING record genuinely is the thing a member can act on, and the
 * detail page linked below shows the rest.
 */
@Component({
  selector: 'app-my-member-record-tile',
  standalone: true,
  imports: [TranslatePipe, RouterLink, DashboardTile],
  templateUrl: './my-member-record-tile.html',
})
export class MyMemberRecordTile {
  private readonly meService = inject(MeService);
  private readonly activeCommunity = inject(ActiveCommunityStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly reloadKey = input<number>(0);

  readonly members = signal<MeMembersPartialDTO[]>([]);
  private readonly failed = signal<boolean>(false);
  private readonly loading = signal<boolean>(true);

  readonly needsAttention = computed(() =>
    this.members().filter((member) => member.status === MemberStatus.PENDING),
  );

  readonly state = computed<TileState>(() => {
    if (this.loading()) return 'loading';
    if (this.failed()) return 'error';
    return this.members().length === 0 ? 'empty' : 'ready';
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
      community: this.activeCommunity.ensureLoaded(),
      members: this.meService.getMembers({ page: 1, limit: 50 }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ community, members }) => {
          const data = envelopeData(members);
          if (!data) {
            this.failed.set(true);
          } else {
            // `/me/members` spans every community the user belongs to.
            this.members.set(
              community ? data.filter((member) => member.community.id === community.id) : [],
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
