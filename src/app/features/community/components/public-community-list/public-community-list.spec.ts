import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, of, NEVER, throwError } from 'rxjs';
import { ActivatedRoute, type ParamMap, Router, convertToParamMap } from '@angular/router';
import { PublicCommunityList } from './public-community-list';
import { CommunityMap } from './community-map/community-map';
import { CommunityService } from '../../../../shared/services/community.service';
import { MunicipalityService } from '../../../../shared/services/municipality.service';
import {
  PublicCommunityDetailDTO,
  PublicCommunityDTO,
} from '../../../../shared/dtos/community.dtos';
import { ApiResponse } from '../../../../core/dtos/api.response';
import {
  SharingOperationPartialDTO,
  SharingOperationPartialQuery,
} from '../../../../shared/dtos/sharing_operation.dtos';
import { MunicipalityPartialDTO } from '../../../../shared/dtos/municipality.dtos';
import { SharingOperationType } from '../../../../shared/types/sharing_operation.types';
import { ApiResponsePaginated, Pagination } from '../../../../core/dtos/api.response';

function buildCommunities(): PublicCommunityDTO[] {
  return [
    {
      id: 1,
      name: 'Alpha Community',
      regulator: 'BE-WAL-CWAPE',
      logo_url: 'communities/1/logo.png',
      logo_presigned_url: 'https://example.com/alpha.png?sig=1',
    },
    {
      id: 2,
      name: 'Beta Community',
      regulator: 'BE-WAL-CWAPE',
      logo_url: null,
      logo_presigned_url: null,
    },
    {
      id: 3,
      name: 'Gamma Community',
      regulator: 'BE-WAL-CWAPE',
      logo_url: 'communities/3/logo.png',
      logo_presigned_url: 'https://example.com/gamma.png?sig=3',
    },
  ];
}

