import { Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { ChartModule } from 'primeng/chart';
import { map, merge } from 'rxjs';

import { LiveSeries } from '../../../../shared/dtos/live-data.dtos';
import { EnergyLine, bucketLabel, formatNumber, isolatedPointRadii } from '../../live-data-format';

/** `#rrggbb` at the given opacity, for an area fill under its own line. */
function withAlpha(hex: string, alpha: number): string {
  const rgb = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  return `rgba(${rgb.join(', ')}, ${alpha})`;
}

/**
 * A live series, as a chart: one dataset per `EnergyLine`, on one kWh axis.
 *
 * The dashboard draws two of these - production with export, and the grid
 * offtake. WHICH lines a chart carries is decided by the pure builders in
 * live-data-format.ts (`productionChartLines`, `offtakeChartLines`), not here;
 * this component only draws them.
 *
 * Lives in its own file (and its own lazy chunk) so that `@defer`-ing it in
 * live-dashboard.html keeps `primeng/chart` and `chart.js` out of the live-data
 * feature chunk. They are downloaded only when someone opens the dashboard tab —
 * the same arrangement `meter-consumption-chart` uses, for the same reason. Both
 * cards defer the same component, so they share that one chunk.
 *
 * ---------------------------------------------------------------------------
 * BUILT AS DATASETS WITH GAPS, NOT AS FILTERED LISTS OF POINTS.
 *
 * A bucket whose term is absent is `null` in its dataset and chart.js draws a
 * GAP there. Dropping those buckets instead would close the gap and draw a
 * straight line across the missing hours — which is a picture of data that does
 * not exist, and is indistinguishable from a period that really was flat.
 *
 * `spanGaps` is therefore explicitly false rather than left to the default.
 *
 * The overlay for a forecast is deliberately NOT here yet. Plan section 11.2:
 * build the chart so that a forecast is an ADDITIONAL DATASET on the same axis
 * rather than a second chart, and nothing has to be rearranged when the first
 * method ships. That is what this shape is - and why no line here is dotted:
 * that style is kept for the forecast.
 * ---------------------------------------------------------------------------
 */
@Component({
  selector: 'app-live-energy-chart',
  standalone: true,
  imports: [ChartModule],
  templateUrl: './live-energy-chart.html',
})
export class LiveEnergyChart {
  private readonly translate = inject(TranslateService);

  readonly series = input.required<LiveSeries>();
  readonly lines = input.required<EnergyLine[]>();
  /**
   * The y-axis maximum, in kWh, shared by every chart on the dashboard so their
   * heights compare. A floor rather than a cap (`suggestedMax`): the axis still
   * grows if a line goes higher.
   */
  readonly yMax = input<number | undefined>(undefined);
  /** Kept per instance: the e2e scenarios wait on `live-production-chart`. */
  readonly testId = input<string>('live-energy-chart');

  /**
   * Bumped whenever the strings `translate.instant` returns may have changed:
   * a language finished loading, was switched, or had keys added.
   *
   * ---------------------------------------------------------------------------
   * A CHART CANNOT USE THE `translate` PIPE, so its legend, axis title and
   * tooltip come from `instant` - which answers with the KEY itself while the
   * language file is still loading, and is read once by a `computed` that has no
   * other reason to run again. The app does not wait for the file before
   * rendering (`initializeLanguage` resolves at once), so a chart drawn first
   * kept "LIVE_DATA.CHART.EXPORT" as its legend for good. Reported 2026-10-04.
   * Every computed below reads this signal, so the chart is redrawn with the
   * real words as soon as they exist, and again on a language switch.
   * ---------------------------------------------------------------------------
   */
  private readonly i18nVersion = toSignal(
    merge(
      this.translate.onLangChange,
      this.translate.onTranslationChange,
      this.translate.onFallbackLangChange,
    ).pipe(map((_event, index) => index + 1)),
    { initialValue: 0 },
  );

  /** The reader's language - for the axis labels, the ticks and the tooltip. */
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
      datasets: this.lines().map((line) => ({
        type: 'line',
        label: this.translate.instant(line.labelKey) as string,
        // `null` for an absent term, never 0 — see the class docstring.
        data: line.values,
        borderColor: line.color,
        backgroundColor: line.fill ? withAlpha(line.color, 0.15) : line.color,
        borderWidth: 2,
        fill: line.fill,
        tension: 0.3,
        // Smoothing that never overshoots: plain cubic interpolation dips a
        // falling curve below zero, which draws negative energy.
        cubicInterpolationMode: 'monotone',
        spanGaps: false,
        // No markers on a line, except on a value with a gap on both sides,
        // which no segment can reach - see `isolatedPointRadii`.
        pointRadius: isolatedPointRadii(line.values),
        pointBackgroundColor: line.color,
        pointHitRadius: 12,
        // Read back by the tooltip: which sentence an absent bucket gets
        // depends on the line - "not measured" and "withheld" are not the same.
        absentKey: line.absentKey,
      })),
    };
  });

  readonly options = computed(() => ({
    // chart.js formats tick values with this, and defaults to en-US: a French
    // axis would read "1.5" where every card on the page says "1,50".
    locale: this.locale(),
    maintainAspectRatio: false,
    aspectRatio: 0.6,
    animation: { duration: 0 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      // Always shown, even for one line: a chart that may carry Export where
      // Production used to be must say which one it is.
      legend: { display: true, position: 'bottom' },
      tooltip: {
        callbacks: {
          label: (item: { raw: unknown; dataset: { label?: string; absentKey?: string } }) => {
            const value = item.raw as number | null;
            const label = item.dataset.label ?? '';
            // An absent bucket must not read as "0 kWh" in the tooltip either.
            if (value === null || value === undefined) {
              const reason = item.dataset.absentKey
                ? (this.translate.instant(item.dataset.absentKey) as string)
                : '—';
              return `${label}: ${reason}`;
            }
            return `${label}: ${formatNumber(value, this.locale(), 3)} kWh`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        suggestedMax: this.yMax(),
        title: { display: true, text: this.translate.instant('LIVE_DATA.CHART.Y_AXIS') as string },
      },
      x: {
        ticks: { maxTicksLimit: 12, autoSkip: true },
      },
    },
  }));
}
