import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Skeleton } from 'primeng/skeleton';
import { Tooltip } from 'primeng/tooltip';
import { catchError, of, switchMap, tap } from 'rxjs';

import { ApiResponse } from '../../../core/dtos/api.response';
import { SharingOpConsumptionCoverageDTO } from '../../dtos/sharing_operation.dtos';
import { SharingOperationService } from '../../services/sharing_operation.service';

type CellState = 'complete' | 'partial' | 'none';

interface MonthCell {
  index: number; // 0..11
  state: CellState;
  count: number;
  ratio: number; // 0..1
}

interface YearRow {
  year: number;
  months: MonthCell[];
}

/** Quarter-hourly cadence → 96 slots/day; a month ≥ 95% full counts as complete. */
const QUARTER_HOURS_PER_DAY = 96;
const COMPLETE_RATIO = 0.95;

/**
 * Shows which months already have consumption data for a sharing operation, as a
 * per-year Jan–Dec grid (green = (near-)complete, amber = partial, grey = none).
 * A companion to `app-consumption-upload`; used in the sharing-operation view and
 * the billing Generate tab. Bump `reloadKey` to refetch after a new upload.
 */
@Component({
  selector: 'app-consumption-coverage',
  standalone: true,
  imports: [TranslatePipe, Skeleton, Tooltip],
  templateUrl: './consumption-coverage.html',
  styleUrl: './consumption-coverage.css',
})
export class ConsumptionCoverage {
  private readonly service = inject(SharingOperationService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly operationId = input.required<number>();
  /** Bump to force a refetch (e.g. after a successful upload). */
  readonly reloadKey = input<number>(0);

  readonly loading = signal<boolean>(true);
  readonly rows = signal<YearRow[]>([]);

  readonly hasData = computed(() => this.rows().length > 0);

  readonly monthInitials = Array.from({ length: 12 }, (_, m) =>
    new Intl.DateTimeFormat(this.locale, { month: 'narrow' }).format(new Date(2000, m, 1)),
  );

  constructor() {
    toObservable(computed(() => ({ id: this.operationId(), reload: this.reloadKey() })))
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap(({ id }) =>
          this.service
            .getSharingOperationConsumptionCoverage(id)
            .pipe(catchError(() => of(new ApiResponse<SharingOpConsumptionCoverageDTO[]>([])))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        this.rows.set(this.buildRows(Array.isArray(res.data) ? res.data : []));
        this.loading.set(false);
      });
  }

  private get locale(): string | undefined {
    return this.translate.currentLang || undefined;
  }

  private buildRows(coverage: SharingOpConsumptionCoverageDTO[]): YearRow[] {
    if (coverage.length === 0) return [];

    const counts = new Map<string, number>();
    let minYear = Number.POSITIVE_INFINITY;
    let maxYear = Number.NEGATIVE_INFINITY;

    for (const entry of coverage) {
      const [yearStr, monthStr] = entry.month.split('-');
      const year = Number(yearStr);
      const monthIndex = Number(monthStr) - 1;
      if (Number.isNaN(year) || Number.isNaN(monthIndex)) continue;
      // COUNT(*) can arrive as a numeric string through the pg driver — coerce.
      counts.set(`${year}-${monthIndex}`, Number(entry.count) || 0);
      if (year < minYear) minYear = year;
      if (year > maxYear) maxYear = year;
    }
    if (!Number.isFinite(minYear)) return [];

    const rows: YearRow[] = [];
    for (let year = minYear; year <= maxYear; year++) {
      const months: MonthCell[] = [];
      for (let m = 0; m < 12; m++) {
        const count = counts.get(`${year}-${m}`) ?? 0;
        const expected = new Date(year, m + 1, 0).getDate() * QUARTER_HOURS_PER_DAY;
        const ratio = expected > 0 ? count / expected : 0;
        const state: CellState =
          count <= 0 ? 'none' : ratio >= COMPLETE_RATIO ? 'complete' : 'partial';
        months.push({ index: m, state, count, ratio });
      }
      rows.push({ year, months });
    }
    return rows;
  }

  tooltip(cell: MonthCell, year: number): string {
    const monthLabel = new Intl.DateTimeFormat(this.locale, {
      month: 'long',
      year: 'numeric',
    }).format(new Date(year, cell.index, 1));
    if (cell.state === 'none') {
      return `${monthLabel} — ${this.translate.instant('CONSUMPTION_COVERAGE.LEGEND_NONE')}`;
    }
    return `${monthLabel} — ${this.translate.instant('CONSUMPTION_COVERAGE.POINTS', {
      count: cell.count,
      pct: Math.round(cell.ratio * 100),
    })}`;
  }
}
