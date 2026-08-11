import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, forkJoin, map, of } from 'rxjs';

import { DossierStatus } from '../../../../../shared/dtos/administrative-document.dtos';
import { AdministrativeDocumentService } from '../../../../../shared/services/administrative-document.service';
import { dossierStatusLabelKey } from '../../../../administrative_document/administrative-document-format';
import { TileState } from '../../../dashboard-format';
import { DashboardTile } from '../dashboard-tile/dashboard-tile';

/** Statuses worth a row. CLOSED and LAPSED are history, not a to-do. */
const TRACKED_STATUSES: readonly DossierStatus[] = [
  DossierStatus.IN_PREPARATION,
  DossierStatus.SUBMITTED,
  DossierStatus.COMPLETE,
] as const;

interface StatusCount {
  status: DossierStatus;
  count: number;
}

/**
 * Where the community's filings stand.
 *
 * One `limit=1` read per status, taking `pagination.total` — cheaper than paging
 * every dossier client-side just to group them.
 */
@Component({
  selector: 'app-dossiers-tile',
  standalone: true,
  imports: [TranslatePipe, RouterLink, DashboardTile],
  templateUrl: './dossiers-tile.html',
})
export class DossiersTile {
  private readonly service = inject(AdministrativeDocumentService);
  private readonly destroyRef = inject(DestroyRef);

  readonly reloadKey = input<number>(0);

  readonly counts = signal<StatusCount[]>([]);
  private readonly failed = signal<boolean>(false);
  private readonly loading = signal<boolean>(true);

  readonly total = computed(() => this.counts().reduce((sum, entry) => sum + entry.count, 0));
  readonly nonEmpty = computed(() => this.counts().filter((entry) => entry.count > 0));

  readonly state = computed<TileState>(() => {
    if (this.loading()) return 'loading';
    if (this.failed()) return 'error';
    return this.total() === 0 ? 'empty' : 'ready';
  });

  protected readonly dossierStatusLabelKey = dossierStatusLabelKey;

  constructor() {
    effect(() => {
      this.reloadKey();
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);

    forkJoin(
      TRACKED_STATUSES.map((status) =>
        this.service
          .listDossiers({ page: 1, limit: 1, status })
          .pipe(map((response) => ({ status, count: response.pagination.total }))),
      ),
    )
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
