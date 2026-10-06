import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { interval, takeUntil } from 'rxjs';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';

import { ApiResponse } from '../../../../core/dtos/api.response';
import {
  DeviceHealth,
  LiveOpsHealth,
  RollupFreshness,
} from '../../../../shared/dtos/live-data.dtos';
import { LiveDataService } from '../../../../shared/services/live-data.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error.utils';
import {
  HEALTH_ORDER,
  fleetBanner,
  formatMinutes,
  healthLabelKey,
  healthSeverity,
  needsAttention,
} from '../../live-data-format';

const POLL_INTERVAL_MS = 60_000;

/**
 * Screen 3 of 4: is the pipeline healthy?
 *
 * ---------------------------------------------------------------------------
 * THE ROLLUP FRESHNESS IS THE POINT OF THIS SCREEN, NOT THE DEVICE COUNTS.
 *
 * Every device can be online, reporting on schedule, and green — while the
 * scheduler that turns their measurements into the dashboard's numbers has been
 * dead for a day. Nothing else in the product would say so: the devices page
 * looks fine, the chart simply stops moving, and the last value stays plausible.
 *
 * The verdict is the BACKEND's (`rollup_freshness`), and it is not the age of
 * the newest data. That age once drove this banner, and it cannot tell "the
 * community produced nothing last night" from "nothing has been computed since
 * Tuesday": a quiet fleet stops producing buckets while every tick runs, so the
 * page turned red every quiet evening and blamed the scheduler.
 * ---------------------------------------------------------------------------
 */
@Component({
  selector: 'app-live-ops',
  standalone: true,
  imports: [TranslatePipe, Card, Message, Skeleton, Tag],
  templateUrl: './live-ops.html',
})
export class LiveOps implements OnInit {
  private readonly service = inject(LiveDataService);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  readonly health = signal<LiveOpsHealth | null>(null);
  readonly loading = signal<boolean>(true);

  protected readonly healthSeverity = healthSeverity;
  protected readonly healthLabelKey = healthLabelKey;
  protected readonly DeviceHealth = DeviceHealth;
  protected readonly RollupFreshness = RollupFreshness;

  /**
   * The states present, worst first, so the panel reads as a triage list rather
   * than as whatever order the backend's dict happened to serialise in.
   */
  readonly breakdown = computed(() => {
    const current = this.health();
    if (!current) return [];
    const counts = current.by_health ?? {};
    const known = HEALTH_ORDER.filter((state) => (counts[state] ?? 0) > 0).map((state) => ({
      state,
      count: counts[state],
    }));
    // A state this build does not know about still gets a row rather than being
    // dropped: the backend is versioned separately, and silently hiding a new
    // state would hide exactly the devices it was added to describe.
    const extra = Object.keys(counts)
      .filter((state) => !HEALTH_ORDER.includes(state) && counts[state] > 0)
      .map((state) => ({ state, count: counts[state] }));
    return [...known, ...extra];
  });

  readonly attentionCount = computed(() =>
    this.breakdown()
      .filter((entry) => needsAttention(entry.state))
      .reduce((total, entry) => total + entry.count, 0),
  );

  /** `ingest-down`, `all-well`, or no banner at all. See `fleetBanner`. */
  readonly banner = computed(() => fleetBanner(this.health()?.by_health ?? {}));

  /**
   * The backend's verdict, read as a plain string so a state this build does not
   * know falls through to the neutral line rather than to red or to nothing.
   */
  readonly freshness = computed(() => String(this.health()?.rollup_freshness ?? ''));

  /**
   * The minutes the verdict rests on, whole and localised - or null, and then
   * no sentence mentions minutes at all. `!= null` inside `formatMinutes`, never
   * `!== undefined`: a `null` that got through here once rendered as "null".
   */
  lagMinutes(): string | null {
    return formatMinutes(
      this.health()?.rollup_lag_minutes,
      this.translate.getCurrentLang() || 'fr',
    );
  }

  constructor() {
    // Stops once the subscription is switched off; the hub is leaving the route.
    interval(POLL_INTERVAL_MS)
      .pipe(takeUntil(this.service.subscriptionLost$), takeUntilDestroyed())
      .subscribe(() => {
        if (document.hidden) return;
        this.load(true);
      });
  }

  ngOnInit(): void {
    this.load(false);
  }

  load(silent: boolean): void {
    if (!silent) this.loading.set(true);
    this.service
      .opsHealth()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: ApiResponse<LiveOpsHealth>) => {
          this.health.set(response.data);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          if (!silent) {
            this.errorHandler.handleError(extractApiErrorMessage(error));
          }
        },
      });
  }
}
