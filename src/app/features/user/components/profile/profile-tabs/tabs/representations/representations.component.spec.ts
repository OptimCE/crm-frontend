import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Table } from 'primeng/table';

import { RepresentationsComponent } from './representations.component';
import { MeService } from '../../../../../../../shared/services/me.service';
import { ErrorMessageHandler } from '../../../../../../../shared/services-ui/error.message.handler';
import { ApiResponsePaginated, Pagination } from '../../../../../../../core/dtos/api.response';
import { MeMembersPartialDTO } from '../../../../../../../shared/dtos/me.dtos';
import { MemberStatus, MemberType } from '../../../../../../../shared/types/member.types';

// ── Helpers ────────────────────────────────────────────────────────

function buildMember(overrides: Partial<MeMembersPartialDTO> = {}): MeMembersPartialDTO {
  return {
    id: 1,
    name: 'John Doe',
    member_type: MemberType.INDIVIDUAL,
    status: MemberStatus.ACTIVE,
    community: { name: 'Test Community' },
    ...overrides,
  };
}

function buildPaginatedResponse(
  members: MeMembersPartialDTO[] = [buildMember()],
  pagination: Partial<Pagination> = {},
): ApiResponsePaginated<MeMembersPartialDTO[] | string> {
  const pag = new Pagination(
    pagination.page ?? 1,
    pagination.limit ?? 10,
    pagination.total ?? members.length,
    pagination.total_pages ?? 1,
  );
  return new ApiResponsePaginated<MeMembersPartialDTO[] | string>(members, pag);
}

// ── Test Suite ─────────────────────────────────────────────────────

