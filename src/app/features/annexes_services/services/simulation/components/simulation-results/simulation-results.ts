import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { Skeleton } from 'primeng/skeleton';

import { ApiResponse } from '../../../../../../core/dtos/api.response';
import {
  SimulationConsumerResultDTO,
  SimulationDetailDTO,
  SimulationStatus,
  SimulationTimeseriesDTO,
} from '../../../../../../shared/dtos/simulation.dtos';
import { SimulationService } from '../../../../../../shared/services/simulation.service';
import { ErrorMessageHandler } from '../../../../../../shared/services-ui/error.message.handler';
import { SimulationTimeseriesChart } from '../simulation-timeseries-chart/simulation-timeseries-chart';

@Component({
  selector: 'app-simulation-results',
  standalone: true,
  imports: [TranslatePipe, Skeleton, SimulationTimeseriesChart],
  templateUrl: './simulation-results.html',
  styleUrl: './simulation-results.css',
})
export class SimulationResults {
  private readonly service = inject(SimulationService);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  readonly detail = input.required<SimulationDetailDTO>();

  readonly timeseries = signal<SimulationTimeseriesDTO | null>(null);
  readonly timeseriesLoading = signal(false);
  readonly timeseriesError = signal(false);
  private loadedForId: number | null = null;

  // Iteration numbers whose per-consumer table is expanded.
  readonly expandedIterations = signal<ReadonlySet<number>>(new Set());
  private iterationsInitForId: number | null = null;

  readonly keyResult = computed(() => this.detail().key_result);

  protected readonly SimulationStatus = SimulationStatus;

  constructor() {
    effect(() => {
      const detail = this.detail();
      const result = detail.key_result;

      // Open the first iteration once per simulation shown (so the user lands
      // on a populated table) without overriding later manual toggles.
      if (result && this.iterationsInitForId !== detail.id) {
        const first = result.iterations[0];
        this.expandedIterations.set(new Set(first ? [first.number] : []));
        this.iterationsInitForId = detail.id;
      }

      // Lazily fetch the per-timestep series the first time a successful run is
      // shown. Guarded by loadedForId so re-renders don't refetch.
      if (
        detail.status === SimulationStatus.SUCCESS &&
        detail.has_timeseries &&
        this.loadedForId !== detail.id
      ) {
        this.loadTimeseries(detail.id);
      }
    });
  }

  private loadTimeseries(id: number): void {
    this.loadedForId = id;
    this.timeseriesLoading.set(true);
    this.timeseriesError.set(false);
    this.service
      .getTimeseries(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const data = response.data && typeof response.data !== 'string' ? response.data : null;
          this.timeseries.set(data);
          this.timeseriesLoading.set(false);
          if (!data) this.timeseriesError.set(true);
        },
        error: (error: unknown) => {
          this.timeseriesLoading.set(false);
          this.timeseriesError.set(true);
          this.loadedForId = null; // allow a retry when the row is reopened
          const errorData = error instanceof ApiResponse ? (error.data as string) : null;
          this.errorHandler.handleError(errorData);
        },
      });
  }

  toggleIteration(iterationNumber: number): void {
    this.expandedIterations.update((current) => {
      const next = new Set(current);
      if (next.has(iterationNumber)) {
        next.delete(iterationNumber);
      } else {
        next.add(iterationNumber);
      }
      return next;
    });
  }

  isIterationExpanded(iterationNumber: number): boolean {
    return this.expandedIterations().has(iterationNumber);
  }

  /** Per-consumer self-consumption coverage (consumed / consumption) as 0–100. */
  consumerCoverage(consumer: SimulationConsumerResultDTO): number {
    if (consumer.consumption_total <= 0) return 0;
    return Math.max(
      0,
      Math.min(100, (consumer.energy_allocated_consumed_total / consumer.consumption_total) * 100),
    );
  }

  formatEnergy(value: number): string {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  formatPercent(value: number): string {
    return (value * 100).toFixed(1);
  }

  /** Clamp a 0–1 rate to a 0–100 number for the radial gauge fill. */
  percentValue(value: number): number {
    return Math.max(0, Math.min(100, value * 100));
  }
}
