import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin, of } from 'rxjs';
import { MapCanvas } from '../../../../../shared/components/map/map-canvas';
import type { MapZone } from '../../../../../shared/components/map/map.types';
import { CommunityService } from '../../../../../shared/services/community.service';
import { MunicipalityService } from '../../../../../shared/services/municipality.service';
import type { PublicCommunityMapDTO } from '../../../../../shared/dtos/community.dtos';
import type { MunicipalityGeometryDTO } from '../../../../../shared/dtos/municipality.dtos';

/**
 * The map half of the public community directory.
 *
 * A community's zone is the union of the communes its PUBLIC sharing operations
 * cover — the perimeter is regulated per commune, so that union is the real
 * answer, and it exposes no member address.
 *
 * Geometry is fetched separately from the community list because several
 * communities routinely share a commune: fetched per commune it is downloaded
 * once and drawn many times, whereas inlining it per community would repeat the
 * same polygon in the payload.
 */
@Component({
  selector: 'app-community-map',
  standalone: true,
  imports: [MapCanvas, TranslatePipe],
  templateUrl: './community-map.html',
  styleUrl: './community-map.css',
})
export class CommunityMap {
  /** Regulator code, applied server-side. Null = all. */
  readonly regulator = input<string | null>(null);
  /** NIS codes to narrow to, applied client-side over data already in hand. */
  readonly municipalityNisCodes = input<readonly number[]>([]);

  private readonly communityService = inject(CommunityService);
  private readonly municipalityService = inject(MunicipalityService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  private readonly communities = signal<PublicCommunityMapDTO[]>([]);
  private readonly geometries = signal<Map<number, MunicipalityGeometryDTO>>(new Map());

  protected readonly zones = computed<MapZone[]>(() => {
    const selected = new Set(this.municipalityNisCodes());
    const geometries = this.geometries();
    const zones: MapZone[] = [];

    for (const community of this.communities()) {
      const codes =
        selected.size > 0
          ? community.nis_codes.filter((code) => selected.has(code))
          : community.nis_codes;
      if (selected.size > 0 && codes.length === 0) {
        continue;
      }
      for (const code of codes) {
        const geometry = geometries.get(code)?.geo_shape;
        if (!geometry) {
          continue;
        }
        zones.push({
          id: `${String(community.id)}:${String(code)}`,
          // Communities covering the same commune share this key, so they
          // collapse into one badge with a multi-entry popup.
          groupKey: String(code),
          colorKey: String(community.id),
          geometry,
          title: community.name,
          fields: [
            { labelKey: 'MAP.POPUP.REGULATOR', value: this.regulatorLabel(community.regulator) },
            { labelKey: 'MAP.POPUP.MUNICIPALITIES', value: this.municipalityName(code) },
          ],
          routerLink: '/communities/public',
        });
      }
    }
    return zones;
  });

  protected readonly isEmpty = computed(() => !this.loading() && this.zones().length === 0);
  protected readonly communityCount = computed(
    () => new Set(this.zones().map((zone) => zone.colorKey)).size,
  );

  private lastRegulator: string | null | undefined = undefined;

  constructor() {
    effect(() => {
      const regulator = this.regulator();
      if (regulator === this.lastRegulator) {
        return;
      }
      this.lastRegulator = regulator;
      this.fetch(regulator);
    });
  }

  private fetch(regulator: string | null): void {
    this.loading.set(true);
    this.failed.set(false);

    this.communityService
      .getPublicCommunityMap(regulator ? { regulator } : {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const data = Array.isArray(response?.data) ? response.data : [];
          this.communities.set(data);
          this.loadGeometries(data);
        },
        error: () => {
          this.communities.set([]);
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  private loadGeometries(communities: readonly PublicCommunityMapDTO[]): void {
    const codes = [...new Set(communities.flatMap((community) => community.nis_codes))];
    if (codes.length === 0) {
      this.geometries.set(new Map());
      this.loading.set(false);
      return;
    }

    forkJoin([this.municipalityService.getGeometries(codes), of(null)])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ([rows]) => {
          this.geometries.set(new Map(rows.map((row) => [row.nis_code, row])));
          this.loading.set(false);
        },
        error: () => {
          // The communities loaded but their outlines did not: fail visibly
          // rather than drawing an empty map that looks like "no communities".
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  private municipalityName(nisCode: number): string {
    return this.geometries().get(nisCode)?.fr_name ?? String(nisCode);
  }

  /** Regulator codes are translated under REGULATORS.*, same as the list view. */
  private regulatorLabel(code: string): string {
    return this.translate.instant('REGULATORS.' + code) as string;
  }
}
