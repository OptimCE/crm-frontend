import { Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { ChartModule } from 'primeng/chart';
import { map, merge } from 'rxjs';

import { LiveSeries } from '../../../../shared/dtos/live-data.dtos';
import { StackSegment, bucketLabel, formatNumber } from '../../live-data-format';

/**
 * The ESTIMATED sharing inside the sharing operations, as stacked bars (D-14).
 *
 * Two stacks per bucket - offtake (covered by the community + supplied by the
 * supplier) and injection (shared in the community + the rest to the grid) - the
 * shape of the DSO chart a manager already reads in the sharing-operation view,
 * drawn from live, monitored meters instead of the DSO's monthly files. The
 * segments are built by the pure `sharingStackSegments`, never here.
 *
 * Bars, not lines: an energy per interval is a quantity, and a stacked line
 * would interpolate between buckets that were each withheld or measured on
 * their own. A withheld bucket is simply an empty slot.
 *
 * Its own file and lazy chunk, behind `@defer`, like `live-energy-chart`; and the
 * same translation reactivity, for the same reason - a chart cannot use the
 * `translate` pipe, and `instant` answers with the key until the file loads.
 */
@Component({
  selector: 'app-live-sharing-chart',
  standalone: true,
  imports: [ChartModule],
  templateUrl: './live-sharing-chart.html',
})
export class LiveSharingChart {
  private readonly translate = inject(TranslateService);

  readonly series = input.required<LiveSeries>();
  readonly segments = input.required<StackSegment[]>();
  /** The dashboard's shared y-axis maximum, so this chart compares with the others. */
  readonly yMax = input<number | undefined>(undefined);

  /** See `LiveEnergyChart.i18nVersion`. */
  private readonly i18nVersion = toSignal(
    merge(
      this.translate.onLangChange,
      this.translate.onTranslationChange,
      this.translate.onFallbackLangChange,
    ).pipe(map((_event, index) => index + 1)),
    { initialValue: 0 },
  );

  private readonly locale = computed(() => {
    this.i18nVersion();
    return this.translate.getCurrentLang() || 'fr';
  });

  readonly data = computed(() => {
    this.i18nVersion();
    const current = this.series();
    const locale = this.locale();
    return {
      labels: current.points.map((point) => bucketLabel(point.bucket, current.resolution, locale)),
      datasets: this.segments().map((segment) => ({
        type: 'bar',
        label: this.translate.instant(segment.labelKey) as string,
        // `null` for a withheld bucket, never 0: an empty slot, not a zero bar.
        data: segment.values,
        backgroundColor: segment.color,
        borderColor: segment.color,
        stack: segment.stack,
        borderRadius: 2,
        barPercentage: 0.9,
        categoryPercentage: 0.8,
      })),
    };
  });

  readonly options = computed(() => ({
    locale: this.locale(),
    maintainAspectRatio: false,
    aspectRatio: 0.6,
    animation: { duration: 0 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, position: 'bottom' },
      tooltip: {
        callbacks: {
          label: (item: { raw: unknown; dataset: { label?: string } }) => {
            const value = item.raw as number | null;
            const label = item.dataset.label ?? '';
            if (value === null || value === undefined) {
              return `${label}: ${this.translate.instant('LIVE_DATA.CHART.WITHHELD') as string}`;
            }
            return `${label}: ${formatNumber(value, this.locale(), 3)} kWh`;
          },
        },
      },
    },
    scales: {
      x: { stacked: true, ticks: { maxTicksLimit: 12, autoSkip: true } },
      y: {
        stacked: true,
        beginAtZero: true,
        suggestedMax: this.yMax(),
        title: { display: true, text: this.translate.instant('LIVE_DATA.CHART.Y_AXIS') as string },
      },
    },
  }));
}
