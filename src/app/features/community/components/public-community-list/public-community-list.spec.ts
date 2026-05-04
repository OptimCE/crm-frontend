import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { of, NEVER, throwError } from 'rxjs';
import { PublicCommunityList } from './public-community-list';
import { CommunityService } from '../../../../shared/services/community.service';
import { MunicipalityService } from '../../../../shared/services/municipality.service';
import { PublicCommunityDTO } from '../../../../shared/dtos/community.dtos';
import {
  SharingOperationPartialDTO,
  SharingOperationPartialQuery,
} from '../../../../shared/dtos/sharing_operation.dtos';
import { MunicipalityPartialDTO } from '../../../../shared/dtos/municipality.dtos';
import { SharingOperationType } from '../../../../shared/types/sharing_operation.types';
import { ApiResponsePaginated, Pagination } from '../../../../core/dtos/api.response';

function buildCommunities(): PublicCommunityDTO[] {
  return [
    { id: 1, name: 'Alpha Community', logo_url: 'https://example.com/alpha.png' },
    { id: 2, name: 'Beta Community', logo_url: null },
    { id: 3, name: 'Gamma Community', logo_url: 'https://example.com/gamma.png' },
  ];
}

function buildMunicipality(
  nis_code: number,
  overrides: Partial<MunicipalityPartialDTO> = {},
): MunicipalityPartialDTO {
  return {
    nis_code,
    fr_name: `Ville-${nis_code}`,
    nl_name: null,
    de_name: null,
    region_fr: null,
    postal_codes: [],
    ...overrides,
  };
}

function buildOps(): SharingOperationPartialDTO[] {
  return [
    {
      id: 10,
      name: 'Op One',
      type: SharingOperationType.LOCAL,
      municipalities: [buildMunicipality(11001, { fr_name: 'Bruxelles' })],
    },
    {
      id: 11,
      name: 'Op Two',
      type: SharingOperationType.CER,
      municipalities: [],
    },
  ];
}

function buildPaginatedResponse<T>(
  data: T[] = [],
  pagination: Pagination = new Pagination(1, 10, data.length, 1),
): ApiResponsePaginated<T[] | string> {
  return new ApiResponsePaginated<T[] | string>(data, pagination);
}

