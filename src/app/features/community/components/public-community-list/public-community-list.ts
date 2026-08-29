import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { AutoComplete, AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { Select } from 'primeng/select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  CommunityDetailDTO,
  CommunityQueryDTO,
  PublicCommunityDTO,
} from '../../../../shared/dtos/community.dtos';
import {
  SharingOperationPartialDTO,
  SharingOperationPartialQuery,
} from '../../../../shared/dtos/sharing_operation.dtos';
import { MunicipalityPartialDTO } from '../../../../shared/dtos/municipality.dtos';
import { CommunityService } from '../../../../shared/services/community.service';
import { MunicipalityService } from '../../../../shared/services/municipality.service';
import { RegulatorStore } from '../../../../core/services/regulator.store';
import { SharingOperationType } from '../../../../shared/types/sharing_operation.types';
import { HeaderPage } from '../../../../layout/header-page/header-page';
import { CommunityLogo } from '../../../../shared/components/community-logo/community-logo';
import { ViewToggle } from '../../../../shared/components/view-toggle/view-toggle';
import { CommunityMap } from './community-map/community-map';
import type { MapViewMode } from '../../../../shared/components/map/map.types';

@Component({
  selector: 'app-public-community-list',
  standalone: true,
  imports: [
    TagModule,
    AutoComplete,
    Select,
    FormsModule,
    TranslatePipe,
    HeaderPage,
    CommunityLogo,
    ViewToggle,
    CommunityMap,
  ],
  templateUrl: './public-community-list.html',
  styleUrl: './public-community-list.css',
})
export class PublicCommunityList {
  private communityService = inject(CommunityService);
  private municipalityService = inject(MunicipalityService);
  private regulatorStore = inject(RegulatorStore);
  private translate = inject(TranslateService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  communities = signal<PublicCommunityDTO[]>([]);
  /** Active regulator options (localized) + the current filter value (null = all). */
  regulatorOptions = signal<{ code: string; label: string }[]>([]);
  selectedRegulator = signal<string | null>(null);
  /**
   * Per-community state for the lazily-loaded public sharing operations list.
   * Map missing → not loaded yet; empty array → loaded, none returned.
   */
  publicOperations = signal<Map<number, SharingOperationPartialDTO[]>>(new Map());
  loadingOperations = signal<Set<number>>(new Set());
  /** Per-community detail (description, website, HQ address) lazy-loaded on expand. */
  communityDetails = signal<Map<number, CommunityDetailDTO>>(new Map());
  loadingDetails = signal<Set<number>>(new Set());
  expandedCommunityId = signal<number | null>(null);

  /** Active municipality filter applied to every community's operations fetch. */
  selectedMunicipalities = signal<MunicipalityPartialDTO[]>([]);
  municipalitySuggestions = signal<MunicipalityPartialDTO[]>([]);

  readonly SharingOperationType = SharingOperationType;

  /** List or map, mirrored in `?view=` so a map link can be shared. */
  readonly view = signal<MapViewMode>('list');

  /** NIS codes of the municipality filter, narrowed client-side on the map. */
  readonly selectedNisCodes = computed(() => this.selectedMunicipalities().map((m) => m.nis_code));

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.view.set(params.get('view') === 'map' ? 'map' : 'list');
    });

    this.loadPublicCommunities();
    this.regulatorStore
      .ensureLoaded()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.buildRegulatorOptions());
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.buildRegulatorOptions());
  }

  private buildRegulatorOptions(): void {
    this.regulatorOptions.set(
      this.regulatorStore.activeRegulators().map((r) => ({
        code: r.code,
        label: this.translate.instant('REGULATORS.' + r.code) as string,
      })),
    );
  }

  setView(next: MapViewMode): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      // null removes the param entirely for the default view, so a shared
      // /communities/public link stays clean.
      queryParams: { view: next === 'map' ? 'map' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onRegulatorChange(code: string | null): void {
    this.selectedRegulator.set(code ?? null);
    // Reset per-community caches so expanded panels refetch, then reload the list.
    this.publicOperations.set(new Map());
    this.loadingOperations.set(new Set());
    this.communityDetails.set(new Map());
    this.expandedCommunityId.set(null);
    this.loadPublicCommunities();
  }

  private loadPublicCommunities(): void {
    const query: CommunityQueryDTO = { page: 1, limit: 10 };
    const regulator = this.selectedRegulator();
    if (regulator) {
      query.regulator = regulator;
    }
    this.communityService
      .getPublicCommunities(query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => {
        if (response) {
          this.communities.set(response.data as PublicCommunityDTO[]);
        }
      });
  }

  private loadCommunityDetail(communityId: number): void {
    if (this.communityDetails().has(communityId) || this.loadingDetails().has(communityId)) {
      return;
    }
    const loadingNext = new Set(this.loadingDetails());
    loadingNext.add(communityId);
    this.loadingDetails.set(loadingNext);

    this.communityService
      .getCommunityDetail(communityId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response?.data) {
            const next = new Map(this.communityDetails());
            next.set(communityId, response.data);
            this.communityDetails.set(next);
          }
          const stillLoading = new Set(this.loadingDetails());
          stillLoading.delete(communityId);
          this.loadingDetails.set(stillLoading);
        },
        error: () => {
          const stillLoading = new Set(this.loadingDetails());
          stillLoading.delete(communityId);
          this.loadingDetails.set(stillLoading);
        },
      });
  }

  private loadCommunityPublicSharingOperations(communityId: number): void {
    if (this.publicOperations().has(communityId) || this.loadingOperations().has(communityId)) {
      return;
    }
    const loadingNext = new Set(this.loadingOperations());
    loadingNext.add(communityId);
    this.loadingOperations.set(loadingNext);

    this.communityService
      .getCommunityPublicSharingOperations(communityId, this.buildOperationsQuery())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const ops = (response?.data as SharingOperationPartialDTO[]) ?? [];
          const next = new Map(this.publicOperations());
          next.set(communityId, ops);
          this.publicOperations.set(next);
          const stillLoading = new Set(this.loadingOperations());
          stillLoading.delete(communityId);
          this.loadingOperations.set(stillLoading);
        },
        error: () => {
          const next = new Map(this.publicOperations());
          next.set(communityId, []);
          this.publicOperations.set(next);
          const stillLoading = new Set(this.loadingOperations());
          stillLoading.delete(communityId);
          this.loadingOperations.set(stillLoading);
        },
      });
  }

  private buildOperationsQuery(): SharingOperationPartialQuery {
    const query: SharingOperationPartialQuery = { page: 1, limit: 50 };
    const codes = this.selectedMunicipalities().map((m) => m.nis_code);
    if (codes.length > 0) {
      query.municipality_nis_codes = codes;
    }
    return query;
  }

  searchMunicipalities(event: AutoCompleteCompleteEvent): void {
    const term = (event.query ?? '').trim();
    this.municipalityService
      .searchMunicipalities({ page: 1, limit: 20, name: term || undefined })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const items = (response?.data as MunicipalityPartialDTO[]) ?? [];
          const selectedCodes = new Set(this.selectedMunicipalities().map((m) => m.nis_code));
          this.municipalitySuggestions.set(items.filter((m) => !selectedCodes.has(m.nis_code)));
        },
        error: () => {
          this.municipalitySuggestions.set([]);
        },
      });
  }

  onMunicipalitiesChange(next: MunicipalityPartialDTO[]): void {
    this.selectedMunicipalities.set(next ?? []);
    // Drop the per-community cache so collapsed accordions refetch on next expand,
    // and clear loading flags so an in-progress refresh doesn't block the new one.
    this.publicOperations.set(new Map());
    this.loadingOperations.set(new Set());
    const expanded = this.expandedCommunityId();
    if (expanded !== null) {
      this.loadCommunityPublicSharingOperations(expanded);
    }
  }

  toggleAccordion(communityId: number): void {
    if (this.expandedCommunityId() === communityId) {
      this.expandedCommunityId.set(null);
    } else {
      this.expandedCommunityId.set(communityId);
      this.loadCommunityDetail(communityId);
      this.loadCommunityPublicSharingOperations(communityId);
    }
  }

  isExpanded(communityId: number): boolean {
    return this.expandedCommunityId() === communityId;
  }

  getOperations(id: number): SharingOperationPartialDTO[] | undefined {
    return this.publicOperations().get(id);
  }

  isLoading(id: number): boolean {
    return this.loadingOperations().has(id);
  }

  getDetail(id: number): CommunityDetailDTO | undefined {
    return this.communityDetails().get(id);
  }

  isLoadingDetail(id: number): boolean {
    return this.loadingDetails().has(id);
  }

  /**
   * Localized municipality name. Falls back across fr → nl → de → "—".
   * Picks based on the active i18next/ngx-translate language.
   */
  municipalityName(m: MunicipalityPartialDTO): string {
    const lang = this.translate.currentLang || this.translate.defaultLang || 'fr';
    if (lang.startsWith('nl') && m.nl_name) return m.nl_name;
    if (lang.startsWith('de') && m.de_name) return m.de_name;
    return m.fr_name || m.nl_name || m.de_name || '—';
  }

  typeIcon(type: SharingOperationType): string {
    switch (type) {
      case SharingOperationType.LOCAL:
        return 'pi pi-home';
      case SharingOperationType.CER:
        return 'pi pi-sitemap';
      case SharingOperationType.CEC:
        return 'pi pi-globe';
      default:
        return 'pi pi-bolt';
    }
  }

  typeLabelKey(type: SharingOperationType): string {
    switch (type) {
      case SharingOperationType.LOCAL:
        return 'SHARING_OPERATION.TYPE.INSIDE_BUILDING';
      case SharingOperationType.CER:
        return 'SHARING_OPERATION.TYPE.CER';
      case SharingOperationType.CEC:
        return 'SHARING_OPERATION.TYPE.CEC';
      default:
        return '';
    }
  }
}