describe('RepresentationsComponent', () => {
  let component: RepresentationsComponent;
  let fixture: ComponentFixture<RepresentationsComponent>;

  let meServiceSpy: { getMembers: ReturnType<typeof vi.fn> };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };

  async function createComponent(): Promise<void> {
    fixture = TestBed.createComponent(RepresentationsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  beforeEach(async () => {
    meServiceSpy = {
      getMembers: vi.fn().mockReturnValue(of(buildPaginatedResponse())),
    };
    errorHandlerSpy = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [RepresentationsComponent, TranslateModule.forRoot()],
      providers: [{ provide: MeService, useValue: meServiceSpy }],
    })
      .overrideComponent(RepresentationsComponent, {
        remove: {
          providers: [ErrorMessageHandler],
        },
        add: {
          providers: [{ provide: ErrorMessageHandler, useValue: errorHandlerSpy }],
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
  });

  // ── 1. Creation & Initial State ─────────────────────────────────

  describe('creation & initial state', () => {
    it('should create', async () => {
      await createComponent();
      expect(component).toBeTruthy();
    });

    it('should populate members list after lazy-load init', async () => {
      await createComponent();
      expect(component.membersPartialList().length).toBe(1);
      expect(component.membersPartialList()[0].name).toBe('John Doe');
    });

    it('should have pagination matching mock response after init', async () => {
      await createComponent();
      const pag = component.paginationInfo();
      expect(pag.page).toBe(1);
      expect(pag.limit).toBe(10);
      expect(pag.total).toBe(1);
      expect(pag.total_pages).toBe(1);
    });

    it('should have default filter (page 1, limit 10)', async () => {
      await createComponent();
      expect(component.filter()).toEqual({ page: 1, limit: 10 });
    });

    it('should default searchField to community_name', async () => {
      await createComponent();
      expect(component.searchField()).toBe('community_name');
    });

    it('should default searchText to empty string', async () => {
      await createComponent();
      expect(component.searchText()).toBe('');
    });

    it('should default typeFilter to null', async () => {
      await createComponent();
      expect(component.typeFilter()).toBeNull();
    });

    it('should default statusFilter to null', async () => {
      await createComponent();
      expect(component.statusFilter()).toBeNull();
    });
  });

  // ── 2. Computed Signals ─────────────────────────────────────────

  describe('computed signals', () => {
    beforeEach(async () => {
      await createComponent();
    });

    describe('hasActiveFilters', () => {
      it('should be false when no filters are active', () => {
        expect(component.hasActiveFilters()).toBe(false);
      });

      it('should be true when searchText is set', () => {
        component.searchText.set('test');
        expect(component.hasActiveFilters()).toBe(true);
      });

      it('should be true when typeFilter is set', () => {
        component.typeFilter.set(MemberType.INDIVIDUAL);
        expect(component.hasActiveFilters()).toBe(true);
      });

      it('should be true when statusFilter is set', () => {
        component.statusFilter.set(MemberStatus.ACTIVE);
        expect(component.hasActiveFilters()).toBe(true);
      });
    });

    describe('firstRow', () => {
      it('should be 0 for page 1', () => {
        expect(component.firstRow()).toBe(0);
      });

      it('should compute correctly for page 2 with limit 10', () => {
        component.paginationInfo.set({ page: 2, limit: 10, total: 20, total_pages: 2 });
        expect(component.firstRow()).toBe(10);
      });

      it('should compute correctly for page 3 with limit 5', () => {
        component.paginationInfo.set({ page: 3, limit: 5, total: 15, total_pages: 3 });
        expect(component.firstRow()).toBe(10);
      });
    });

    describe('showPaginator', () => {
      it('should be false when total_pages is 1', () => {
        expect(component.showPaginator()).toBe(false);
      });

      it('should be true when total_pages > 1', () => {
        component.paginationInfo.set({ page: 1, limit: 10, total: 25, total_pages: 3 });
        expect(component.showPaginator()).toBe(true);
      });
    });
  });

  // ── 3. loadMembers ──────────────────────────────────────────────

  describe('loadMembers', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should call meService.getMembers with current filter', () => {
      component.filter.set({ page: 2, limit: 10 });
      component.loadMembers();
      expect(meServiceSpy.getMembers).toHaveBeenCalledWith({ page: 2, limit: 10 });
    });

    it('should update membersPartialList on success', () => {
      const members = [
        buildMember({ id: 10, name: 'Alice' }),
        buildMember({ id: 20, name: 'Bob' }),
      ];
      meServiceSpy.getMembers.mockReturnValue(of(buildPaginatedResponse(members)));

      component.loadMembers();

      expect(component.membersPartialList()).toEqual(members);
    });

    it('should update paginationInfo on success', () => {
      const members = [buildMember()];
      meServiceSpy.getMembers.mockReturnValue(
        of(buildPaginatedResponse(members, { page: 2, limit: 5, total: 15, total_pages: 3 })),
      );

      component.loadMembers();

      const pag = component.paginationInfo();
      expect(pag.page).toBe(2);
      expect(pag.limit).toBe(5);
      expect(pag.total).toBe(15);
      expect(pag.total_pages).toBe(3);
    });

    it('should call errorHandler.handleError on falsy response', () => {
      meServiceSpy.getMembers.mockReturnValue(of(null));

      component.loadMembers();

      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(null);
    });

    it('should call errorHandler.handleError on error', () => {
      const error = new Error('Network error');
      meServiceSpy.getMembers.mockReturnValue(throwError(() => error));

      component.loadMembers();

      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(error);
    });
  });

  // ── 4. applyFilters ─────────────────────────────────────────────

  describe('applyFilters', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should reset page to 1 and keep limit', () => {
      component.filter.set({ page: 3, limit: 20 });
      component.applyFilters();
      expect(component.filter().page).toBe(1);
      expect(component.filter().limit).toBe(20);
    });

    it('should set community_name when searchField is community_name', () => {
      component.searchField.set('community_name');
      component.searchText.set('My Community');
      component.applyFilters();
      expect(component.filter().community_name).toBe('My Community');
    });

    it('should set name when searchField is name', () => {
      component.searchField.set('name');
      component.searchText.set('John');
      component.applyFilters();
      expect(component.filter().name).toBe('John');
    });

    it('should not set search fields when searchText is empty', () => {
      component.searchField.set('community_name');
      component.searchText.set('');
      component.applyFilters();
      expect(component.filter().community_name).toBeUndefined();
      expect(component.filter().name).toBeUndefined();
    });

    it('should set member_type when typeFilter is set', () => {
      component.typeFilter.set(MemberType.COMPANY);
      component.applyFilters();
      expect(component.filter().member_type).toBe(MemberType.COMPANY);
    });

    it('should not set member_type when typeFilter is null', () => {
      component.typeFilter.set(null);
      component.applyFilters();
      expect(component.filter().member_type).toBeUndefined();
    });

    it('should set status when statusFilter is set', () => {
      component.statusFilter.set(MemberStatus.PENDING);
      component.applyFilters();
      expect(component.filter().status).toBe(MemberStatus.PENDING);
    });

    it('should not set status when statusFilter is null', () => {
      component.statusFilter.set(null);
      component.applyFilters();
      expect(component.filter().status).toBeUndefined();
    });

    it('should call loadMembers', () => {
      const spy = vi.spyOn(component, 'loadMembers');
      component.applyFilters();
      expect(spy).toHaveBeenCalled();
    });
  });

  // ── 5. Filter Change Handlers ───────────────────────────────────

  describe('filter change handlers', () => {
    beforeEach(async () => {
      await createComponent();
    });

    describe('onSearchTextChange', () => {
      it('should set searchText and call applyFilters', () => {
        const spy = vi.spyOn(component, 'applyFilters');
        component.onSearchTextChange('hello');
        expect(component.searchText()).toBe('hello');
        expect(spy).toHaveBeenCalled();
      });
    });

    describe('onSearchFieldChange', () => {
      it('should call applyFilters when searchText is non-empty', () => {
        component.searchText.set('query');
        const spy = vi.spyOn(component, 'applyFilters');
        component.onSearchFieldChange();
        expect(spy).toHaveBeenCalled();
      });

      it('should NOT call applyFilters when searchText is empty', () => {
        component.searchText.set('');
        const spy = vi.spyOn(component, 'applyFilters');
        component.onSearchFieldChange();
        expect(spy).not.toHaveBeenCalled();
      });
    });

    describe('onTypeFilterChange', () => {
      it('should set typeFilter and call applyFilters', () => {
        const spy = vi.spyOn(component, 'applyFilters');
        component.onTypeFilterChange(MemberType.COMPANY);
        expect(component.typeFilter()).toBe(MemberType.COMPANY);
        expect(spy).toHaveBeenCalled();
      });

      it('should handle null to clear filter', () => {
        component.typeFilter.set(MemberType.INDIVIDUAL);
        component.onTypeFilterChange(null);
        expect(component.typeFilter()).toBeNull();
      });
    });

    describe('onStatusFilterChange', () => {
      it('should set statusFilter and call applyFilters', () => {
        const spy = vi.spyOn(component, 'applyFilters');
        component.onStatusFilterChange(MemberStatus.INACTIVE);
        expect(component.statusFilter()).toBe(MemberStatus.INACTIVE);
        expect(spy).toHaveBeenCalled();
      });

      it('should handle null to clear filter', () => {
        component.statusFilter.set(MemberStatus.ACTIVE);
        component.onStatusFilterChange(null);
        expect(component.statusFilter()).toBeNull();
      });
    });
  });

  // ── 6. Pagination ───────────────────────────────────────────────

  describe('pagination', () => {
    beforeEach(async () => {
      await createComponent();
    });

    describe('lazyLoadMembers', () => {
      it('should calculate page from first and rows', () => {
        component.lazyLoadMembers({ first: 20, rows: 10 });
        expect(component.filter().page).toBe(3);
        expect(meServiceSpy.getMembers).toHaveBeenCalled();
      });

      it('should set page to 1 when rows is 0', () => {
        component.lazyLoadMembers({ first: 0, rows: 0 });
        expect(component.filter().page).toBe(1);
      });

      it('should set page to 1 when first is 0 and rows is 10', () => {
        component.lazyLoadMembers({ first: 0, rows: 10 });
        expect(component.filter().page).toBe(1);
      });
    });

    describe('pageChange', () => {
      it('should calculate page correctly', () => {
        component.pageChange({ first: 10, rows: 10 });
        expect(component.filter().page).toBe(2);
        expect(meServiceSpy.getMembers).toHaveBeenCalled();
      });

      it('should default to 0 and 10 when first/rows are undefined', () => {
        component.pageChange({
          first: undefined as unknown as number,
          rows: undefined as unknown as number,
        });
        expect(component.filter().page).toBe(1);
      });
    });
  });

  // ── 7. clear ────────────────────────────────────────────────────

  describe('clear', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should reset all signals and filters to defaults', () => {
      component.searchText.set('test');
      component.searchField.set('name');
      component.typeFilter.set(MemberType.COMPANY);
      component.statusFilter.set(MemberStatus.INACTIVE);
      component.filter.set({ page: 5, limit: 20, name: 'test' });

      const tableMock = { clear: vi.fn() } as unknown as Table;
      component.clear(tableMock);

      expect(component.searchText()).toBe('');
      expect(component.searchField()).toBe('community_name');
      expect(component.typeFilter()).toBeNull();
      expect(component.statusFilter()).toBeNull();
      expect(component.filter()).toEqual({ page: 1, limit: 10 });
    });

    it('should call table.clear()', () => {
      const clearFn = vi.fn();
      const tableMock = { clear: clearFn } as unknown as Table;
      component.clear(tableMock);
      expect(clearFn).toHaveBeenCalled();
    });

    it('should call loadMembers', () => {
      const spy = vi.spyOn(component, 'loadMembers');
      const tableMock = { clear: vi.fn() } as unknown as Table;
      component.clear(tableMock);
      expect(spy).toHaveBeenCalled();
    });
  });

  // ── 8. onRowClick ───────────────────────────────────────────────

  describe('onRowClick', () => {
    it('should log member id to console', async () => {
      await createComponent();
      const consoleSpy = vi.spyOn(console, 'log');
      const member = buildMember({ id: 42 });

      component.onRowClick(member);

      expect(consoleSpy).toHaveBeenCalledWith('Row clicked:', 42);
    });
  });
});
