import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { Bucket } from '../../../../../shared/dtos/administrative-procedure.dtos';
import { AdministrativeProcedureService } from '../../../../../shared/services/administrative-procedure.service';
import { bucketLabelKey } from '../../../../administrative_document/procedures/procedure-format';
import { envelopeData, TileState } from '../../../dashboard-format';
import { DashboardTile } from '../dashboard-tile/dashboard-tile';

/** Buckets worth a row. "Done recently" is history, not a to-do. */
const TRACKED_BUCKETS: readonly Bucket[] = ['todo', 'waiting', 'planned'] as const;

interface BucketCount {
  bucket: Bucket;
  count: number;
}

/**
 * Where the community's procedures stand: how many to do, waiting on the GRD
 * or the regulator, planned. One read of the espace administratif's dashboard,
 * which already groups them.
 */
@Component({
  selector: 'app-dossiers-tile',
  standalone: true,
  imports: [TranslatePipe, RouterLink, DashboardTile],
  templateUrl: './dossiers-tile.html',
})
export class DossiersTile {
  private readonly service = inject(AdministrativeProcedureService);
  private readonly destroyRef = inject(DestroyRef);

  readonly reloadKey = input<number>(0);

  readonly counts = signal<BucketCount[]>([]);
  private readonly failed = signal<boolean>(false);
  private readonly loading = signal<boolean>(true);

  readonly total = computed(() => this.counts().reduce((sum, entry) => sum + entry.count, 0));
  readonly nonEmpty = computed(() => this.counts().filter((entry) => entry.count > 0));

  readonly state = computed<TileState>(() => {
    if (this.loading()) return 'loading';
    if (this.failed()) return 'error';
    return this.total() === 0 ? 'empty' : 'ready';
  });

  protected readonly bucketLabelKey = bucketLabelKey;

  constructor() {
    effect(() => {
      this.reloadKey();
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.service
      .getInbox()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const inbox = envelopeData(response);
          if (!inbox) {
            this.failed.set(true);
          } else {
            this.counts.set(
              TRACKED_BUCKETS.map((bucket) => ({
                bucket,
                count: inbox.groups[bucket]?.length ?? 0,
              })),
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
