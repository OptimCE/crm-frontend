import { formatNumber } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ChartModule } from 'primeng/chart';
import { Select } from 'primeng/select';

import { LocaleService } from '../../../../../../core/services/language/locale.service';
import {
  SimulationIterationTimeseriesDTO,
  SimulationSeries,
} from '../../../../../../shared/dtos/simulation.dtos';
import { SIMULATION_CHART_MAX_POINTS } from '../../../../../../shared/services/simulation.service';
import { translationChanges } from '../../../../../../shared/utils/translated-options.utils';

// A full year of 15-minute data is ~35k points; rendering every one chokes the
// canvas. We stride down to at most this many points for display — the totals
// (shown as metric cards) are always exact, this only smooths the curve. The
// service already samples to it; an older one sends every timestep.
const MAX_POINTS = SIMULATION_CHART_MAX_POINTS;

@Component({
  selector: 'app-simulation-timeseries-chart',
  standalone: true,
  imports: [ChartModule, Select, FormsModule, TranslatePipe],
  templateUrl: './simulation-timeseries-chart.html',
})
export class SimulationTimeseriesChart {
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LocaleService).locale;

  readonly iterations = input.required<SimulationIterationTimeseriesDTO[]>();
  /** Timesteps between two values of the series, as the service sampled them. */
  readonly stride = input(1);
  readonly selectedIndex = signal(0);

  readonly hasMultipleIterations = computed(() => this.iterations().length > 1);

  private readonly translationChanged = translationChanges();

  // Read in the computed so a language switch re-labels the options: they are
  // the select's aria-label too, and `instant()` alone is never read again.
  readonly iterationOptions = computed(() => {
    this.translationChanged();
    return this.iterations().map((iteration, index) => ({
      label: this.translate.instant('SIMULATION_HUB.RESULTS.ITERATION_LABEL', {
        number: iteration.number,
      }) as string,
      value: index,
    }));
  });

  readonly chartData = computed(() => {
    const list = this.iterations();
    const iteration = list[this.selectedIndex()] ?? list[0];
    if (!iteration) return null;
    const length = iteration.consumption.length;
    const stride = Math.max(1, Math.ceil(length / MAX_POINTS));
    // Value i is timestep i * serviceStride, labelled from 1.
    const serviceStride = this.stride();
    const labels = this.decimate(
      Array.from({ length }, (_, i) => i * serviceStride + 1),
      stride,
    ).map((n) => String(n));
    return {
      labels,
      datasets: [
        this.dataset(
          'SIMULATION_HUB.RESULTS.CHART.CONSUMPTION',
          iteration.consumption,
          '#6e7e70',
          stride,
          false,
        ),
        this.dataset(
          'SIMULATION_HUB.RESULTS.CHART.SELF_CONSUMED',
          iteration.energy_allocated_consumed,
          '#43a047',
          stride,
          true,
        ),
        this.dataset(
          'SIMULATION_HUB.RESULTS.CHART.SURPLUS',
          iteration.surplus,
          '#f59e0b',
          stride,
          false,
        ),
        this.dataset(
          'SIMULATION_HUB.RESULTS.CHART.RESIDUAL',
          iteration.residual_volume,
          '#ef4444',
          stride,
          false,
        ),
      ],
    };
  });

  readonly options = {
    // chart.js formats the axis ticks with this and falls back to the BROWSER's
    // locale without it. Set when the chart is built, like its translated titles.
    locale: this.locale(),
    maintainAspectRatio: false,
    responsive: true,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 16 } },
      tooltip: {
        callbacks: {
          label: (item: { dataset: { label?: string }; raw: unknown }): string => {
            const value = item.raw as number | null;
            // A gap (null) is no value, not 0 kWh, which formatNumber would print.
            const text =
              value === null ? '–' : `${formatNumber(value, this.locale(), '1.2-2')} kWh`;
            return `${item.dataset.label ?? ''}: ${text}`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: this.translate.instant('SIMULATION_HUB.RESULTS.CHART.X_AXIS') as string,
        },
        grid: { display: false },
        ticks: { maxTicksLimit: 12 },
      },
      y: {
        title: {
          display: true,
          text: this.translate.instant('SIMULATION_HUB.RESULTS.CHART.Y_AXIS') as string,
        },
        beginAtZero: true,
      },
    },
  };

  onIterationChange(index: number): void {
    this.selectedIndex.set(index);
  }

  private dataset(
    labelKey: string,
    data: SimulationSeries,
    color: string,
    stride: number,
    fill: boolean,
  ) {
    return {
      label: this.translate.instant(labelKey) as string,
      data: this.decimate(data, stride),
      borderColor: color,
      backgroundColor: fill ? this.toRgba(color, 0.16) : color,
      fill: fill ? 'origin' : false,
      tension: 0.25,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 3,
    };
  }

  private decimate<T>(values: T[], stride: number): T[] {
    if (stride <= 1) return values;
    return values.filter((_, index) => index % stride === 0);
  }

  private toRgba(hex: string, alpha: number): string {
    const value = hex.replace('#', '');
    const r = parseInt(value.substring(0, 2), 16);
    const g = parseInt(value.substring(2, 4), 16);
    const b = parseInt(value.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
