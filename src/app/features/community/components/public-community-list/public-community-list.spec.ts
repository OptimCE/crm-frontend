import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { of, NEVER } from 'rxjs';
import { PublicCommunityList } from './public-community-list';
import { CommunityService } from '../../../../shared/services/community.service';
import { PublicCommunityDTO, CommunityDetailDTO } from '../../../../shared/dtos/community.dtos';
import { ApiResponse, ApiResponsePaginated, Pagination } from '../../../../core/dtos/api.response';

function buildCommunities(): PublicCommunityDTO[] {
  return [
    { id: 1, name: 'Alpha Community', logo_url: 'https://example.com/alpha.png' },
    { id: 2, name: 'Beta Community', logo_url: null },
    { id: 3, name: 'Gamma Community', logo_url: 'https://example.com/gamma.png' },
  ];
}

function buildDetail(id: number, overrides: Partial<CommunityDetailDTO> = {}): CommunityDetailDTO {
  return {
    id,
    name: `Community ${id}`,
    auth_community_id: `auth-${id}`,
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-03-20T14:30:00Z',
    member_count: 42,
    ...overrides,
  };
}

function buildPaginatedResponse(
  data: PublicCommunityDTO[] = buildCommunities(),
  pagination: Pagination = new Pagination(1, 10, data.length, 1),
): ApiResponsePaginated<PublicCommunityDTO[] | string> {
  return new ApiResponsePaginated(data, pagination);
}

describe('PublicCommunityList', () => {
  let component: PublicCommunityList;
  let fixture: ComponentFixture<PublicCommunityList>;
  let el: HTMLElement;
  let communityServiceSpy: {
    getPublicCommunities: ReturnType<typeof vi.fn>;
    getCommunityDetail: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    communityServiceSpy = {
      getPublicCommunities: vi.fn().mockReturnValue(of(buildPaginatedResponse())),
      getCommunityDetail: vi.fn().mockReturnValue(of(new ApiResponse(buildDetail(1)))),
    };

    await TestBed.configureTestingModule({
      imports: [PublicCommunityList, TranslateModule.forRoot()],
      providers: [{ provide: CommunityService, useValue: communityServiceSpy }],
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

    it('expanding a community calls getCommunityDetail', () => {
      communityServiceSpy.getCommunityDetail.mockClear();
      component.toggleAccordion(1);

      expect(communityServiceSpy.getCommunityDetail).toHaveBeenCalledWith(1);
    });

    it('collapsing a community does not call getCommunityDetail', () => {
      component.toggleAccordion(1);
      communityServiceSpy.getCommunityDetail.mockClear();

      component.toggleAccordion(1); // collapse
      expect(communityServiceSpy.getCommunityDetail).not.toHaveBeenCalled();
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

  // ── Detail caching ──────────────────────────────────────────────────

  describe('detail caching', () => {
    it('does not re-fetch if detail is already cached', () => {
      component.toggleAccordion(1); // first expand → fetches
      communityServiceSpy.getCommunityDetail.mockClear();

      component.toggleAccordion(1); // collapse
      component.toggleAccordion(1); // expand again

      expect(communityServiceSpy.getCommunityDetail).not.toHaveBeenCalled();
    });

    it('fetches for a different community', () => {
      component.toggleAccordion(1);
      communityServiceSpy.getCommunityDetail.mockClear();

      communityServiceSpy.getCommunityDetail.mockReturnValue(of(new ApiResponse(buildDetail(2))));
      component.toggleAccordion(2);

      expect(communityServiceSpy.getCommunityDetail).toHaveBeenCalledWith(2);
    });

    it('stores the detail in the communityDetails map', () => {
      component.toggleAccordion(1);

      expect(component.communityDetails().has(1)).toBe(true);
      expect(component.communityDetails().get(1)?.auth_community_id).toBe('auth-1');
    });
  });

  // ── Detail display ──────────────────────────────────────────────────

  describe('detail display', () => {
    it('shows detail fields when loaded', () => {
      component.toggleAccordion(1);
      fixture.detectChanges();

      const detail = el.querySelector('.bg-surface-50') as Element;
      expect(detail).toBeTruthy();

      const fieldValues = detail.querySelectorAll('.field-value');
      const texts = Array.from(fieldValues).map((e) => e.textContent?.trim());

      expect(texts).toContain('auth-1');
      expect(texts).toContain('42');
    });

    it('shows spinner while detail is loading', () => {
      communityServiceSpy.getCommunityDetail.mockReturnValue(NEVER);
      component.toggleAccordion(2);
      fixture.detectChanges();

      const spinner = el.querySelector('.pi-spinner');
      expect(spinner).toBeTruthy();
    });

    it('shows description when present', () => {
      communityServiceSpy.getCommunityDetail.mockReturnValue(
        of(new ApiResponse(buildDetail(1, { description: 'A great community' }))),
      );
      component.toggleAccordion(1);
      fixture.detectChanges();

      const fieldValues = el.querySelectorAll('.field-value');
      const texts = Array.from(fieldValues).map((e) => e.textContent?.trim());
      expect(texts).toContain('A great community');
    });

    it('does not show description div when absent', () => {
      communityServiceSpy.getCommunityDetail.mockReturnValue(
        of(new ApiResponse(buildDetail(1))), // no description
      );
      component.toggleAccordion(1);
      fixture.detectChanges();

      const detailSection = el.querySelector('.bg-surface-50') as Element;
      const colSpan2 = detailSection.querySelector('.sm\\:col-span-2');
      expect(colSpan2).toBeFalsy();
    });
  });

  // ── getCommunityDetail accessor ─────────────────────────────────────

  describe('getCommunityDetail accessor', () => {
    it('returns undefined when detail is not in the map', () => {
      expect(component.getCommunityDetail(999)).toBeUndefined();
    });

    it('returns the detail when it is in the map', () => {
      component.toggleAccordion(1);

      const detail = component.getCommunityDetail(1) as CommunityDetailDTO;
      expect(detail).toBeDefined();
      expect(detail.member_count).toBe(42);
    });
  });
});
