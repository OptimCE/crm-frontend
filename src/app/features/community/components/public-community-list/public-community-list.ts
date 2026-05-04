import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { AutoComplete, AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PublicCommunityDTO } from '../../../../shared/dtos/community.dtos';
import {
  SharingOperationPartialDTO,
  SharingOperationPartialQuery,
} from '../../../../shared/dtos/sharing_operation.dtos';
import { MunicipalityPartialDTO } from '../../../../shared/dtos/municipality.dtos';
import { CommunityService } from '../../../../shared/services/community.service';
import { MunicipalityService } from '../../../../shared/services/municipality.service';
import { SharingOperationType } from '../../../../shared/types/sharing_operation.types';
import { HeaderPage } from '../../../../layout/header-page/header-page';

@Component({
  selector: 'app-public-community-list',
  standalone: true,
  imports: [TagModule, AutoComplete, FormsModule, TranslatePipe, HeaderPage],
  templateUrl: './public-community-list.html',
  styleUrl: './public-community-list.css',
})
export class PublicCommunityList {
  private communityService = inject(CommunityService);
  private municipalityService = inject(MunicipalityService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  communities = signal<PublicCommunityDTO[]>([]);
  /**
   * Per-community state for the lazily-loaded public sharing operations list.
   * Map missing → not loaded yet; empty array → loaded, none returned.
   */
  publicOperations = signal<Map<number, SharingOperationPartialDTO[]>>(new Map());
  loadingOperations = signal<Set<number>>(new Set());
  expandedCommunityId = signal<number | null>(null);
  brokenLogos = signal<Set<number>>(new Set());

  /** Active municipality filter applied to every community's operations fetch. */
  selectedMunicipalities = signal<MunicipalityPartialDTO[]>([]);
  municipalitySuggestions = signal<MunicipalityPartialDTO[]>([]);

  readonly SharingOperationType = SharingOperationType;

  onLogoError(communityId: number): void {
    const updated = new Set(this.brokenLogos());
    updated.add(communityId);
    this.brokenLogos.set(updated);
  }

  hasValidLogo(community: PublicCommunityDTO): boolean {
    return !!community.logo_url && !this.brokenLogos().has(community.id);
  }

  constructor() {
    this.loadPublicCommunities();
  }

  private loadPublicCommunities(): void {
    this.communityService
      .getPublicCommunities({ page: 1, limit: 10 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => {
        if (response) {
          this.communities.set(response.data as PublicCommunityDTO[]);
        }
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
