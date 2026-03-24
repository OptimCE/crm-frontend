import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Table, TableLazyLoadEvent } from 'primeng/table';

import { ManagersCommunityList } from './managers-community-list';
import { CommunityService } from '../../../../shared/services/community.service';
import { ApiResponsePaginated, Pagination } from '../../../../core/dtos/api.response';
import { UsersCommunityDTO } from '../../../../shared/dtos/community.dtos';
import { Role } from '../../../../core/dtos/role';

// ── Helpers ────────────────────────────────────────────────────────

function buildUsers(): UsersCommunityDTO[] {
  return [
    {
      id_user: 1,
      id_community: 1,
      email: 'admin@test.com',
      role: Role.ADMIN,
      first_name: 'Alice',
      last_name: 'Dupont',
      phone: '0600000001',
    },
    {
      id_user: 2,
      id_community: 1,
      email: 'manager@test.com',
      role: Role.GESTIONNAIRE,
      first_name: 'Bob',
      last_name: 'Martin',
    },
  ];
}

function buildPaginatedResponse(
  data: UsersCommunityDTO[] = buildUsers(),
  pagination: Pagination = new Pagination(1, 10, 2, 1),
): ApiResponsePaginated<UsersCommunityDTO[] | string> {
  return new ApiResponsePaginated(data, pagination);
}

// ── Test Suite ─────────────────────────────────────────────────────

