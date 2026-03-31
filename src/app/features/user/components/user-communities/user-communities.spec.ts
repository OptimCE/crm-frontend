import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DialogService } from 'primeng/dynamicdialog';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { UserCommunities } from './user-communities';
import { ApiResponsePaginated, Pagination } from '../../../../core/dtos/api.response';
import { Role } from '../../../../core/dtos/role';
import { MyCommunityDTO } from '../../../../shared/dtos/community.dtos';
import { CommunityService } from '../../../../shared/services/community.service';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { CommunityDialog } from './community-dialog/community-dialog';
import { HeaderPage } from '../../../../layout/header-page/header-page';
import { DebouncedPInputComponent } from '../../../../shared/components/debounced-p-input/debounced-p-input.component';

// ── Stubs ──────────────────────────────────────────────────────────

@Component({ selector: 'app-header-page', standalone: true, template: '' })
class HeaderPageStub {}

@Component({ selector: 'app-debounced-p-input', standalone: true, template: '' })
class DebouncedPInputStub {}

// ── Helpers ────────────────────────────────────────────────────────

function buildCommunity(overrides: Partial<MyCommunityDTO> = {}): MyCommunityDTO {
  return {
    id: 1,
    auth_community_id: 'auth-comm-1',
    name: 'Test Community',
    role: Role.MEMBER,
    ...overrides,
  };
}

function buildPaginatedResponse(
  communities: MyCommunityDTO[] = [buildCommunity()],
  pagination: Partial<Pagination> = {},
): ApiResponsePaginated<MyCommunityDTO[]> {
  const pag = new Pagination(
    pagination.page ?? 1,
    pagination.limit ?? 10,
    pagination.total ?? communities.length,
    pagination.total_pages ?? 1,
  );
  return new ApiResponsePaginated<MyCommunityDTO[]>(communities, pag);
}

// ── Test Suite ─────────────────────────────────────────────────────

