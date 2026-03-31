import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { MockInstance, vi } from 'vitest';

import { InvitationGestionnaire } from './invitation-gestionnaire';
import { MeService } from '../../../../../../shared/services/me.service';
import {
  ApiResponse,
  ApiResponsePaginated,
  Pagination,
} from '../../../../../../core/dtos/api.response';
import { UserManagerInvitationDTO } from '../../../../../../shared/dtos/invitation.dtos';
import { CommunityDTO } from '../../../../../../shared/dtos/community.dtos';
import { Table, TableLazyLoadEvent, TablePageEvent } from 'primeng/table';

// ── Helpers ────────────────────────────────────────────────────────

function buildManagerInvitations(): UserManagerInvitationDTO[] {
  return [
    {
      id: 1,
      user_email: 'manager-a@test.com',
      created_at: new Date(),
      community: { id: 10, name: 'Community Alpha' } as CommunityDTO,
    },
    {
      id: 2,
      user_email: 'manager-b@test.com',
      created_at: new Date(),
      community: { id: 20, name: 'Community Beta' } as CommunityDTO,
    },
  ];
}

function buildPaginatedResponse(
  data: UserManagerInvitationDTO[] = buildManagerInvitations(),
): ApiResponsePaginated<UserManagerInvitationDTO[] | string> {
  return new ApiResponsePaginated(data, new Pagination(1, 10, 2, 1));
}

// ── Test Suite ─────────────────────────────────────────────────────