describe('ManagersCommunityList', () => {
  let component: ManagersCommunityList;
  let fixture: ComponentFixture<ManagersCommunityList>;

  let communityServiceSpy: {
    getAdmins: ReturnType<typeof vi.fn>;
  };

  async function createComponent(): Promise<void> {
    fixture = TestBed.createComponent(ManagersCommunityList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  beforeEach(async () => {
    communityServiceSpy = {
      getAdmins: vi.fn().mockReturnValue(of(buildPaginatedResponse())),
    };

    await TestBed.configureTestingModule({
      imports: [ManagersCommunityList, TranslateModule.forRoot()],
      providers: [{ provide: CommunityService, useValue: communityServiceSpy }],
    })
      .overrideComponent(ManagersCommunityList, {
        add: { schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();
  });

  // ── 1. Creation ─────────────────────────────────────────────────

  describe('creation', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should have default filter with page 1 and limit 10', () => {
      expect(component.filter().page).toBe(1);
      expect(component.filter().limit).toBe(10);
    });

    it('should have users loaded after init (lazy load fires automatically)', () => {
      expect(component.users().length).toBe(2);
    });
  });

  // ── 2. loadUsers ────────────────────────────────────────────────

  describe('loadUsers', () => {
    beforeEach(async () => {
      await createComponent();
      communityServiceSpy.getAdmins.mockClear();
    });

    it('should call communityService.getAdmins with current filter', () => {
      component.loadUsers();
      expect(communityServiceSpy.getAdmins).toHaveBeenCalledWith(component.filter());
    });

    it('should set users from response data', () => {
      const users = buildUsers();
      communityServiceSpy.getAdmins.mockReturnValue(of(buildPaginatedResponse(users)));
      component.loadUsers();
      expect(component.users()).toEqual(users);
    });

    it('should set pagination from response', () => {
      const pagination = new Pagination(2, 10, 25, 3);
      communityServiceSpy.getAdmins.mockReturnValue(
        of(buildPaginatedResponse(buildUsers(), pagination)),
      );
      component.loadUsers();
      expect(component.pagination()).toEqual(pagination);
    });
  });

  // ── 3. applyFilters ────────────────────────────────────────────

  describe('applyFilters', () => {
    beforeEach(async () => {
      await createComponent();
      communityServiceSpy.getAdmins.mockClear();
    });

    it('should reset page to 1 and call loadUsers', () => {
      component.filter.set({ page: 3, limit: 10 });
      component.applyFilters();
      expect(component.filter().page).toBe(1);
      expect(communityServiceSpy.getAdmins).toHaveBeenCalled();
    });

    it('should include email in filter when searchText is set', () => {
      component.searchText.set('admin@test.com');
      component.applyFilters();
      expect(component.filter().email).toBe('admin@test.com');
    });

    it('should include role in filter when roleFilter is set', () => {
      component.roleFilter.set(Role.ADMIN);
      component.applyFilters();
      expect(component.filter().role).toBe(Role.ADMIN);
    });

    it('should omit email and role when filters are empty', () => {
      component.searchText.set('');
      component.roleFilter.set(null);
      component.applyFilters();
      expect(component.filter().email).toBeUndefined();
      expect(component.filter().role).toBeUndefined();
    });
  });

  // ── 4. onSearchTextChange ──────────────────────────────────────

  describe('onSearchTextChange', () => {
    beforeEach(async () => {
      await createComponent();
      communityServiceSpy.getAdmins.mockClear();
    });

    it('should set searchText and trigger loadUsers', () => {
      component.onSearchTextChange('hello');
      expect(component.searchText()).toBe('hello');
      expect(communityServiceSpy.getAdmins).toHaveBeenCalled();
    });
  });

  // ── 5. onRoleFilterChange ──────────────────────────────────────

  describe('onRoleFilterChange', () => {
    beforeEach(async () => {
      await createComponent();
      communityServiceSpy.getAdmins.mockClear();
    });

    it('should set roleFilter and trigger loadUsers', () => {
      component.onRoleFilterChange(Role.GESTIONNAIRE);
      expect(component.roleFilter()).toBe(Role.GESTIONNAIRE);
      expect(communityServiceSpy.getAdmins).toHaveBeenCalled();
    });

    it('should accept null to clear the role filter', () => {
      component.onRoleFilterChange(null);
      expect(component.roleFilter()).toBeNull();
    });
  });

  // ── 6. lazyLoadUsers ──────────────────────────────────────────

  describe('lazyLoadUsers', () => {
    beforeEach(async () => {
      await createComponent();
      communityServiceSpy.getAdmins.mockClear();
    });

    it('should compute correct page from event and call loadUsers', () => {
      component.lazyLoadUsers({ first: 20, rows: 10 } as TableLazyLoadEvent);
      expect(component.filter().page).toBe(3);
      expect(communityServiceSpy.getAdmins).toHaveBeenCalled();
    });

    it('should default page to 1 when rows is 0', () => {
      component.lazyLoadUsers({ first: 0, rows: 0 } as TableLazyLoadEvent);
      expect(component.filter().page).toBe(1);
    });

    it('should clamp page to 1 when computed page is less than 1', () => {
      component.lazyLoadUsers({ first: undefined, rows: undefined } as TableLazyLoadEvent);
      expect(component.filter().page).toBeGreaterThanOrEqual(1);
    });
  });

  // ── 7. pageChange ─────────────────────────────────────────────

  describe('pageChange', () => {
    beforeEach(async () => {
      await createComponent();
      communityServiceSpy.getAdmins.mockClear();
    });

    it('should compute page from event and call loadUsers', () => {
      component.pageChange({ first: 10, rows: 10 });
      expect(component.filter().page).toBe(2);
      expect(communityServiceSpy.getAdmins).toHaveBeenCalled();
    });

    it('should set page to 1 when first is 0', () => {
      component.pageChange({ first: 0, rows: 10 });
      expect(component.filter().page).toBe(1);
    });
  });

  // ── 8. clear ──────────────────────────────────────────────────

  describe('clear', () => {
    beforeEach(async () => {
      await createComponent();
      communityServiceSpy.getAdmins.mockClear();
    });

    it('should call table.clear(), reset all filters and call loadUsers', () => {
      const mockTable = { clear: vi.fn() } as unknown as Table;

      // Set some filters first
      component.searchText.set('test');
      component.roleFilter.set(Role.ADMIN);
      component.filter.set({ page: 3, limit: 10, email: 'test', role: Role.ADMIN });

      component.clear(mockTable);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockTable.clear).toHaveBeenCalled();
      expect(component.searchText()).toBe('');
      expect(component.roleFilter()).toBeNull();
      expect(component.filter()).toEqual({ page: 1, limit: 10 });
      expect(communityServiceSpy.getAdmins).toHaveBeenCalled();
    });
  });

  // ── 9. getUserDisplayName ─────────────────────────────────────

  describe('getUserDisplayName', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should return "first last" when both names are present', () => {
      expect(
        component.getUserDisplayName({
          first_name: 'Alice',
          last_name: 'Dupont',
        } as UsersCommunityDTO),
      ).toBe('Alice Dupont');
    });

    it('should return last_name when only last_name is present', () => {
      expect(component.getUserDisplayName({ last_name: 'Dupont' } as UsersCommunityDTO)).toBe(
        'Dupont',
      );
    });

    it('should return first_name when only first_name is present', () => {
      expect(component.getUserDisplayName({ first_name: 'Alice' } as UsersCommunityDTO)).toBe(
        'Alice',
      );
    });

    it('should return "/" when neither name is present', () => {
      expect(component.getUserDisplayName({} as UsersCommunityDTO)).toBe('/');
    });
  });

  // ── 10. Computed signals ──────────────────────────────────────

  describe('computed signals', () => {
    beforeEach(async () => {
      await createComponent();
    });

    describe('firstRow', () => {
      it('should compute (page - 1) * limit', () => {
        component.pagination.set({ page: 3, limit: 10, total: 30, total_pages: 3 });
        expect(component.firstRow()).toBe(20);
      });

      it('should be 0 when page is 1', () => {
        component.pagination.set({ page: 1, limit: 10, total: 5, total_pages: 1 });
        expect(component.firstRow()).toBe(0);
      });
    });

    describe('showPaginator', () => {
      it('should be true when total_pages > 1', () => {
        component.pagination.set({ page: 1, limit: 10, total: 25, total_pages: 3 });
        expect(component.showPaginator()).toBe(true);
      });

      it('should be false when total_pages is 1', () => {
        component.pagination.set({ page: 1, limit: 10, total: 5, total_pages: 1 });
        expect(component.showPaginator()).toBe(false);
      });
    });

    describe('hasActiveFilters', () => {
      it('should be true when searchText is set', () => {
        component.searchText.set('test');
        expect(component.hasActiveFilters()).toBe(true);
      });

      it('should be true when roleFilter is set', () => {
        component.roleFilter.set(Role.ADMIN);
        expect(component.hasActiveFilters()).toBe(true);
      });

      it('should be false when no filters are active', () => {
        component.searchText.set('');
        component.roleFilter.set(null);
        expect(component.hasActiveFilters()).toBe(false);
      });
    });
  });
});