describe('UserCommunities', () => {
  let component: UserCommunities;
  let fixture: ComponentFixture<UserCommunities>;

  let communityServiceSpy: {
    getMyCommunities: ReturnType<typeof vi.fn>;
  };

  let userContextServiceSpy: {
    activeCommunityId: ReturnType<typeof vi.fn>;
    switchCommunity: ReturnType<typeof vi.fn>;
  };

  let dialogServiceSpy: {
    open: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    communityServiceSpy = {
      getMyCommunities: vi.fn().mockReturnValue(of(buildPaginatedResponse())),
    };

    userContextServiceSpy = {
      activeCommunityId: vi.fn().mockReturnValue('auth-comm-1'),
      switchCommunity: vi.fn(),
    };

    dialogServiceSpy = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [UserCommunities, TranslateModule.forRoot()],
      providers: [
        { provide: CommunityService, useValue: communityServiceSpy },
        { provide: UserContextService, useValue: userContextServiceSpy },
      ],
    })
      .overrideComponent(UserCommunities, {
        remove: {
          imports: [HeaderPage, DebouncedPInputComponent],
          providers: [DialogService],
        },
        add: {
          imports: [HeaderPageStub, DebouncedPInputStub],
          providers: [{ provide: DialogService, useValue: dialogServiceSpy }],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    vi.spyOn(TestBed.inject(TranslateService), 'instant').mockImplementation(
      (key: string | string[]) =>
        Array.isArray(key)
          ? key.reduce<Record<string, string>>((acc, k) => ({ ...acc, [k]: k }), {})
          : key,
    );

    fixture = TestBed.createComponent(UserCommunities);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ── Creation ───────────────────────────────────────────────────

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ── Computed signals ───────────────────────────────────────────

  describe('computed signals', () => {
    describe('firstRow', () => {
      it('should return 0 for page 1', () => {
        component.pagination.set({ page: 1, limit: 10, total: 20, total_pages: 2 });
        expect(component.firstRow()).toBe(0);
      });

      it('should return correct offset for page 3 with limit 10', () => {
        component.pagination.set({ page: 3, limit: 10, total: 50, total_pages: 5 });
        expect(component.firstRow()).toBe(20);
      });
    });

    describe('showPaginator', () => {
      it('should return false when total_pages is 1', () => {
        component.pagination.set({ page: 1, limit: 10, total: 5, total_pages: 1 });
        expect(component.showPaginator()).toBe(false);
      });

      it('should return true when total_pages is greater than 1', () => {
        component.pagination.set({ page: 1, limit: 10, total: 25, total_pages: 3 });
        expect(component.showPaginator()).toBe(true);
      });
    });

    describe('hasActiveFilters', () => {
      it('should return false when searchText is empty', () => {
        component.searchText.set('');
        expect(component.hasActiveFilters()).toBe(false);
      });

      it('should return true when searchText is set', () => {
        component.searchText.set('test');
        expect(component.hasActiveFilters()).toBe(true);
      });
    });
  });

  // ── loadCommunities ────────────────────────────────────────────

  describe('loadCommunities', () => {
    it('should call getMyCommunities with current filter', () => {
      communityServiceSpy.getMyCommunities.mockClear();

      component.loadCommunities();

      expect(communityServiceSpy.getMyCommunities).toHaveBeenCalledWith(component.filter());
    });

    it('should update communities signal on success', () => {
      const communities = [
        buildCommunity({ id: 1, name: 'Alpha' }),
        buildCommunity({ id: 2, name: 'Beta' }),
      ];
      communityServiceSpy.getMyCommunities.mockReturnValue(
        of(buildPaginatedResponse(communities, { total: 2 })),
      );

      component.loadCommunities();

      expect(component.communities()).toEqual(communities);
    });

    it('should update pagination signal on success', () => {
      communityServiceSpy.getMyCommunities.mockReturnValue(
        of(buildPaginatedResponse([], { page: 2, limit: 10, total: 30, total_pages: 3 })),
      );

      component.loadCommunities();

      expect(component.pagination()).toEqual({ page: 2, limit: 10, total: 30, total_pages: 3 });
    });

    it('should not throw on service error', () => {
      communityServiceSpy.getMyCommunities.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      expect(() => component.loadCommunities()).not.toThrow();
    });
  });

  // ── applyFilters ───────────────────────────────────────────────

  describe('applyFilters', () => {
    it('should reset page to 1', () => {
      component.filter.set({ page: 5, limit: 10 });

      component.applyFilters();

      expect(component.filter().page).toBe(1);
    });

    it('should include name when searchText is set', () => {
      component.searchText.set('solar');

      component.applyFilters();

      expect(component.filter().name).toBe('solar');
    });

    it('should not include name when searchText is empty', () => {
      component.searchText.set('');

      component.applyFilters();

      expect(component.filter().name).toBeUndefined();
    });

    it('should call getMyCommunities', () => {
      communityServiceSpy.getMyCommunities.mockClear();

      component.applyFilters();

      expect(communityServiceSpy.getMyCommunities).toHaveBeenCalled();
    });
  });

  // ── onSearchTextChange ─────────────────────────────────────────

  describe('onSearchTextChange', () => {
    it('should update searchText signal', () => {
      component.onSearchTextChange('hello');

      expect(component.searchText()).toBe('hello');
    });

    it('should trigger loadCommunities', () => {
      communityServiceSpy.getMyCommunities.mockClear();

      component.onSearchTextChange('hello');

      expect(communityServiceSpy.getMyCommunities).toHaveBeenCalled();
    });
  });

  // ── clear ──────────────────────────────────────────────────────

  describe('clear', () => {
    it('should reset searchText to empty', () => {
      component.searchText.set('existing');
      const mockTable = { clear: vi.fn() } as unknown as import('primeng/table').Table;

      component.clear(mockTable);

      expect(component.searchText()).toBe('');
    });

    it('should reset filter to page 1 limit 10', () => {
      component.filter.set({ page: 3, limit: 25, name: 'test' });
      const mockTable = { clear: vi.fn() } as unknown as import('primeng/table').Table;

      component.clear(mockTable);

      expect(component.filter()).toEqual({ page: 1, limit: 10 });
    });

    it('should call table.clear()', () => {
      const mockTable = { clear: vi.fn() } as unknown as import('primeng/table').Table;

      component.clear(mockTable);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockTable.clear).toHaveBeenCalled();
    });

    it('should reload communities', () => {
      communityServiceSpy.getMyCommunities.mockClear();
      const mockTable = { clear: vi.fn() } as unknown as import('primeng/table').Table;

      component.clear(mockTable);

      expect(communityServiceSpy.getMyCommunities).toHaveBeenCalled();
    });
  });

  // ── lazyLoadCommunities ────────────────────────────────────────

  describe('lazyLoadCommunities', () => {
    it('should calculate page from event first and rows', () => {
      communityServiceSpy.getMyCommunities.mockClear();

      component.lazyLoadCommunities({ first: 20, rows: 10 });

      expect(component.filter().page).toBe(3);
      expect(communityServiceSpy.getMyCommunities).toHaveBeenCalled();
    });

    it('should default page to 1 when rows is 0', () => {
      component.lazyLoadCommunities({ first: 0, rows: 0 });

      expect(component.filter().page).toBe(1);
    });

    it('should set page to 1 for first page event', () => {
      component.lazyLoadCommunities({ first: 0, rows: 10 });

      expect(component.filter().page).toBe(1);
    });
  });

  // ── pageChange ─────────────────────────────────────────────────

  describe('pageChange', () => {
    it('should calculate correct page from event', () => {
      communityServiceSpy.getMyCommunities.mockClear();

      component.pageChange({ first: 30, rows: 10 });

      expect(component.filter().page).toBe(4);
      expect(communityServiceSpy.getMyCommunities).toHaveBeenCalled();
    });

    it('should handle first page', () => {
      component.pageChange({ first: 0, rows: 10 });

      expect(component.filter().page).toBe(1);
    });
  });

  // ── joinCommunity ──────────────────────────────────────────────

  describe('joinCommunity', () => {
    it('should call switchCommunity with the community auth_community_id', () => {
      const community = buildCommunity({ auth_community_id: 'abc-123' });

      component.joinCommunity(community);

      expect(userContextServiceSpy.switchCommunity).toHaveBeenCalledWith('abc-123');
    });
  });

  // ── createCommunity ────────────────────────────────────────────

  describe('createCommunity', () => {
    it('should open CommunityDialog via DialogService', () => {
      const onClose$ = new Subject<boolean>();
      dialogServiceSpy.open.mockReturnValue({
        onClose: onClose$.asObservable(),
        destroy: vi.fn(),
      });

      component.createCommunity();

      expect(dialogServiceSpy.open).toHaveBeenCalledWith(
        CommunityDialog,
        expect.objectContaining({
          modal: true,
          closable: true,
          closeOnEscape: true,
          header: 'COMMUNITY.CREATE.TITLE',
        }),
      );
    });

    it('should reload communities when dialog closes with true', () => {
      const onClose$ = new Subject<boolean>();
      dialogServiceSpy.open.mockReturnValue({
        onClose: onClose$.asObservable(),
        destroy: vi.fn(),
      });

      component.createCommunity();
      communityServiceSpy.getMyCommunities.mockClear();

      onClose$.next(true);

      expect(communityServiceSpy.getMyCommunities).toHaveBeenCalled();
    });

    it('should not reload communities when dialog closes with false', () => {
      const onClose$ = new Subject<boolean>();
      dialogServiceSpy.open.mockReturnValue({
        onClose: onClose$.asObservable(),
        destroy: vi.fn(),
      });

      component.createCommunity();
      communityServiceSpy.getMyCommunities.mockClear();

      onClose$.next(false);

      expect(communityServiceSpy.getMyCommunities).not.toHaveBeenCalled();
    });
  });
});