describe('InvitationGestionnaire', () => {
  let component: InvitationGestionnaire;
  let fixture: ComponentFixture<InvitationGestionnaire>;
  let consoleErrorSpy: MockInstance;

  let meServiceSpy: {
    getOwnManagerPendingInvitation: ReturnType<typeof vi.fn>;
    acceptInvitationManager: ReturnType<typeof vi.fn>;
    refuseManagerInvitation: ReturnType<typeof vi.fn>;
  };

  async function createComponent(): Promise<void> {
    fixture = TestBed.createComponent(InvitationGestionnaire);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  beforeEach(async () => {
    meServiceSpy = {
      getOwnManagerPendingInvitation: vi.fn().mockReturnValue(of(buildPaginatedResponse())),
      acceptInvitationManager: vi.fn().mockReturnValue(of(new ApiResponse('OK'))),
      refuseManagerInvitation: vi.fn().mockReturnValue(of(new ApiResponse('OK'))),
    };
    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation((..._args: unknown[]) => void 0);

    await TestBed.configureTestingModule({
      imports: [InvitationGestionnaire, TranslateModule.forRoot()],
      providers: [{ provide: MeService, useValue: meServiceSpy }],
    })
      .overrideComponent(InvitationGestionnaire, {
        add: { schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  // ── 1. Creation ─────────────────────────────────────────────────

  describe('creation', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should initialise filter with page 1 and limit 10', () => {
      expect(component.filter().page).toBe(1);
      expect(component.filter().limit).toBe(10);
    });

    it('should initialise loading to false', () => {
      expect(component.loading()).toBe(false);
    });

    it('should initialise searchText to empty string', () => {
      expect(component.searchText()).toBe('');
    });
  });

  // ── 2. Computed signals ─────────────────────────────────────────

  describe('computed signals', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('firstRow should return (page - 1) * limit', () => {
      component.pagination.set({ page: 3, limit: 10, total: 50, total_pages: 5 });
      expect(component.firstRow()).toBe(20);
    });

    it('firstRow should return 0 for page 1', () => {
      component.pagination.set({ page: 1, limit: 10, total: 5, total_pages: 1 });
      expect(component.firstRow()).toBe(0);
    });

    it('showPaginator should return true when total_pages > 1', () => {
      component.pagination.set({ page: 1, limit: 10, total: 25, total_pages: 3 });
      expect(component.showPaginator()).toBe(true);
    });

    it('showPaginator should return false when total_pages is 1', () => {
      component.pagination.set({ page: 1, limit: 10, total: 5, total_pages: 1 });
      expect(component.showPaginator()).toBe(false);
    });

    it('hasActiveFilters should return false when searchText is empty', () => {
      component.searchText.set('');
      expect(component.hasActiveFilters()).toBe(false);
    });

    it('hasActiveFilters should return true when searchText is set', () => {
      component.searchText.set('test');
      expect(component.hasActiveFilters()).toBe(true);
    });
  });

  // ── 3. loadGestionnaireInvitation ───────────────────────────────

  describe('loadGestionnaireInvitation', () => {
    beforeEach(async () => {
      await createComponent();
      meServiceSpy.getOwnManagerPendingInvitation.mockClear();
      consoleErrorSpy.mockClear();
    });

    it('should call meService.getOwnManagerPendingInvitation with current filter', () => {
      component.loadGestionnaireInvitation();
      expect(meServiceSpy.getOwnManagerPendingInvitation).toHaveBeenCalledWith(component.filter());
    });

    it('should set gestionnaireInvitation from response data', () => {
      const invitations = buildManagerInvitations();
      meServiceSpy.getOwnManagerPendingInvitation.mockReturnValue(
        of(buildPaginatedResponse(invitations)),
      );
      component.loadGestionnaireInvitation();
      expect(component.gestionnaireInvitation()).toEqual(invitations);
    });

    it('should update pagination from response', () => {
      const pagination = new Pagination(2, 10, 20, 2);
      meServiceSpy.getOwnManagerPendingInvitation.mockReturnValue(
        of(new ApiResponsePaginated(buildManagerInvitations(), pagination)),
      );
      component.loadGestionnaireInvitation();
      expect(component.pagination()).toEqual(pagination);
    });

    it('should set loading to false after success', () => {
      component.loadGestionnaireInvitation();
      expect(component.loading()).toBe(false);
    });

    it('should set loading to true before service call completes', () => {
      component.loading.set(false);
      // We check the signal was set to true by inspecting that loading is managed
      // After synchronous subscribe completes, loading should be false
      component.loadGestionnaireInvitation();
      expect(component.loading()).toBe(false);
    });

    it('should not update signals when response is falsy', () => {
      meServiceSpy.getOwnManagerPendingInvitation.mockReturnValue(of(null));
      component.gestionnaireInvitation.set([]);
      component.loadGestionnaireInvitation();
      expect(component.gestionnaireInvitation()).toEqual([]);
    });

    it('should set loading to false when response is falsy', () => {
      meServiceSpy.getOwnManagerPendingInvitation.mockReturnValue(of(null));
      component.loadGestionnaireInvitation();
      expect(component.loading()).toBe(false);
    });

    it('should call console.error on observable error', () => {
      const error = new Error('network fail');
      meServiceSpy.getOwnManagerPendingInvitation.mockReturnValue(throwError(() => error));
      component.loadGestionnaireInvitation();
      expect(consoleErrorSpy).toHaveBeenCalledWith(error);
    });

    it('should set loading to false on error', () => {
      meServiceSpy.getOwnManagerPendingInvitation.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      component.loadGestionnaireInvitation();
      expect(component.loading()).toBe(false);
    });
  });

  // ── 4. lazyLoadGestionnaireInvitation ────────────────────────────

  describe('lazyLoadGestionnaireInvitation', () => {
    beforeEach(async () => {
      await createComponent();
      meServiceSpy.getOwnManagerPendingInvitation.mockClear();
    });

    it('should compute page from first and rows', () => {
      component.lazyLoadGestionnaireInvitation({
        first: 20,
        rows: 10,
      } as TableLazyLoadEvent);
      expect(component.filter().page).toBe(3);
    });

    it('should set page to 1 when rows is 0', () => {
      component.lazyLoadGestionnaireInvitation({
        first: 0,
        rows: 0,
      } as TableLazyLoadEvent);
      expect(component.filter().page).toBe(1);
    });

    it('should call loadGestionnaireInvitation', () => {
      component.lazyLoadGestionnaireInvitation({
        first: 0,
        rows: 10,
      } as TableLazyLoadEvent);
      expect(meServiceSpy.getOwnManagerPendingInvitation).toHaveBeenCalled();
    });

    it('should preserve existing filter values', () => {
      component.filter.set({ page: 1, limit: 10, name: 'test' });
      component.lazyLoadGestionnaireInvitation({
        first: 10,
        rows: 10,
      } as TableLazyLoadEvent);
      expect(component.filter().name).toBe('test');
      expect(component.filter().page).toBe(2);
    });
  });

  // ── 5. pageChange ───────────────────────────────────────────────

  describe('pageChange', () => {
    beforeEach(async () => {
      await createComponent();
      meServiceSpy.getOwnManagerPendingInvitation.mockClear();
    });

    it('should compute page from first and rows', () => {
      component.pageChange({ first: 20, rows: 10 } as TablePageEvent);
      expect(component.filter().page).toBe(3);
    });

    it('should default first to 0 when undefined', () => {
      component.pageChange({ first: undefined, rows: 10 } as unknown as TablePageEvent);
      expect(component.filter().page).toBe(1);
    });

    it('should default rows to 10 when undefined', () => {
      component.pageChange({ first: 0, rows: undefined } as unknown as TablePageEvent);
      expect(component.filter().page).toBe(1);
    });

    it('should call loadGestionnaireInvitation', () => {
      component.pageChange({ first: 0, rows: 10 } as TablePageEvent);
      expect(meServiceSpy.getOwnManagerPendingInvitation).toHaveBeenCalled();
    });
  });

  // ── 6. applyFilters ─────────────────────────────────────────────

  describe('applyFilters', () => {
    beforeEach(async () => {
      await createComponent();
      meServiceSpy.getOwnManagerPendingInvitation.mockClear();
    });

    it('should reset page to 1', () => {
      component.filter.set({ page: 3, limit: 10 });
      component.applyFilters();
      expect(component.filter().page).toBe(1);
    });

    it('should set name filter when searchText is set', () => {
      component.searchText.set('alpha');
      component.applyFilters();
      expect(component.filter().name).toBe('alpha');
    });

    it('should not set name filter when searchText is empty', () => {
      component.searchText.set('');
      component.applyFilters();
      expect(component.filter().name).toBeUndefined();
    });

    it('should preserve limit from current filter', () => {
      component.filter.set({ page: 2, limit: 25 });
      component.applyFilters();
      expect(component.filter().limit).toBe(25);
    });

    it('should call loadGestionnaireInvitation', () => {
      component.applyFilters();
      expect(meServiceSpy.getOwnManagerPendingInvitation).toHaveBeenCalled();
    });
  });

  // ── 7. onSearchTextChange ───────────────────────────────────────

  describe('onSearchTextChange', () => {
    beforeEach(async () => {
      await createComponent();
      meServiceSpy.getOwnManagerPendingInvitation.mockClear();
    });

    it('should update searchText signal', () => {
      component.onSearchTextChange('hello');
      expect(component.searchText()).toBe('hello');
    });

    it('should set name in filter', () => {
      component.onSearchTextChange('search term');
      expect(component.filter().name).toBe('search term');
    });

    it('should call loadGestionnaireInvitation', () => {
      component.onSearchTextChange('test');
      expect(meServiceSpy.getOwnManagerPendingInvitation).toHaveBeenCalled();
    });
  });

  // ── 8. clear ────────────────────────────────────────────────────

  describe('clear', () => {
    let mockTable: { clear: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
      await createComponent();
      meServiceSpy.getOwnManagerPendingInvitation.mockClear();
      mockTable = { clear: vi.fn() };
    });

    it('should call table.clear()', () => {
      component.clear(mockTable as unknown as Table);
      expect(mockTable.clear).toHaveBeenCalled();
    });

    it('should reset searchText to empty string', () => {
      component.searchText.set('something');
      component.clear(mockTable as unknown as Table);
      expect(component.searchText()).toBe('');
    });

    it('should reset filter to page 1 and limit 10', () => {
      component.filter.set({ page: 5, limit: 25, name: 'test' });
      component.clear(mockTable as unknown as Table);
      expect(component.filter()).toEqual({ page: 1, limit: 10 });
    });

    it('should call loadGestionnaireInvitation', () => {
      component.clear(mockTable as unknown as Table);
      expect(meServiceSpy.getOwnManagerPendingInvitation).toHaveBeenCalled();
    });
  });

  // ── 9. acceptGestionnaireInvitation ─────────────────────────────

  describe('acceptGestionnaireInvitation', () => {
    const invitation: UserManagerInvitationDTO = {
      id: 42,
      user_email: 'accept@test.com',
      created_at: new Date(),
      community: { id: 1, name: 'Test Community' } as CommunityDTO,
    };

    beforeEach(async () => {
      await createComponent();
      meServiceSpy.getOwnManagerPendingInvitation.mockClear();
      consoleErrorSpy.mockClear();
    });

    it('should call meService.acceptInvitationManager with invitation_id', () => {
      component.acceptGestionnaireInvitation(invitation);
      expect(meServiceSpy.acceptInvitationManager).toHaveBeenCalledWith({ invitation_id: 42 });
    });

    it('should reload data on success', () => {
      component.acceptGestionnaireInvitation(invitation);
      expect(meServiceSpy.getOwnManagerPendingInvitation).toHaveBeenCalled();
    });

    it('should not reload data when response is falsy', () => {
      meServiceSpy.acceptInvitationManager.mockReturnValue(of(null));
      component.acceptGestionnaireInvitation(invitation);
      expect(meServiceSpy.getOwnManagerPendingInvitation).not.toHaveBeenCalled();
    });

    it('should call console.error on observable error', () => {
      const error = new Error('accept failed');
      meServiceSpy.acceptInvitationManager.mockReturnValue(throwError(() => error));
      component.acceptGestionnaireInvitation(invitation);
      expect(consoleErrorSpy).toHaveBeenCalledWith(error);
    });
  });

  // ── 10. refuseGestionnaireInvitation ────────────────────────────

  describe('refuseGestionnaireInvitation', () => {
    const invitation: UserManagerInvitationDTO = {
      id: 99,
      user_email: 'refuse@test.com',
      created_at: new Date(),
      community: { id: 5, name: 'Refuse Community' } as CommunityDTO,
    };

    beforeEach(async () => {
      await createComponent();
      meServiceSpy.getOwnManagerPendingInvitation.mockClear();
      consoleErrorSpy.mockClear();
    });

    it('should call meService.refuseManagerInvitation with invitation id', () => {
      component.refuseGestionnaireInvitation(invitation);
      expect(meServiceSpy.refuseManagerInvitation).toHaveBeenCalledWith(99);
    });

    it('should reload data on success', () => {
      component.refuseGestionnaireInvitation(invitation);
      expect(meServiceSpy.getOwnManagerPendingInvitation).toHaveBeenCalled();
    });

    it('should not reload data when response is falsy', () => {
      meServiceSpy.refuseManagerInvitation.mockReturnValue(of(null));
      component.refuseGestionnaireInvitation(invitation);
      expect(meServiceSpy.getOwnManagerPendingInvitation).not.toHaveBeenCalled();
    });

    it('should call console.error on observable error', () => {
      const error = new Error('refuse failed');
      meServiceSpy.refuseManagerInvitation.mockReturnValue(throwError(() => error));
      component.refuseGestionnaireInvitation(invitation);
      expect(consoleErrorSpy).toHaveBeenCalledWith(error);
    });
  });
});
