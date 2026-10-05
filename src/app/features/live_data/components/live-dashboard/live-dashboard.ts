import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { interval, map, merge, takeUntil } from 'rxjs';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { Skeleton } from 'primeng/skeleton';
import { Tooltip } from 'primeng/tooltip';
import { FormsModule } from '@angular/forms';

import { ApiResponse } from '../../../../core/dtos/api.response';
import {
  AbsentReason,
  LiveErrorCode,
  LiveForecast,
  LiveOperation,
  LiveOperationSummary,
  LiveSeries,
  LiveSummary,
  LiveResolution,
  RollupFreshness,
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
  absentReason,
  absentReasonLabelKey,
  bucketLabel,
  chartEmptyKey,
  formatMinutes,
  formatW,
  formatWh,
  gridWithheldForPrivacy,
  offtakeChartLines,
  offtakeEmptyKey,
  productionChartLines,
  sharedYMax,
  sharingCoverage,
  sharingEmptyKey,
  sharingStackSegments,
} from '../../live-data-format';
import { LiveEnergyChart } from '../live-energy-chart/live-energy-chart';
import { LiveSharingChart } from '../live-sharing-chart/live-sharing-chart';

/** The scope selector's value: `null` is the whole community. */
type Scope = number | null;

/**
 * Sixty seconds, and no faster.
 *
 * Measurements arrive every 15 minutes and the rollup tick runs every 15
 * minutes, so nothing this view shows can change more often than that. A 5 s
 * poll would be 180 requests an hour to watch a number that moves four times.
 * The minute is for the device counts, which do move on their own.
 */
const POLL_INTERVAL_MS = 60_000;

/**
 * Screen 1 of 4: what the community is doing now.
 *
 * ---------------------------------------------------------------------------
 * AN ABSENT TERM IS NEVER RENDERED AS ZERO.
 *
 * `/summary` and `/series` omit a term they will not answer rather than nulling
 * it, and this component keeps that distinction all the way to the screen:
 * `formatWh(undefined)` is an em dash, and the reason comes from the payload's
 * own `absent[]` list. Three situations produce it and the copy differs for each
 * — withheld for privacy, not measurable by this hardware, or not built yet —
 * because "we are not telling you" and "the community produced nothing" are
 * different sentences and only one of them is true.
 * ---------------------------------------------------------------------------
 */
@Component({
  selector: 'app-live-dashboard',
  standalone: true,
  imports: [
    TranslatePipe,
    FormsModule,
    Card,
    Message,
    Select,
    SelectButton,
    Skeleton,
    Tooltip,
    LiveEnergyChart,
    LiveSharingChart,
  ],
  templateUrl: './live-dashboard.html',
})
export class LiveDashboard implements OnInit {
  private readonly service = inject(LiveDataService);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  readonly summary = signal<LiveSummary | null>(null);
  readonly series = signal<LiveSeries | null>(null);
  readonly forecast = signal<LiveForecast | null>(null);
  readonly loading = signal<boolean>(true);
  readonly seriesLoading = signal<boolean>(true);
  /**
   * 403 AGGREGATE_NOT_VISIBLE from the visibility gate, which refuses members
   * only: this manager view gets it once the backend sees the caller as a member
   * (a role withdrawn mid-session). Only that code — any other failure is a
   * fault, not a privacy setting, and a 1003 never arrives here at all.
   */
  readonly forbidden = signal<boolean>(false);

  readonly window = signal<LiveWindow>(LIVE_WINDOWS[1]);

  /**
   * D-14: the whole community, or one sharing operation. Every chart follows it,
   * and so do the energy cards; the fleet counts and the stale banner stay the
   * community's, because they describe the collector, not an operation.
   */
  readonly scope = signal<Scope>(null);
  readonly operations = signal<LiveOperation[]>([]);
  readonly operationSummary = signal<LiveOperationSummary | null>(null);

  /**
   * Bumped when translations load or change, so the selector's community label
   * is re-read. Translated HERE rather than in the template because PrimeNG
   * copies an option's label into its aria-label: a key there is read aloud.
   */
  private readonly i18nVersion = toSignal(
    merge(
      this.translate.onLangChange,
      this.translate.onTranslationChange,
      this.translate.onFallbackLangChange,
    ).pipe(map((_event, index) => index + 1)),
    { initialValue: 0 },
  );

  readonly scopeOptions = computed(() => {
    this.i18nVersion();
    return [
      {
        label: this.translate.instant('LIVE_DATA.SCOPE.COMMUNITY') as string,
        value: null as Scope,
      },
      ...this.operations().map((op) => ({ label: op.name, value: op.id as Scope })),
    ];
  });

  protected readonly formatWh = formatWh;
  protected readonly formatW = formatW;
  protected readonly absentReasonLabelKey = absentReasonLabelKey;
  protected readonly absentReason = absentReason;

