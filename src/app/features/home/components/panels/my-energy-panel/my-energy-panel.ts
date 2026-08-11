import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

import { DashboardTile } from '../../../../dashboard/components/tiles/dashboard-tile/dashboard-tile';
import { TileState } from '../../../../dashboard/dashboard-format';
import { MeEnergyMeterDTO, MeEnergySummaryDTO } from '../../../../../shared/dtos/me.dtos';
import { MeService } from '../../../../../shared/services/me.service';
import { envelopeData } from '../../../home-format';

/**
 * "Mon énergie" — the one number on `/home` a member is likely to care about.
 *
 * A single cross-community call (`GET /me/energy-summary`), not one consumption
 * series per meter: `/me/meters/{ean}/consumptions` has no `limit` and returns
 * seven unbounded quarter-hourly arrays, so composing this client-side would
 * pull thousands of rows to render four numbers on the app's most-loaded page.
 *
 * Deliberately no chart. The member's full interactive one already exists at
 * `/users/me/meters/{ean}`, and linking to it keeps `chart.js` out of the
 * landing chunk entirely rather than deferring a second copy of it.
 */
@Component({
  selector: 'app-my-energy-panel',
  standalone: true,
  imports: [TranslatePipe, RouterLink, DecimalPipe, DashboardTile],
  templateUrl: './my-energy-panel.html',
})
export class MyEnergyPanel {
  private readonly meService = inject(MeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly summary = signal<MeEnergySummaryDTO | null>(null);
  private readonly failed = signal<boolean>(false);
  private readonly loading = signal<boolean>(true);

  readonly state = computed<TileState>(() => {
    if (this.loading()) return 'loading';
    if (this.failed()) return 'error';
    return (this.summary()?.meters.length ?? 0) === 0 ? 'empty' : 'ready';
  });

  /** Meters that actually reported. See `has_data` — an absent reading is not zero. */
  readonly meters = computed<MeEnergyMeterDTO[]>(() => this.summary()?.meters ?? []);

  readonly totals = computed(() => this.summary()?.totals ?? null);

  /**
   * The month, as `YYYY-MM`, for the heading.
   *
   * Sliced off the period rather than formatted from a `Date`: a bare
   * `YYYY-MM-DD` put through `| date` parses as UTC midnight and can render as
   * the previous month in a negative offset.
   */
  readonly monthKey = computed(() => {
    const start = this.summary()?.period.start;
    return start ? `HOME.MONTHS.${start.slice(5, 7)}` : null;
  });

  readonly year = computed(() => this.summary()?.period.start.slice(0, 4) ?? '');

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.meService
      .getEnergySummary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const data = envelopeData<MeEnergySummaryDTO>(response);
          if (!data) this.failed.set(true);
          else this.summary.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }
}
