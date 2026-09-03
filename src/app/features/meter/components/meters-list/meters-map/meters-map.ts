import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { MapCanvas } from '../../../../../shared/components/map/map-canvas';
import type { MapPoint } from '../../../../../shared/components/map/map.types';
import { MeterService } from '../../../../../shared/services/meter.service';
import { MeService } from '../../../../../shared/services/me.service';
import type {
  MeterMapDTO,
  MeterMapPointDTO,
  MeterMapQuery,
} from '../../../../../shared/dtos/meter.dtos';
import { MeterDataStatus } from '../../../../../shared/types/meter.types';
import { DialogService } from 'primeng/dynamicdialog';
import { Button } from 'primeng/button';
import { TranslateService } from '@ngx-translate/core';
import { UnlocatedMeters } from '../unlocated-meters/unlocated-meters';

/**
 * The map half of a meters list.
 *
 * Lives in its own component file so `maplibre-gl` and MapCanvas land in their
 * own chunk, exactly as meter-consumption-chart does for chart.js.
 *
 * `scope` picks the endpoint rather than the caller passing a fetcher: the two
 * differ only in which service they call and whether points carry a community
 * name, and a boolean here is far less machinery than an injected strategy.
 */
@Component({
  selector: 'app-meters-map',
  standalone: true,
  imports: [MapCanvas, TranslatePipe, Button],
  templateUrl: './meters-map.html',
  styleUrl: './meters-map.css',
  providers: [DialogService],
})
export class MetersMap {
  /** Filters, mirroring the list. Changing them refetches. */
  readonly query = input<MeterMapQuery>({});
  /** `community` = manager view of /meters; `me` = a member's own meters. */
  readonly scope = input<'community' | 'me'>('community');
  /**
   * Offer the repair dialog from the "N meters have no coordinates yet" strip.
   *
   * Off by default, and left off for the sharing-operation and member views: a
   * member cannot edit community meters, and the operation map is a read-only
   * perimeter view.
   */
  readonly canRepair = input(false);

  private readonly meterService = inject(MeterService);
  private readonly dialogService = inject(DialogService);
  private readonly translate = inject(TranslateService);
  private readonly meService = inject(MeService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly result = signal<MeterMapDTO | null>(null);

  protected readonly points = computed<MapPoint[]>(() =>
    (this.result()?.points ?? []).map((point) => toMapPoint(point)),
  );

  protected readonly missing = computed(() => this.result()?.missing_coordinates ?? 0);
  protected readonly approximate = computed(() => this.result()?.approximate ?? 0);
  /**
   * Everything the repair flow can improve: absent coordinates AND commune
   * centroids. The strip counts the same population the dialog lists, so the
   * number visibly drops as an operator works through it.
   */
  protected readonly needsAttention = computed(() => this.missing() + this.approximate());
  protected readonly truncated = computed(() => this.result()?.truncated ?? false);
  protected readonly cap = computed(() => this.result()?.cap ?? 0);
  protected readonly plotted = computed(() => this.result()?.points.length ?? 0);
  protected readonly total = computed(() => this.result()?.total_matching ?? 0);
  protected readonly isEmpty = computed(() => !this.loading() && this.points().length === 0);

  /**
   * One click from the map to a fixable address.
   *
   * The map's own filters are handed to the dialog: `missing_coordinates` is
   * computed over them, so a dialog that ignored them would fix meters that
   * were never on screen and the visible number would not move.
   */
  protected openRepair(): void {
    const ref = this.dialogService.open(UnlocatedMeters, {
      header: this.translate.instant('MAP.REPAIR.TITLE') as string,
      width: '60rem',
      modal: true,
      dismissableMask: true,
      data: { query: this.query() },
    });
    ref?.onClose.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((repaired?: boolean) => {
      if (repaired) {
        // Straight to fetch, not through the effect: `query` has not changed, so
        // the keyed guard would treat this as a duplicate and skip it — and the
        // whole point is that the DATA behind that unchanged query has moved.
        this.fetch(this.query());
      }
    });
  }

  /**
   * Refetch key. The parent rebuilds the `query` object on every change
   * detection pass, so identity is useless here — the serialised filters are
   * what actually distinguishes one request from another.
   */
  private lastKey = '';

  constructor() {
    effect(() => {
      const query = this.query();
      const key = `${this.scope()}|${JSON.stringify(query)}`;
      if (key === this.lastKey) {
        return;
      }
      this.lastKey = key;
      this.fetch(query);
    });
  }

  private fetch(query: MeterMapQuery): void {
    this.loading.set(true);
    this.failed.set(false);

    const request$ =
      this.scope() === 'me'
        ? this.meService.getMetersMap(query)
        : this.meterService.getMetersMap(query);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        const data = response?.data;
        this.result.set(typeof data === 'object' && data !== null ? data : null);
        this.loading.set(false);
      },
      error: () => {
        this.result.set(null);
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }
}

/** Severity ranks for the pin colour. 0 healthy, 1 needs attention, 2 problem. */
const STATUS_RANK: Record<MeterDataStatus, number> = {
  [MeterDataStatus.ACTIVE]: 0,
  [MeterDataStatus.WAITING_GRD]: 1,
  [MeterDataStatus.WAITING_MANAGER]: 1,
  [MeterDataStatus.INACTIVE]: 2,
};

const STATUS_LABEL: Record<
  MeterDataStatus,
  { labelKey: string; severity: 'success' | 'warn' | 'danger' }
> = {
  [MeterDataStatus.ACTIVE]: { labelKey: 'METER.STATUS.ACTIVE_LABEL', severity: 'success' },
  [MeterDataStatus.INACTIVE]: { labelKey: 'METER.STATUS.INACTIVE_LABEL', severity: 'danger' },
  [MeterDataStatus.WAITING_GRD]: { labelKey: 'METER.STATUS.WAITING_GRD_LABEL', severity: 'warn' },
  [MeterDataStatus.WAITING_MANAGER]: {
    labelKey: 'METER.STATUS.WAITING_MANAGER_LABEL',
    severity: 'warn',
  },
};

/**
 * Maps a meter onto the map's feature-agnostic point shape.
 *
 * `routerLink` is ABSOLUTE: the popup component is created with the environment
 * injector, so a relative link would resolve against the root route rather than
 * against /meters.
 */
function toMapPoint(point: MeterMapPointDTO): MapPoint {
  const status = STATUS_LABEL[point.status];
  return {
    id: point.EAN,
    lat: point.latitude,
    lng: point.longitude,
    precision: point.geo_precision,
    rank: STATUS_RANK[point.status] ?? 0,
    title: point.EAN,
    fields: [
      { labelKey: 'MAP.POPUP.HOLDER', value: point.holder_name ?? '—' },
      { labelKey: 'MAP.POPUP.OPERATION', value: point.sharing_operation_name ?? '—' },
      ...(point.community_name
        ? [{ labelKey: 'MAP.POPUP.COMMUNITY', value: point.community_name }]
        : []),
    ],
    badges: status ? [status] : [],
    routerLink: `/meters/${point.EAN}`,
  };
}