function buildDetail(
  id: number,
  overrides: Partial<PublicCommunityDetailDTO> = {},
): PublicCommunityDetailDTO {
  return {
    id,
    name: `Community ${id}`,
    regulator: 'BE-WAL-CWAPE',
    logo_presigned_url: null,
    description: null,
    website_url: null,
    headquarters_address: null,
    contact_email: null,
    contact_phone: null,
    ...overrides,
  };
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
    getPublicCommunityDetail: ReturnType<typeof vi.fn>;
    getRegulators: ReturnType<typeof vi.fn>;
  };
  let municipalityServiceSpy: {
    searchMunicipalities: ReturnType<typeof vi.fn>;
  };
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };
  let routeParams: BehaviorSubject<ParamMap>;

  beforeEach(async () => {
    routerSpy = { navigate: vi.fn().mockResolvedValue(true) };
    routeParams = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    communityServiceSpy = {
      getPublicCommunities: vi.fn().mockReturnValue(of(buildPaginatedResponse(buildCommunities()))),
      getCommunityPublicSharingOperations: vi
        .fn()
        .mockReturnValue(of(buildPaginatedResponse(buildOps()))),
      getPublicCommunityDetail: vi
        .fn()
        .mockImplementation((id: number) =>
          of(new ApiResponse<PublicCommunityDetailDTO>(buildDetail(id))),
        ),
      getRegulators: vi.fn().mockReturnValue(of(new ApiResponse([]))),
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
        // The component reads `?view=` and writes it back, so both are needed
        // now — it injected neither before the map view existed.
        { provide: ActivatedRoute, useValue: { queryParamMap: routeParams } },
        { provide: Router, useValue: routerSpy },
      ],
    })
      .overrideComponent(PublicCommunityList, {
        // NO_ERRORS_SCHEMA only tolerates UNKNOWN elements; an imported
        // standalone component still instantiates. The map branch is not
        // rendered in list view, but removing it keeps that guarantee explicit.
        //
        // `remove` + `add` rather than `set`: `set` replaces the whole metadata
        // field, and combining it with `remove` silently drops the override.
        remove: { imports: [CommunityMap] },
        add: { schemas: [NO_ERRORS_SCHEMA] },
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
    it('should render an img element for communities with valid logos', () => {
      const imgs = el.querySelectorAll('.accordion-header img');
      expect(imgs.length).toBe(2); // communities 1 and 3 have logos
    });

    it('should render a fallback icon for communities without logos', () => {
      const fallbacks = el.querySelectorAll('.accordion-header .pi-building');
      expect(fallbacks.length).toBe(1); // community 2 has null logo
    });

    it('should fall back to the icon when a presigned URL fails to load', () => {
      // The URLs expire in ~15 min while `cachedGet` keeps serving the payload,
      // so a 403 on a valid-looking URL is routine here.
      const img = el.querySelector<HTMLImageElement>('.accordion-header img');
      img?.dispatchEvent(new Event('error'));
      fixture.detectChanges();

      expect(el.querySelectorAll('.accordion-header img').length).toBe(1);
      expect(el.querySelectorAll('.accordion-header .pi-building').length).toBe(2);
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

    it('expanding a community calls getPublicCommunityDetail', () => {
      communityServiceSpy.getPublicCommunityDetail.mockClear();
      component.toggleAccordion(1);

      expect(communityServiceSpy.getPublicCommunityDetail).toHaveBeenCalledWith(1);
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

  // ── Community detail loading ────────────────────────────────────────

  describe('community detail loading', () => {
    it('marks the community detail as loading while the request is pending', () => {
      communityServiceSpy.getPublicCommunityDetail.mockReturnValue(NEVER);

      component.toggleAccordion(1);

      expect(component.isLoadingDetail(1)).toBe(true);
      expect(component.getDetail(1)).toBeUndefined();
    });

    it('populates communityDetails and clears loading on success', () => {
      const detail = buildDetail(1, {
        description: 'Hello world',
        website_url: 'https://example.com',
      });
      communityServiceSpy.getPublicCommunityDetail.mockReturnValue(
        of(new ApiResponse<PublicCommunityDetailDTO>(detail)),
      );

      component.toggleAccordion(1);

      expect(component.isLoadingDetail(1)).toBe(false);
      expect(component.getDetail(1)?.description).toBe('Hello world');
      expect(component.getDetail(1)?.website_url).toBe('https://example.com');
    });

    it('clears loading without caching on error', () => {
      communityServiceSpy.getPublicCommunityDetail.mockReturnValue(
        throwError(() => new Error('boom')),
      );

      component.toggleAccordion(2);

      expect(component.isLoadingDetail(2)).toBe(false);
      expect(component.getDetail(2)).toBeUndefined();
    });

    it('does not refetch detail when the same community is re-expanded', () => {
      component.toggleAccordion(1); // first expand → fetches
      communityServiceSpy.getPublicCommunityDetail.mockClear();

      component.toggleAccordion(1); // collapse
      component.toggleAccordion(1); // expand again

      expect(communityServiceSpy.getPublicCommunityDetail).not.toHaveBeenCalled();
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

  // ── Public contact ──────────────────────────────────────────────────

  describe('public contact', () => {
    function expandWith(detail: PublicCommunityDetailDTO): void {
      communityServiceSpy.getPublicCommunityDetail.mockReturnValue(
        of(new ApiResponse<PublicCommunityDetailDTO>(detail)),
      );
      component.toggleAccordion(1);
      fixture.detectChanges();
    }

    it('renders a mailto: link and a dialable tel: link', () => {
      expandWith(
        buildDetail(1, { contact_email: 'contact@alpha.be', contact_phone: '+32 470 12 34 56' }),
      );

      const mail = el.querySelector<HTMLAnchorElement>(
        '[data-testid="public-community-list__contact--email--0"]',
      );
      const phone = el.querySelector<HTMLAnchorElement>(
        '[data-testid="public-community-list__contact--phone--0"]',
      );
      expect(mail?.getAttribute('href')).toBe('mailto:contact@alpha.be');
      expect(mail?.textContent).toContain('contact@alpha.be');
      expect(phone?.getAttribute('href')).toBe('tel:+32470123456');
      // Shown as typed, dialled as digits.
      expect(phone?.textContent).toContain('+32 470 12 34 56');
      expect(
        el.querySelector('[data-testid="public-community-list__contact--none--0"]'),
      ).toBeNull();
    });

    it('renders only the channel that is filled in', () => {
      expandWith(buildDetail(1, { contact_phone: '04/123.45.67' }));

      expect(
        el.querySelector('[data-testid="public-community-list__contact--email--0"]'),
      ).toBeNull();
      expect(
        el
          .querySelector('[data-testid="public-community-list__contact--phone--0"]')
          ?.getAttribute('href'),
      ).toBe('tel:041234567');
    });

    it('says so when the community has no contact details', () => {
      expandWith(buildDetail(1, { website_url: 'https://alpha.be' }));

      expect(
        el.querySelector('[data-testid="public-community-list__contact--none--0"]'),
      ).not.toBeNull();
      expect(
        el.querySelector('[data-testid="public-community-list__contact--email--0"]'),
      ).toBeNull();
      expect(
        el.querySelector('[data-testid="public-community-list__contact--phone--0"]'),
      ).toBeNull();
    });

    it('still shows the description, website and headquarters', () => {
      expandWith(
        buildDetail(1, {
          description: 'Une communauté solaire',
          website_url: 'https://alpha.be',
          headquarters_address: {
            street: 'Rue de la Gare',
            number: '12',
            postcode: '1360',
            city: 'Perwez',
          } as PublicCommunityDetailDTO['headquarters_address'],
        }),
      );

      const info = el.querySelector('[data-testid="public-community-list__info--0"]');
      expect(info?.textContent).toContain('Une communauté solaire');
      expect(info?.querySelector('a[href="https://alpha.be"]')).not.toBeNull();
      expect(info?.textContent).toContain('Perwez');
    });
  });

  // ── Shareable link: ?community=<id> ─────────────────────────────────

  describe('community link', () => {
    it('opens the linked community with its detail and operations', () => {
      communityServiceSpy.getPublicCommunityDetail.mockClear();
      communityServiceSpy.getCommunityPublicSharingOperations.mockClear();

      routeParams.next(convertToParamMap({ community: '2' }));
      fixture.detectChanges();

      expect(component.isExpanded(2)).toBe(true);
      expect(communityServiceSpy.getPublicCommunityDetail).toHaveBeenCalledWith(2);
      expect(communityServiceSpy.getCommunityPublicSharingOperations).toHaveBeenCalledWith(
        2,
        expect.anything(),
      );
      expect(el.querySelector('[data-testid="public-community-list__detail--1"]')).not.toBeNull();
    });

    it('adds the card on top when the community is not on the loaded page', () => {
      communityServiceSpy.getPublicCommunityDetail.mockReturnValue(
        of(new ApiResponse<PublicCommunityDetailDTO>(buildDetail(42, { name: 'Far Community' }))),
      );

      routeParams.next(convertToParamMap({ community: '42' }));
      fixture.detectChanges();

      expect(component.listedCommunities().map((c) => c.id)).toEqual([42, 1, 2, 3]);
      expect(el.querySelector('#public-community-42')?.textContent).toContain('Far Community');
      expect(component.isExpanded(42)).toBe(true);
    });

    it('leaves the list as it is when the linked community is not public', () => {
      communityServiceSpy.getPublicCommunityDetail.mockReturnValue(
        throwError(() => new Error('404')),
      );

      routeParams.next(convertToParamMap({ community: '42' }));
      fixture.detectChanges();

      expect(component.listedCommunities().map((c) => c.id)).toEqual([1, 2, 3]);
    });

    it.each(['abc', '0', '-3', '1.5'])('ignores a malformed id %s', (raw) => {
      routeParams.next(convertToParamMap({ community: raw }));

      expect(component.expandedCommunityId()).toBeNull();
    });

    it('writes the open card into the URL, and removes it on collapse', () => {
      component.toggleAccordion(3);
      expect(routerSpy.navigate).toHaveBeenLastCalledWith(
        [],
        expect.objectContaining({
          queryParams: { community: 3 },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        }),
      );

      component.toggleAccordion(3);
      expect(routerSpy.navigate).toHaveBeenLastCalledWith(
        [],
        expect.objectContaining({ queryParams: { community: null } }),
      );
    });

    it('does not reopen a card when the URL only echoes the one already open', () => {
      component.toggleAccordion(1);
      communityServiceSpy.getPublicCommunityDetail.mockClear();

      routeParams.next(convertToParamMap({ community: '1' }));

      expect(component.isExpanded(1)).toBe(true);
      expect(communityServiceSpy.getPublicCommunityDetail).not.toHaveBeenCalled();
    });

    it('a regulator change closes the linked card and clears the URL', () => {
      communityServiceSpy.getPublicCommunityDetail.mockReturnValue(
        of(new ApiResponse<PublicCommunityDetailDTO>(buildDetail(42))),
      );
      routeParams.next(convertToParamMap({ community: '42' }));

      component.onRegulatorChange('BE-WAL-CWAPE');

      expect(component.expandedCommunityId()).toBeNull();
      expect(component.listedCommunities().map((c) => c.id)).toEqual([1, 2, 3]);
      expect(routerSpy.navigate).toHaveBeenLastCalledWith(
        [],
        expect.objectContaining({ queryParams: { community: null } }),
      );
    });
  });

  // ── List / map view toggle ──────────────────────────────────────────

  describe('view toggle', () => {
    it('should default to the list view', () => {
      expect(component.view()).toBe('list');
    });

    it('should read ?view=map from the query params', () => {
      routeParams.next(convertToParamMap({ view: 'map' }));

      expect(component.view()).toBe('map');
    });

    it('should write ?view=map and drop it again for the list', () => {
      component.setView('map');
      expect(routerSpy.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ queryParams: { view: 'map' }, queryParamsHandling: 'merge' }),
      );

      component.setView('list');
      expect(routerSpy.navigate).toHaveBeenLastCalledWith(
        [],
        expect.objectContaining({ queryParams: { view: null } }),
      );
    });

    it('should expose the municipality filter as NIS codes for the map', () => {
      component.selectedMunicipalities.set([
        {
          nis_code: 21004,
          fr_name: 'Bruxelles',
          nl_name: null,
          de_name: null,
          region_fr: null,
          postal_codes: [],
        },
        {
          nis_code: 21009,
          fr_name: 'Ixelles',
          nl_name: null,
          de_name: null,
          region_fr: null,
          postal_codes: [],
        },
      ]);

      expect(component.selectedNisCodes()).toEqual([21004, 21009]);
    });
  });
});
