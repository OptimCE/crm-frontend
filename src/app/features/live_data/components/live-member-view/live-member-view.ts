import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { Skeleton } from 'primeng/skeleton';

import { ApiResponse } from '../../../../core/dtos/api.response';
import {
  LiveErrorCode,
  LiveMemberOperation,
  LiveMemberSeries,
  LiveResolution,
  LiveSeries,
} from '../../../../shared/dtos/live-data.dtos';
import { LiveDataService } from '../../../../shared/services/live-data.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import {
  extractApiErrorCode,
  extractApiErrorMessage,
} from '../../../../shared/utils/api-error.utils';
import {
  LIVE_WINDOWS,
  LiveWindow,
  chartEmptyKey,
  productionChartLines,
  sharedYMax,
} from '../../live-data-format';
import { LiveEnergyChart } from '../live-energy-chart/live-energy-chart';

/**
 * What a MEMBER sees of Live Data (D-14): the production of the sharing
 * operation(s) they hold an ACTIVE meter in - and, where those meters cannot see
 * production (protocol 3.4), the operation's export, under its k. Never the
 * community, never another operation, never the grid offtake or the shared
 * estimate: the backend's member DTO cannot carry them, and this view has
 * nowhere to put them either.
 *
 * Shown by the hub INSTEAD of the four manager tabs, the billing pattern.
 *
 * A 2440 (the manager closed the figures to members) is a setting, not a fault:
 * a message, never the red toast. An empty list is a member who holds no meter
 * in an operation with live data - said plainly, not left as a blank page.
 */
@Component({
  selector: 'app-live-member-view',
  standalone: true,
  imports: [
    TranslatePipe,
    FormsModule,
    Card,
    Message,
    Select,
    SelectButton,
    Skeleton,
    LiveEnergyChart,
  ],
  templateUrl: './live-member-view.html',
})
export class LiveMemberView implements OnInit {
  private readonly service = inject(LiveDataService);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  readonly operations = signal<LiveMemberOperation[] | null>(null);
  readonly operation = signal<number | null>(null);
  readonly series = signal<LiveMemberSeries | null>(null);
  readonly seriesLoading = signal<boolean>(false);
  readonly forbidden = signal<boolean>(false);
  readonly window = signal<LiveWindow>(LIVE_WINDOWS[1]);

  readonly windowOptions = computed(() =>
    LIVE_WINDOWS.map((entry) => ({ label: entry.labelKey, value: entry })),
  );

  /** Operation names are data, not keys, so the select's aria-label is readable. */
  readonly operationOptions = computed(() =>
    (this.operations() ?? []).map((op) => ({ label: op.name, value: op.id })),
  );

  /**
   * The member series is the production chart's shape minus the grid terms it
   * can never carry, so the same pure builders draw it: production where
   * measured, export where not.
   */
  readonly chartSeries = computed<LiveSeries | null>(() => this.series());

  readonly lines = computed(() => productionChartLines(this.chartSeries()?.points ?? []));
  readonly yMax = computed(() => sharedYMax(this.chartSeries()?.points ?? []));
  readonly emptyKey = computed(() => {
    const current = this.chartSeries();
    return current ? chartEmptyKey(current) : null;
  });

  ngOnInit(): void {
    this.service
      .myOperations()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: ApiResponse<LiveMemberOperation[]>) => {
          const held = response.data ?? [];
          this.operations.set(held);
          if (held.length > 0) {
            this.operation.set(held[0].id);
            this.loadSeries();
          }
        },
        error: (error: unknown) => this.fail(error),
      });
  }

  selectOperation(next: number): void {
    if (next === this.operation()) return;
    this.operation.set(next);
    this.loadSeries();
  }

  selectWindow(next: LiveWindow): void {
    if (!next || next === this.window()) return;
    this.window.set(next);
    this.loadSeries();
  }

  private loadSeries(): void {
    const operation = this.operation();
    if (operation === null) return;
    const resolution: LiveResolution = this.window().resolution;
    this.seriesLoading.set(true);
    // No `from`/`to`, for the dashboard's reason: the default window is already
    // snapped, and bounds computed here are how a rounding slip becomes a 422.
    this.service
      .myOperationSeries(operation, { resolution })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: ApiResponse<LiveMemberSeries>) => {
          if (this.operation() !== operation || this.window().resolution !== resolution) return;
          this.series.set(response.data);
          this.seriesLoading.set(false);
        },
        error: (error: unknown) => {
          this.seriesLoading.set(false);
          this.fail(error);
        },
      });
  }

  private fail(error: unknown): void {
    if (extractApiErrorCode(error) === LiveErrorCode.AGGREGATE_NOT_VISIBLE) {
      this.forbidden.set(true);
      return;
    }
    this.errorHandler.handleError(extractApiErrorMessage(error));
  }
}
