import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ChartModule } from 'primeng/chart';
import { Select } from 'primeng/select';

import { SimulationIterationTimeseriesDTO } from '../../../../../../shared/dtos/simulation.dtos';

// A full year of 15-minute data is ~35k points; rendering every one chokes the
// canvas. We stride down to at most this many points for display — the totals
// (shown as metric cards) are always exact, this only smooths the curve.
const MAX_POINTS = 1500;

@Component({
  selector: 'app-simulation-timeseries-chart',
  standalone: true,
  imports: [ChartModule, Select, FormsModule, TranslatePipe],
  templateUrl: './simulation-timeseries-chart.html',
})
export class SimulationTimeseriesChart {
  private readonly translate = inject(TranslateService);

  readonly iterations = input.required<SimulationIterationTimeseriesDTO[]>();
  readonly selectedIndex = signal(0);

  readonly hasMultipleIterations = computed(() => this.iterations().length > 1);

  readonly iterationOptions = computed(() =>
    this.iterations().map((iteration, index) => ({
      label: this.translate.instant('SIMULATION_HUB.RESULTS.ITERATION_LABEL', {
        number: iteration.number,
      }) as string,
      value: index,
    })),
  );

  readonly chartData = computed(() => {
    const list = this.iterations();
    const iteration = list[this.selectedIndex()] ?? list[0];
    if (!iteration) return null;
    const length = iteration.consumption.length;
    const stride = Math.max(1, Math.ceil(length / MAX_POINTS));
    const labels = this.decimate(
      Array.from({ length }, (_, i) => i + 1),
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
    maintainAspectRatio: false,
    responsive: true,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 16 } },
      tooltip: {
        callbacks: {
          label: (item: { dataset: { label?: string }; raw: unknown }): string => {
            const value = item.raw as number;
            return `${item.dataset.label ?? ''}: ${value.toFixed(2)} kWh`;
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

  private dataset(labelKey: string, data: number[], color: string, stride: number, fill: boolean) {
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

  private decimate(values: number[], stride: number): number[] {
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
