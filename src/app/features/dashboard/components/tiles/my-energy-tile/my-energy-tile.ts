import { DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { ActiveCommunityStore } from '../../../../../core/services/active-community.store';
import { MeterConsumptionDTO } from '../../../../../shared/dtos/meter.dtos';
import { MePartialMeterDTO } from '../../../../../shared/dtos/me.dtos';
import { MeService } from '../../../../../shared/services/me.service';
import { envelopeData, TileState } from '../../../dashboard-format';
import { DashboardTile } from '../dashboard-tile/dashboard-tile';

/** Days of history summarised. Long enough to be meaningful, short to fetch. */
const WINDOW_DAYS = 30;
/** Meters summarised. A member with more than this gets the totals of the first few. */
const METER_LIMIT = 5;

interface MeterVolumes {
  meter: MePartialMeterDTO;
  consumedKwh: number;
  sharedKwh: number;
}

/**
 * "What did I actually get?" — the member's own meters in THIS community.
 *
 * Deliberately not the same component as the manager's "Energy at a glance":
 * different endpoint (`/me/meters/{ean}/consumptions`, which the server scopes to
 * the reading's ownership window), different unit (one EAN, not an operation),
 * different question.
 *
 * No chart here on purpose. The full interactive chart already exists at
 * `/users/me/meters/{ean}`, so linking to it keeps `chart.js` out of the
 * dashboard bundle entirely rather than deferring a second copy of it.
 */
@Component({
  selector: 'app-my-energy-tile',
  standalone: true,
  imports: [DecimalPipe, TranslatePipe, RouterLink, DashboardTile],
  templateUrl: './my-energy-tile.html',
})
export class MyEnergyTile {
  private readonly meService = inject(MeService);
  private readonly activeCommunity = inject(ActiveCommunityStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly reloadKey = input<number>(0);

  readonly volumes = signal<MeterVolumes[]>([]);
  private readonly failed = signal<boolean>(false);
  private readonly loading = signal<boolean>(true);

  readonly totalConsumed = computed(() =>
    this.volumes().reduce((sum, row) => sum + row.consumedKwh, 0),
  );
  readonly totalShared = computed(() =>
    this.volumes().reduce((sum, row) => sum + row.sharedKwh, 0),
  );

  readonly state = computed<TileState>(() => {
    if (this.loading()) return 'loading';
    if (this.failed()) return 'error';
    return this.volumes().length === 0 ? 'empty' : 'ready';
  });

  readonly windowDays = WINDOW_DAYS;

  constructor() {
    effect(() => {
      this.reloadKey();
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);

    // `/me/meters` is cross-community by design, so the active community has to
    // be filtered client-side — and on the INTERNAL id, not the name, which is
    // only a display value in the token and drifts after a rename.
    forkJoin({
      community: this.activeCommunity.ensureLoaded(),
      meters: this.meService.getMeters({ page: 1, limit: 100 }),
    })
      .pipe(
        switchMap(({ community, meters }) => {
          const all = envelopeData(meters) ?? [];
          const mine = community ? all.filter((m) => m.community.id === community.id) : [];
          const probed = mine.slice(0, METER_LIMIT);
          if (probed.length === 0) return of<MeterVolumes[]>([]);
          return forkJoin(probed.map((meter) => this.volumesFor(meter))).pipe(
            map((rows) => rows.filter((row): row is MeterVolumes => row !== null)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (rows) => {
          this.volumes.set(rows);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  private volumesFor(meter: MePartialMeterDTO) {
    const { start, end } = recentWindow(WINDOW_DAYS);
    return this.meService
      .getMeterConsumptions(meter.EAN, { date_start: start, date_end: end })
      .pipe(
        map((response) => {
          const data = envelopeData<MeterConsumptionDTO>(response);
          if (!data) return null;
          return {
            meter,
            consumedKwh: sum(data.gross),
            sharedKwh: sum(data.shared),
          };
        }),
        // One meter with no readings must not blank the whole tile.
        catchError(() => of<MeterVolumes | null>(null)),
      );
  }
}

function sum(values: number[] | undefined): number {
  return (values ?? []).reduce((total, value) => total + value, 0);
}

/** The last `days` calendar days, as local `YYYY-MM-DD` bounds. */
function recentWindow(days: number): { start: string; end: string } {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
  return { start: iso(from), end: iso(today) };
}

function iso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
