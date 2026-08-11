import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';

import { ActiveCommunityStore } from '../../../../../core/services/active-community.store';
import { MeDocumentDTO } from '../../../../../shared/dtos/me.dtos';
import { TimeAgoPipe } from '../../../../../shared/pipes/time-ago/time-ago-pipe';
import { MeService } from '../../../../../shared/services/me.service';
import { envelopeData, TileState } from '../../../dashboard-format';
import { DashboardTile } from '../dashboard-tile/dashboard-tile';

const VISIBLE_LIMIT = 5;

/** Files shared with this member in this community. */
@Component({
  selector: 'app-my-documents-tile',
  standalone: true,
  imports: [TranslatePipe, RouterLink, TimeAgoPipe, DashboardTile],
  templateUrl: './my-documents-tile.html',
})
export class MyDocumentsTile {
  private readonly meService = inject(MeService);
  private readonly activeCommunity = inject(ActiveCommunityStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly reloadKey = input<number>(0);

  readonly documents = signal<MeDocumentDTO[]>([]);
  private readonly failed = signal<boolean>(false);
  private readonly loading = signal<boolean>(true);

  readonly visible = computed(() => this.documents().slice(0, VISIBLE_LIMIT));

  readonly state = computed<TileState>(() => {
    if (this.loading()) return 'loading';
    if (this.failed()) return 'error';
    return this.documents().length === 0 ? 'empty' : 'ready';
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
      documents: this.meService.getDocuments({ page: 1, limit: 50 }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ community, documents }) => {
          const data = envelopeData(documents);
          if (!data) {
            this.failed.set(true);
          } else {
            // `/me/documents` is cross-community; filter to the active one.
            this.documents.set(
              community ? data.filter((document) => document.community.id === community.id) : [],
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