describe('PublicCommunityList', () => {
  let component: PublicCommunityList;
  let fixture: ComponentFixture<PublicCommunityList>;
  let el: HTMLElement;
  let communityServiceSpy: {
    getPublicCommunities: ReturnType<typeof vi.fn>;
    getCommunityPublicSharingOperations: ReturnType<typeof vi.fn>;
  };
  let municipalityServiceSpy: {
    searchMunicipalities: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    communityServiceSpy = {
      getPublicCommunities: vi.fn().mockReturnValue(of(buildPaginatedResponse(buildCommunities()))),
      getCommunityPublicSharingOperations: vi
        .fn()
        .mockReturnValue(of(buildPaginatedResponse(buildOps()))),
    };
    municipalityServiceSpy = {
      searchMunicipalities: vi
        .fn()
        .mockReturnValue(of(buildPaginatedResponse<MunicipalityPartialDTO>([]))),
    };

    await TestBed.configureTestingModule({
      imports: [PublicCommunityList, TranslateModule.forRoot()],
      providers: [
        { provide: CommunityService, useValue: communityServiceSpy },
        { provide: MunicipalityService, useValue: municipalityServiceSpy },
      ],
    })
      .overrideComponent(PublicCommunityList, {
        set: { schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PublicCommunityList);
    component = fixture.componentInstance;
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  // ── Creation & loading ──────────────────────────────────────────────

  describe('creation & loading', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should call getPublicCommunities on init', () => {
      expect(communityServiceSpy.getPublicCommunities).toHaveBeenCalledWith({ page: 1, limit: 10 });
    });

    it('should populate the communities signal from the response', () => {
      expect(component.communities().length).toBe(3);
      expect(component.communities()[0].name).toBe('Alpha Community');
    });

    it('should handle null response gracefully', async () => {
      communityServiceSpy.getPublicCommunities.mockReturnValue(of(null));

      const f = TestBed.createComponent(PublicCommunityList);
      f.detectChanges();
      await f.whenStable();

      expect(f.componentInstance.communities().length).toBe(0);
    });
  });

  // ── Empty state ─────────────────────────────────────────────────────

  describe('empty state', () => {
    beforeEach(async () => {
      communityServiceSpy.getPublicCommunities.mockReturnValue(of(buildPaginatedResponse([])));

      fixture = TestBed.createComponent(PublicCommunityList);
      component = fixture.componentInstance;
      el = fixture.nativeElement as HTMLElement;
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should show the empty message when there are no communities', () => {
      const emptyMsg = el.querySelector('.pi-address-book.text-3xl');
      expect(emptyMsg).toBeTruthy();
    });

    it('should not show community cards', () => {
      const cards = el.querySelectorAll('.accordion-header');
      expect(cards.length).toBe(0);
    });
  });

  // ── Community list rendering ────────────────────────────────────────

  describe('community list rendering', () => {
    it('should render a card for each community', () => {
      const buttons = el.querySelectorAll('.accordion-header');
      expect(buttons.length).toBe(3);
    });

    it('should display community names', () => {
      const buttons = el.querySelectorAll('.accordion-header');
      expect(buttons[0].textContent).toContain('Alpha Community');
      expect(buttons[1].textContent).toContain('Beta Community');
      expect(buttons[2].textContent).toContain('Gamma Community');
    });

    it('should not show the empty message when communities exist', () => {
      const emptyIcon = el.querySelector('.pi-globe.text-3xl');
      expect(emptyIcon).toBeFalsy();
    });
  });

  // ── Logo handling ───────────────────────────────────────────────────

  describe('logo handling', () => {
    it('hasValidLogo returns true when logo_url exists and is not broken', () => {
      const community = buildCommunities()[0]; // has logo_url
      expect(component.hasValidLogo(community)).toBe(true);
    });

    it('hasValidLogo returns false when logo_url is null', () => {
      const community = buildCommunities()[1]; // logo_url is null
      expect(component.hasValidLogo(community)).toBe(false);
    });

    it('hasValidLogo returns false after onLogoError marks it broken', () => {
      const community = buildCommunities()[0];
      expect(component.hasValidLogo(community)).toBe(true);

      component.onLogoError(community.id);

      expect(component.hasValidLogo(community)).toBe(false);
    });

    it('onLogoError adds the community id to brokenLogos', () => {
      expect(component.brokenLogos().has(5)).toBe(false);

      component.onLogoError(5);

      expect(component.brokenLogos().has(5)).toBe(true);
    });

    it('onLogoError preserves previously broken ids', () => {
      component.onLogoError(1);
      component.onLogoError(2);

      expect(component.brokenLogos().has(1)).toBe(true);
      expect(component.brokenLogos().has(2)).toBe(true);
    });

    it('should render an img element for communities with valid logos', () => {
      const imgs = el.querySelectorAll('.accordion-header img');
      expect(imgs.length).toBe(2); // communities 1 and 3 have logos
    });

    it('should render a fallback icon for communities without logos', () => {
      const fallbacks = el.querySelectorAll('.accordion-header .pi-building');
      expect(fallbacks.length).toBe(1); // community 2 has null logo
    });
  });

  // ── Accordion toggle ────────────────────────────────────────────────

  describe('accordion toggle', () => {
    it('toggleAccordion expands a community', () => {
      component.toggleAccordion(1);
      expect(component.expandedCommunityId()).toBe(1);
    });

    it('toggleAccordion collapses when toggling the same community', () => {
      component.toggleAccordion(1);
      expect(component.expandedCommunityId()).toBe(1);

      component.toggleAccordion(1);
      expect(component.expandedCommunityId()).toBeNull();
    });

    it('toggleAccordion switches to a new community', () => {
      component.toggleAccordion(1);
      expect(component.expandedCommunityId()).toBe(1);

      component.toggleAccordion(2);
      expect(component.expandedCommunityId()).toBe(2);
    });

    it('isExpanded returns true only for the expanded community', () => {
      component.toggleAccordion(2);

      expect(component.isExpanded(2)).toBe(true);
      expect(component.isExpanded(1)).toBe(false);
      expect(component.isExpanded(3)).toBe(false);
    });

    it('expanding a community calls getCommunityPublicSharingOperations', () => {
      communityServiceSpy.getCommunityPublicSharingOperations.mockClear();
      component.toggleAccordion(1);

      expect(communityServiceSpy.getCommunityPublicSharingOperations).toHaveBeenCalledWith(1, {
        page: 1,
        limit: 50,
      });
    });

    it('collapsing a community does not call getCommunityPublicSharingOperations', () => {
      component.toggleAccordion(1);
      communityServiceSpy.getCommunityPublicSharingOperations.mockClear();

      component.toggleAccordion(1); // collapse
      expect(communityServiceSpy.getCommunityPublicSharingOperations).not.toHaveBeenCalled();
    });

    it('clicking the accordion button toggles expansion', () => {
      const buttons = el.querySelectorAll<HTMLButtonElement>('.accordion-header');
      buttons[0].click();
      fixture.detectChanges();

      expect(component.expandedCommunityId()).toBe(1);

      buttons[0].click();
      fixture.detectChanges();

      expect(component.expandedCommunityId()).toBeNull();
    });
  });

  // ── Public sharing operations loading ───────────────────────────────

  describe('public sharing operations loading', () => {
    it('marks the community as loading while the request is pending', () => {
      communityServiceSpy.getCommunityPublicSharingOperations.mockReturnValue(NEVER);

      component.toggleAccordion(1);

      expect(component.isLoading(1)).toBe(true);
      expect(component.getOperations(1)).toBeUndefined();
    });

    it('populates publicOperations and clears loading on success', () => {
      component.toggleAccordion(1);

      expect(component.isLoading(1)).toBe(false);
      const ops = component.getOperations(1);
      expect(ops).toBeDefined();
      expect(ops?.length).toBe(2);
      expect(ops?.[0].name).toBe('Op One');
    });

    it('falls back to an empty array on error', () => {
      communityServiceSpy.getCommunityPublicSharingOperations.mockReturnValue(
        throwError(() => new Error('boom')),
      );

      component.toggleAccordion(2);

      expect(component.isLoading(2)).toBe(false);
      expect(component.getOperations(2)).toEqual([]);
    });

    it('falls back to an empty array when response.data is missing', () => {
      communityServiceSpy.getCommunityPublicSharingOperations.mockReturnValue(of(null));

      component.toggleAccordion(3);

      expect(component.getOperations(3)).toEqual([]);
    });

    it('does not refetch when the same community is re-expanded', () => {
      component.toggleAccordion(1); // first expand → fetches
      communityServiceSpy.getCommunityPublicSharingOperations.mockClear();

      component.toggleAccordion(1); // collapse
      component.toggleAccordion(1); // expand again

      expect(communityServiceSpy.getCommunityPublicSharingOperations).not.toHaveBeenCalled();
    });

    it('fetches when a different community is expanded', () => {
      component.toggleAccordion(1);
      communityServiceSpy.getCommunityPublicSharingOperations.mockClear();

      component.toggleAccordion(2);

      expect(communityServiceSpy.getCommunityPublicSharingOperations).toHaveBeenCalledWith(2, {
        page: 1,
        limit: 50,
      });
    });
  });

  // ── Municipality filter ─────────────────────────────────────────────

  describe('municipality filter', () => {
    it('searchMunicipalities calls the service with the trimmed query', () => {
      component.searchMunicipalities({ query: '  Brux  ' } as never);

      expect(municipalityServiceSpy.searchMunicipalities).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        name: 'Brux',
      });
    });

    it('searchMunicipalities passes name as undefined when query is empty', () => {
      component.searchMunicipalities({ query: '   ' } as never);

      expect(municipalityServiceSpy.searchMunicipalities).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        name: undefined,
      });
    });

    it('searchMunicipalities filters out already selected entries by nis_code', () => {
      const m1 = buildMunicipality(1);
      const m2 = buildMunicipality(2);
      const m3 = buildMunicipality(3);
      component.selectedMunicipalities.set([m2]);
      municipalityServiceSpy.searchMunicipalities.mockReturnValue(
        of(buildPaginatedResponse([m1, m2, m3])),
      );

      component.searchMunicipalities({ query: '' } as never);

      expect(component.municipalitySuggestions().map((m) => m.nis_code)).toEqual([1, 3]);
    });

    it('searchMunicipalities clears suggestions on error', () => {
      component.municipalitySuggestions.set([buildMunicipality(99)]);
      municipalityServiceSpy.searchMunicipalities.mockReturnValue(
        throwError(() => new Error('net')),
      );

      component.searchMunicipalities({ query: 'x' } as never);

      expect(component.municipalitySuggestions()).toEqual([]);
    });

    it('onMunicipalitiesChange replaces selectedMunicipalities and clears caches', () => {
      const m1 = buildMunicipality(1);
      // Prime caches as if a community had been expanded already
      component.publicOperations.set(new Map([[1, buildOps()]]));
      component.loadingOperations.set(new Set([2]));
      component.expandedCommunityId.set(null);

      component.onMunicipalitiesChange([m1]);

      expect(component.selectedMunicipalities()).toEqual([m1]);
      expect(component.publicOperations().size).toBe(0);
      expect(component.loadingOperations().size).toBe(0);
    });

    it('onMunicipalitiesChange treats null/undefined as an empty selection', () => {
      component.selectedMunicipalities.set([buildMunicipality(1)]);

      component.onMunicipalitiesChange(null as unknown as MunicipalityPartialDTO[]);

      expect(component.selectedMunicipalities()).toEqual([]);
    });

    it('onMunicipalitiesChange refetches the currently expanded community', () => {
      component.toggleAccordion(1); // expand & fetch once
      communityServiceSpy.getCommunityPublicSharingOperations.mockClear();

      const m = buildMunicipality(11001);
      component.onMunicipalitiesChange([m]);

      expect(communityServiceSpy.getCommunityPublicSharingOperations).toHaveBeenCalledWith(1, {
        page: 1,
        limit: 50,
        municipality_nis_codes: [11001],
      });
    });

    it('onMunicipalitiesChange does not fetch when no community is expanded', () => {
      communityServiceSpy.getCommunityPublicSharingOperations.mockClear();

      component.onMunicipalitiesChange([buildMunicipality(1)]);

      expect(communityServiceSpy.getCommunityPublicSharingOperations).not.toHaveBeenCalled();
    });
  });

  // ── Query building ──────────────────────────────────────────────────

  describe('query building', () => {
    it('omits municipality_nis_codes when the filter is empty', () => {
      component.toggleAccordion(2);

      const call = communityServiceSpy.getCommunityPublicSharingOperations.mock.calls[0];
      expect(call[1]).toEqual({ page: 1, limit: 50 });
      expect((call[1] as SharingOperationPartialQuery).municipality_nis_codes).toBeUndefined();
    });

    it('includes municipality_nis_codes when the filter is populated', () => {
      component.selectedMunicipalities.set([buildMunicipality(11001), buildMunicipality(21001)]);

      component.toggleAccordion(3);

      expect(communityServiceSpy.getCommunityPublicSharingOperations).toHaveBeenCalledWith(3, {
        page: 1,
        limit: 50,
        municipality_nis_codes: [11001, 21001],
      });
    });
  });

  // ── municipalityName ────────────────────────────────────────────────

  describe('municipalityName', () => {
    let translate: TranslateService;

    beforeEach(() => {
      translate = TestBed.inject(TranslateService);
    });

    it('returns fr_name by default (fr language)', () => {
      vi.spyOn(translate, 'currentLang', 'get').mockReturnValue('fr');
      const m = buildMunicipality(1, {
        fr_name: 'Bruxelles',
        nl_name: 'Brussel',
        de_name: 'Brüssel',
      });
      expect(component.municipalityName(m)).toBe('Bruxelles');
    });

    it('returns nl_name when language starts with nl', () => {
      vi.spyOn(translate, 'currentLang', 'get').mockReturnValue('nl');
      const m = buildMunicipality(1, {
        fr_name: 'Bruxelles',
        nl_name: 'Brussel',
        de_name: null,
      });
      expect(component.municipalityName(m)).toBe('Brussel');
    });

    it('falls back to fr_name when nl_name is missing for nl language', () => {
      vi.spyOn(translate, 'currentLang', 'get').mockReturnValue('nl-BE');
      const m = buildMunicipality(1, { fr_name: 'Liège', nl_name: null, de_name: null });
      expect(component.municipalityName(m)).toBe('Liège');
    });

    it('returns de_name when language starts with de', () => {
      vi.spyOn(translate, 'currentLang', 'get').mockReturnValue('de');
      const m = buildMunicipality(1, {
        fr_name: 'Eupen',
        nl_name: null,
        de_name: 'Eupen-DE',
      });
      expect(component.municipalityName(m)).toBe('Eupen-DE');
    });

    it('returns "—" when no name is available in any locale', () => {
      vi.spyOn(translate, 'currentLang', 'get').mockReturnValue('fr');
      const m = buildMunicipality(1, {
        fr_name: '',
        nl_name: null,
        de_name: null,
      });
      expect(component.municipalityName(m)).toBe('—');
    });
  });

  // ── typeIcon / typeLabelKey ─────────────────────────────────────────

  describe('typeIcon', () => {
    it('returns pi pi-home for LOCAL', () => {
      expect(component.typeIcon(SharingOperationType.LOCAL)).toBe('pi pi-home');
    });
    it('returns pi pi-sitemap for CER', () => {
      expect(component.typeIcon(SharingOperationType.CER)).toBe('pi pi-sitemap');
    });
    it('returns pi pi-globe for CEC', () => {
      expect(component.typeIcon(SharingOperationType.CEC)).toBe('pi pi-globe');
    });
    it('returns pi pi-bolt for unknown values', () => {
      expect(component.typeIcon(999 as unknown as SharingOperationType)).toBe('pi pi-bolt');
    });
  });

  describe('typeLabelKey', () => {
    it('returns INSIDE_BUILDING key for LOCAL', () => {
      expect(component.typeLabelKey(SharingOperationType.LOCAL)).toBe(
        'SHARING_OPERATION.TYPE.INSIDE_BUILDING',
      );
    });
    it('returns CER key for CER', () => {
      expect(component.typeLabelKey(SharingOperationType.CER)).toBe('SHARING_OPERATION.TYPE.CER');
    });
    it('returns CEC key for CEC', () => {
      expect(component.typeLabelKey(SharingOperationType.CEC)).toBe('SHARING_OPERATION.TYPE.CEC');
    });
    it('returns empty string for unknown values', () => {
      expect(component.typeLabelKey(999 as unknown as SharingOperationType)).toBe('');
    });
  });
});