  /** Options for `p-selectbutton`; labels are translated in the template. */
  readonly windowOptions = computed(() =>
    LIVE_WINDOWS.map((entry) => ({ label: entry.labelKey, value: entry })),
  );

  readonly productionAbsentReason = computed(() => {
    const current = this.summary();
    if (!current) return undefined;
    return current.production_wh === undefined
      ? absentReason(current.absent, 'production_wh')
      : undefined;
  });

  readonly gridAbsentReason = computed(() => {
    const current = this.summary();
    if (!current) return undefined;
    return current.import_wh === undefined ? absentReason(current.absent, 'import_wh') : undefined;
  });

  /**
   * The hour these figures cover, in Brussels time.
   *
   * The cards showed a number with no time attached to it at all. `/summary`
   * answers with the newest CLOSED community-hour - one the tick recomputed after
   * it ended - so at 10:05 the figure is 09:00-10:00's, and before the 10:01:30
   * tick it is still 08:00-09:00's: up to an hour and a bit old, and read as
   * "now" by anyone who is not told otherwise. `staleMinutes` covers the scheduler having
   * STOPPED; this covers the ordinary case, where everything is working and the
   * number is still not current.
   *
   * `bucketLabel` rather than `toLocaleString`, and 'hour' rather than the
   * selected window: a bucket is an instant in UTC, and rendering it in the
   * reader's own zone mislabels it for everyone outside Belgium.
   */
  readonly asOf = computed(() => {
    const bucket = this.summary()?.bucket;
    if (bucket === undefined) return null;
    return bucketLabel(bucket, 'hour', this.locale());
  });

  readonly gridWithheld = computed(() => {
    const current = this.summary();
    return current ? gridWithheldForPrivacy(current) : false;
  });

  /**
   * Production, and the export wherever production cannot be seen (protocol
   * 3.4: a prosumer's net meter has no production term). Empty for a series
   * that has neither - see `chartEmptyKey`.
   */
  readonly productionLines = computed(() => productionChartLines(this.series()?.points ?? []));

  /** The community's grid offtake: `import_wh`, withheld below k per bucket. */
  readonly offtakeLines = computed(() => offtakeChartLines(this.series()?.points ?? []));

  /**
   * Why the production chart has nothing to draw, or null when it has. A chart
   * of nothing renders as a flat line at zero and reads as "the community
   * produced nothing"; the reason is shown instead.
   */
  readonly chartEmptyKey = computed(() => {
    const current = this.series();
    return current ? chartEmptyKey(current) : 'LIVE_DATA.CHART.EMPTY';
  });

  /** The same for the offtake chart; below k its reason is the privacy one. */
  readonly offtakeEmptyKey = computed(() => {
    const current = this.series();
    return current ? offtakeEmptyKey(current) : 'LIVE_DATA.CHART.EMPTY';
  });

  /** One y-axis maximum for both charts, so their heights compare. */
  readonly yMax = computed(() => sharedYMax(this.series()?.points ?? []));

  /** The stacked chart: offtake and injection, each split by the shared estimate. */
  readonly sharingSegments = computed(() => sharingStackSegments(this.series()?.points ?? []));

  readonly sharingEmptyKey = computed(() => {
    const current = this.series();
    return current ? sharingEmptyKey(current) : 'LIVE_DATA.CHART.EMPTY';
  });

  /** "N monitored meters out of M" for the scope shown - the estimate's honesty line. */
  readonly coverage = computed(() => sharingCoverage(this.operations(), this.scope()));

  /** The selected operation's closed hour, in Brussels time. */
  readonly operationAsOf = computed(() => {
    const bucket = this.operationSummary()?.bucket;
    return bucket === undefined ? null : bucketLabel(bucket, 'hour', this.locale());
  });

  /**
   * The minutes the rollups have been behind, when - and only when - the
   * backend calls them STALE.
   *
   * It used to be computed here from the chart's newest point against 90
   * minutes, whatever the range. That was wrong three ways: a 30-day series has
   * closed days only, so its newest point is always a day old and the banner
   * never went away; a 24-hour series reads raw measurements, so a stopped
   * scheduler could never show; and at hour resolution a quiet fleet ages the
   * newest point while every tick runs. The verdict is now the backend's, the
   * same one the Ops tab shows, and the range no longer matters.
   */
  readonly staleMinutes = computed(() => {
    const current = this.summary();
    if (!current || String(current.rollup_freshness) !== String(RollupFreshness.STALE)) {
      return null;
    }
    return formatMinutes(current.rollup_lag_minutes, this.locale()) ?? '—';
  });

