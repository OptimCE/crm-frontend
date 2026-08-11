import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';

import { DashboardTile } from '../../../../dashboard/components/tiles/dashboard-tile/dashboard-tile';
import { TileState } from '../../../../dashboard/dashboard-format';
import { MeDocumentDTO } from '../../../../../shared/dtos/me.dtos';
import { TimeAgoPipe } from '../../../../../shared/pipes/time-ago/time-ago-pipe';
import { MeService } from '../../../../../shared/services/me.service';
import { envelopeData } from '../../../home-format';

const VISIBLE_LIMIT = 5;

/**
 * "Mes documents" — files shared with the member, across every community.
 *
 * The same call the community dashboard's tile makes; the difference is that
 * this one does NOT filter to the active community, because there may not be
 * one. `/me/documents` has been cross-community all along — see the comment in
 * `my-documents-tile`, which narrows it deliberately.
 *
 * Every row already carries its own `community`, so this needs no community
 * list of its own — the name is rendered from the payload.
 */
@Component({
  selector: 'app-my-documents-panel',
  standalone: true,
  imports: [TranslatePipe, TimeAgoPipe, DashboardTile],
  templateUrl: './my-documents-panel.html',
})
export class MyDocumentsPanel {
  private readonly meService = inject(MeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly documents = signal<MeDocumentDTO[]>([]);
  private readonly failed = signal<boolean>(false);
  private readonly loading = signal<boolean>(true);

  readonly visible = computed(() => this.documents().slice(0, VISIBLE_LIMIT));
  readonly hiddenCount = computed(() => Math.max(0, this.documents().length - VISIBLE_LIMIT));

  readonly state = computed<TileState>(() => {
    if (this.loading()) return 'loading';
    if (this.failed()) return 'error';
    return this.documents().length === 0 ? 'empty' : 'ready';
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.meService
      .getDocuments({ page: 1, limit: 50 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const data = envelopeData<MeDocumentDTO[]>(response);
          if (!data) this.failed.set(true);
          else this.documents.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }
}
