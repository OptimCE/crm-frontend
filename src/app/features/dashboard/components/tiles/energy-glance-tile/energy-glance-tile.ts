import { DecimalPipe } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

import {
  SharingOpConsumptionDTO,
  SharingOperationPartialDTO,
} from '../../../../../shared/dtos/sharing_operation.dtos';
import { SharingOperationService } from '../../../../../shared/services/sharing_operation.service';
import { envelopeData, TileState } from '../../../dashboard-format';
import { DashboardTile } from '../dashboard-tile/dashboard-tile';

/**
 * How many operations get a volume read.
 *
 * Each one costs two calls (coverage, then the month's readings). The tile is a
 * glance, not a report — the operations list links to the full per-operation
 * charts, so probing every operation would be a lot of traffic for a summary.
 */
const PROBE_LIMIT = 3;

export interface OperationVolumes {
  operation: SharingOperationPartialDTO;
  /** `YYYY-MM` of the most recent month that has data. */
  month: string;
  sharedKwh: number;
  injectedSharedKwh: number;
}

/**
 * "Is my community actually sharing energy?" — community-wide, per sharing
 * operation.
 *
 * Deliberately NOT the same component as the member's "My energy here": that one
 * answers a different question (what did *I* get?), from a different endpoint
 * (`/me/meters/{ean}/consumptions`), at a different aggregation unit, with a
 * different empty state. They only sound alike.
 *
 * Reads `/sharing_operations/{id}/consumptions` rather than iterating meters —
 * the server already aggregates it, so per-meter reads would be N+1 for no gain.
 */
@Component({
  selector: 'app-energy-glance-tile',
  standalone: true,
  imports: [DecimalPipe, TranslatePipe, RouterLink, DashboardTile],
  templateUrl: './energy-glance-tile.html',
})
export class EnergyGlanceTile {
  private readonly sharingOperationService = inject(SharingOperationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly operations = input.required<SharingOperationPartialDTO[]>();
  readonly operationsLoading = input.required<boolean>();
  readonly operationsFailed = input.required<boolean>();
  readonly reloadKey = input<number>(0);

  /**
   * Retry goes to the container, not to `load()`. The tile shows an error for
   * either of two failures — the container's operations fetch or its own volume
   * reads — and only the container can clear the first. Refetching the list
   * re-triggers the effect below, so this recovers from both.
   */
  readonly retry = output<void>();

  readonly volumes = signal<OperationVolumes[]>([]);
  private readonly failed = signal<boolean>(false);
  private readonly loading = signal<boolean>(true);

  readonly state = computed<TileState>(() => {
    if (this.operationsLoading() || this.loading()) return 'loading';
    if (this.operationsFailed() || this.failed()) return 'error';
    return this.volumes().length === 0 ? 'empty' : 'ready';
  });

  constructor() {
    effect(() => {
      this.reloadKey();
      const operations = this.operations();
      if (this.operationsLoading()) return;
      this.load(operations);
    });
  }

  load(operations: SharingOperationPartialDTO[]): void {
    const probed = operations.slice(0, PROBE_LIMIT);
    if (probed.length === 0) {
      this.volumes.set([]);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.failed.set(false);

    forkJoin(probed.map((operation) => this.volumesFor(operation)))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (results) => {
          // An operation with no readings yet is a legitimate answer, not a
          // failure — it simply drops out of the list.
          this.volumes.set(results.filter((r): r is OperationVolumes => r !== null));
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  /** Latest month with data for one operation, summed. Null when it has none. */
  private volumesFor(operation: SharingOperationPartialDTO) {
    return this.sharingOperationService.getSharingOperationConsumptionCoverage(operation.id).pipe(
      switchMap((coverage) => {
        const months = envelopeData(coverage) ?? [];
        const latest = months
          .filter((m) => m.count > 0)
          .sort((a, b) => b.month.localeCompare(a.month))[0];
        if (!latest) return of<OperationVolumes | null>(null);

        return this.sharingOperationService
          .getSharingOperationConsumptions(operation.id, monthRange(latest.month))
          .pipe(
            map((response) => {
              const data = envelopeData<SharingOpConsumptionDTO>(response);
              if (!data) return null;
              return {
                operation,
                month: latest.month,
                sharedKwh: sum(data.shared),
                injectedSharedKwh: sum(data.inj_shared),
              };
            }),
          );
      }),
      // One operation failing must not take the whole tile down.
      catchError(() => of<OperationVolumes | null>(null)),
    );
  }
}

function sum(values: number[] | undefined): number {
  return (values ?? []).reduce((total, value) => total + value, 0);
}

/** First and last calendar day of a `YYYY-MM` month. */
function monthRange(month: string): { date_start: string; date_end: string } {
  const [year, monthIndex] = month.split('-').map(Number);
  const lastDay = new Date(year, monthIndex, 0).getDate();
  return {
    date_start: `${month}-01`,
    date_end: `${month}-${String(lastDay).padStart(2, '0')}`,
  };
}