  /**
   * "No measurements have been rolled up yet" - true of a community that has
   * not been measured, false of one in its first hour: `/summary` reads CLOSED
   * hours only, and that hour has been measured and has simply not ended. The
   * production card names that reason itself.
   */
  readonly showNoData = computed(() => {
    const current = this.summary();
    if (!current || current.bucket !== undefined) return false;
    return (
      absentReason(current.absent, 'production_wh') !== String(AbsentReason.NO_CLOSED_HOUR_YET)
    );
  });

  /**
   * The reader's language, for every figure on the page. A method, not a
   * `computed`: the language is not a signal, and a method is re-read on every
   * change detection, so a switch of language re-renders the figures too.
   */
  locale(): string {
    return this.translate.getCurrentLang() || 'fr';
  }

  constructor() {
    // No realtime topic for this annexe: deviation 5 keeps realtime out of phase
    // 1 entirely, and at 15-minute granularity a push could only ever say
    // "refetch" — which is what this timer already does.
    //
    // Stops for good once the subscription is switched off: the hub is leaving
    // the route, and a poll must not keep hitting a module that is gone. Each
    // mount subscribes afresh, so polling resumes after a re-activation.
    interval(POLL_INTERVAL_MS)
      .pipe(takeUntil(this.service.subscriptionLost$), takeUntilDestroyed())
      .subscribe(() => this.refresh());
  }

  /** One poll tick. Public so specs can drive it without a 60 s timer. */
  refresh(): void {
    // A backgrounded tab has nobody to show the result to, and this is a
    // dashboard people leave open.
    if (document.hidden) return;
    this.loadSummary(true);
    this.loadOperationSummary();
    this.loadSeries(true);
  }

  ngOnInit(): void {
    this.loadSummary(false);
    this.loadSeries(false);
    this.loadForecast();
    this.loadOperations();
  }

  selectWindow(next: LiveWindow): void {
    if (!next || next === this.window()) return;
    this.window.set(next);
    this.loadSeries(false);
  }

  selectScope(next: Scope): void {
    if (next === this.scope()) return;
    this.scope.set(next);
    this.operationSummary.set(null);
    this.loadOperationSummary();
    this.loadSeries(false);
  }

  /** Silent on failure: without the list, the dashboard is the community view it always was. */
  private loadOperations(): void {
    this.service
      .operations()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: ApiResponse<LiveOperation[]>) => this.operations.set(response.data ?? []),
        error: () => this.operations.set([]),
      });
  }

  private loadOperationSummary(): void {
    const scope = this.scope();
    if (scope === null) return;
    this.service
      .operationSummary(scope)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: ApiResponse<LiveOperationSummary>) => {
          // A late answer for a scope the reader has since left is dropped.
          if (this.scope() === scope) this.operationSummary.set(response.data);
        },
        error: () => this.operationSummary.set(null),
      });
  }

  private loadSummary(silent: boolean): void {
    if (!silent) this.loading.set(true);
    this.service
      .summary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: ApiResponse<LiveSummary>) => {
          this.summary.set(response.data);
          this.forbidden.set(false);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          // 1003 never arrives here: LiveDataService completes the call empty
          // and the hub leaves the route.
          //
          // 2440 is a legitimate answer, not a fault: the backend sees a member,
          // and the community's manager has closed the aggregate to members.
          // Showing the standard red error toast for it would read as a bug.
          if (extractApiErrorCode(error) === LiveErrorCode.AGGREGATE_NOT_VISIBLE) {
            this.forbidden.set(true);
            return;
          }
          // Anything else is a fault, and never the privacy banner — that would
          // tell a manager their own setting hides figures it does not. First
          // load: a toast. Silent poll: keep the figures already on screen.
          if (!silent) this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }

  private loadSeries(silent: boolean): void {
    if (!silent) this.seriesLoading.set(true);
    const resolution: LiveResolution = this.window().resolution;
    const scope = this.scope();
    // NO `from`/`to`. The backend's default window for each resolution is
    // already snapped to that resolution's grid, and sending bounds this
    // component computed would be the moment a rounding slip turns into a 422 —
    // or worse, into a silently snapped window, which is the differencing
    // attack the refusal exists to close.
    const request =
      scope === null
        ? this.service.series({ resolution })
        : this.service.operationSeries(scope, { resolution });
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response: ApiResponse<LiveSeries>) => {
        // A late answer for a scope or window the reader has since left is
        // dropped, or the charts would show the previous selection's data.
        if (this.scope() !== scope || this.window().resolution !== resolution) return;
        this.series.set(response.data);
        this.seriesLoading.set(false);
      },
      error: () => {
        this.seriesLoading.set(false);
      },
    });
  }

  private loadForecast(): void {
    this.service
      .forecast()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: ApiResponse<LiveForecast>) => this.forecast.set(response.data),
        // Silent: the forecast is a bonus panel in phase 1, and a failure here
        // must not make the dashboard look broken.
        error: () => this.forecast.set(null),
      });
  }
}
