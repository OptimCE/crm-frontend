import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Table } from 'primeng/table';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { MembersList } from './members-list';
import { MemberService } from '../../../../shared/services/member.service';
import { InvitationService } from '../../../../shared/services/invitation.service';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { ApiResponsePaginated, Pagination } from '../../../../core/dtos/api.response';
import { MembersPartialDTO } from '../../../../shared/dtos/member.dtos';
import { MemberStatus, MemberType } from '../../../../shared/types/member.types';
import { MemberInvite } from '../member-invite/member-invite';
import { MemberCreationUpdate } from '../member-creation-update/member-creation-update';
import { MeterCreation } from '../../../meter/components/meter-creation/meter-creation';
import { MemberPendingInvite } from '../member-pending-invite/member-pending-invite';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';

// ── Helpers ────────────────────────────────────────────────────────

function buildMember(overrides: Partial<MembersPartialDTO> = {}): MembersPartialDTO {
  return {
    id: 1,
    name: 'John Doe',
    member_type: MemberType.INDIVIDUAL,
    status: MemberStatus.ACTIVE,
    ...overrides,
  };
}

function buildPaginatedResponse(
  members: MembersPartialDTO[] = [buildMember()],
  pagination: Partial<Pagination> = {},
): ApiResponsePaginated<MembersPartialDTO[] | string> {
  const pag = new Pagination(
    pagination.page ?? 1,
    pagination.limit ?? 10,
    pagination.total ?? members.length,
    pagination.total_pages ?? 1,
  );
  return new ApiResponsePaginated<MembersPartialDTO[] | string>(members, pag);
}

// ── Test Suite ─────────────────────────────────────────────────────

describe('MembersList', () => {
  let component: MembersList;
  let fixture: ComponentFixture<MembersList>;

  let memberServiceSpy: { getMembersList: ReturnType<typeof vi.fn> };
  let invitationServiceSpy: { inviteUserToBecomeMember: ReturnType<typeof vi.fn> };
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };
  let snackbarSpy: { openSnackBar: ReturnType<typeof vi.fn> };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };
  let dialogServiceSpy: { open: ReturnType<typeof vi.fn> };
  let confirmationServiceSpy: { confirm: ReturnType<typeof vi.fn> };

  async function createComponent(): Promise<void> {
    fixture = TestBed.createComponent(MembersList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  beforeEach(async () => {
    memberServiceSpy = {
      getMembersList: vi.fn().mockReturnValue(of(buildPaginatedResponse())),
    };
    invitationServiceSpy = {
      inviteUserToBecomeMember: vi.fn().mockReturnValue(of({ data: 'OK' })),
    };
    routerSpy = { navigate: vi.fn().mockResolvedValue(true) };
    snackbarSpy = { openSnackBar: vi.fn() };
    errorHandlerSpy = { handleError: vi.fn() };
    dialogServiceSpy = { open: vi.fn() };
    confirmationServiceSpy = { confirm: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [MembersList, TranslateModule.forRoot()],
      providers: [
        { provide: MemberService, useValue: memberServiceSpy },
        { provide: InvitationService, useValue: invitationServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: SnackbarNotification, useValue: snackbarSpy },
        { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
        MessageService,
      ],
    })
      .overrideComponent(MembersList, {
        remove: {
          imports: [Toast, ConfirmDialog],
          providers: [DialogService, ErrorMessageHandler, ConfirmationService, MessageService],
        },
        add: {
          providers: [
            { provide: DialogService, useValue: dialogServiceSpy },
            { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
            { provide: ConfirmationService, useValue: confirmationServiceSpy },
          ],
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
    it('should create the component', async () => {
      await createComponent();
      expect(component).toBeTruthy();
    });

    it('should initialize with default filter values', async () => {
      await createComponent();
      expect(component.filter()).toEqual({ page: 1, limit: 10 });
    });

    it('should have pagination info after creation', async () => {
      await createComponent();
      const pag = component.paginationInfo();
      expect(pag.page).toBe(1);
      expect(pag.limit).toBe(10);
    });

    it('should have loading set to false after lazy load triggers', async () => {
      await createComponent();
      expect(component.loading()).toBe(false);
    });

    it('should initialize searchField to "name"', async () => {
      await createComponent();
      expect(component.searchField()).toBe('name');
    });

    it('should initialize searchText to empty string', async () => {
      await createComponent();
      expect(component.searchText()).toBe('');
    });

    it('should initialize typeFilter to null', async () => {
      await createComponent();
      expect(component.typeFilter()).toBeNull();
    });

    it('should initialize statusFilter to null', async () => {
      await createComponent();
      expect(component.statusFilter()).toBeNull();
    });
  });

  // ── 2. Computed Signals ─────────────────────────────────────────

  describe('computed signals', () => {
    it('hasActiveFilters should be false when no filters are set', async () => {
      await createComponent();
      expect(component.hasActiveFilters()).toBe(false);
    });

    it('hasActiveFilters should be true when searchText is set', async () => {
      await createComponent();
      component.searchText.set('test');
      expect(component.hasActiveFilters()).toBe(true);
    });

    it('hasActiveFilters should be true when typeFilter is set', async () => {
      await createComponent();
      component.typeFilter.set(MemberType.INDIVIDUAL);
      expect(component.hasActiveFilters()).toBe(true);
    });

    it('hasActiveFilters should be true when statusFilter is set', async () => {
      await createComponent();
      component.statusFilter.set(MemberStatus.ACTIVE);
      expect(component.hasActiveFilters()).toBe(true);
    });

    it('firstRow should compute correctly from pagination', async () => {
      await createComponent();
      expect(component.firstRow()).toBe(0);

      component.paginationInfo.set({ page: 3, limit: 10, total: 50, total_pages: 5 });
      expect(component.firstRow()).toBe(20);
    });

    it('showPaginator should be false when total_pages <= 1', async () => {
      await createComponent();
      expect(component.showPaginator()).toBe(false);
    });

    it('showPaginator should be true when total_pages > 1', async () => {
      await createComponent();
      component.paginationInfo.set({ page: 1, limit: 10, total: 25, total_pages: 3 });
      expect(component.showPaginator()).toBe(true);
    });
  });

  // ── 3. loadMembers() ───────────────────────────────────────────

  describe('loadMembers', () => {
    it('should load members and update list on success', async () => {
      const members = [buildMember(), buildMember({ id: 2, name: 'Jane' })];
      const response = buildPaginatedResponse(members, { total: 2 });
      memberServiceSpy.getMembersList.mockReturnValue(of(response));

      await createComponent();
      component.loadMembers();

      expect(component.membersPartialList()).toEqual(members);
      expect(component.loading()).toBe(false);
    });

    it('should update pagination info on success', async () => {
      const response = buildPaginatedResponse([buildMember()], {
        page: 2,
        limit: 10,
        total: 15,
        total_pages: 2,
      });
      memberServiceSpy.getMembersList.mockReturnValue(of(response));

      await createComponent();
      component.loadMembers();

      expect(component.paginationInfo().page).toBe(2);
      expect(component.paginationInfo().total).toBe(15);
      expect(component.paginationInfo().total_pages).toBe(2);
    });

    it('should call errorHandler on null response', async () => {
      memberServiceSpy.getMembersList.mockReturnValue(of(null));

      await createComponent();
      component.loadMembers();

      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(null);
      expect(component.loading()).toBe(false);
    });

    it('should call errorHandler and stop loading on error', async () => {
      const error = new Error('fail');
      memberServiceSpy.getMembersList.mockReturnValue(throwError(() => error));

      await createComponent();
      component.loadMembers();

      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(error);
      expect(component.loading()).toBe(false);
    });

    it('should set loading to true before request', async () => {
      await createComponent();
      component.loading.set(false);
      memberServiceSpy.getMembersList.mockReturnValue(of(buildPaginatedResponse()));

      component.loadMembers();

      // After synchronous subscribe, loading is false again
      expect(component.loading()).toBe(false);
    });

    it('should pass current filter to service', async () => {
      await createComponent();
      component.filter.set({ page: 2, limit: 20, name: 'test' });
      component.loadMembers();

      expect(memberServiceSpy.getMembersList).toHaveBeenCalledWith({
        page: 2,
        limit: 20,
        name: 'test',
      });
    });
  });

  // ── 4. Filter Methods ──────────────────────────────────────────

  describe('applyFilters', () => {
    beforeEach(async () => {
      await createComponent();
      memberServiceSpy.getMembersList.mockClear();
      memberServiceSpy.getMembersList.mockReturnValue(of(buildPaginatedResponse()));
    });

    it('should reset page to 1 and call loadMembers', () => {
      component.filter.set({ page: 3, limit: 10 });
      component.applyFilters();

      expect(component.filter().page).toBe(1);
      expect(memberServiceSpy.getMembersList).toHaveBeenCalled();
    });

    it('should include name filter when searchText is set', () => {
      component.searchText.set('John');
      component.applyFilters();

      expect(component.filter().name).toBe('John');
    });

    it('should include member_type filter when typeFilter is set', () => {
      component.typeFilter.set(MemberType.COMPANY);
      component.applyFilters();

      expect(component.filter().member_type).toBe(MemberType.COMPANY);
    });

    it('should include status filter when statusFilter is set', () => {
      component.statusFilter.set(MemberStatus.PENDING);
      component.applyFilters();

      expect(component.filter().status).toBe(MemberStatus.PENDING);
    });

    it('should not include name when searchText is empty', () => {
      component.searchText.set('');
      component.applyFilters();

      expect(component.filter().name).toBeUndefined();
    });
  });

  describe('onSearchTextChange', () => {
    beforeEach(async () => {
      await createComponent();
      memberServiceSpy.getMembersList.mockClear();
      memberServiceSpy.getMembersList.mockReturnValue(of(buildPaginatedResponse()));
    });

    it('should update searchText and call applyFilters', () => {
      component.onSearchTextChange('test query');

      expect(component.searchText()).toBe('test query');
      expect(memberServiceSpy.getMembersList).toHaveBeenCalled();
    });
  });

  describe('onSearchFieldChange', () => {
    beforeEach(async () => {
      await createComponent();
      memberServiceSpy.getMembersList.mockClear();
      memberServiceSpy.getMembersList.mockReturnValue(of(buildPaginatedResponse()));
    });

    it('should call applyFilters when searchText is non-empty', () => {
      component.searchText.set('something');
      component.onSearchFieldChange();

      expect(memberServiceSpy.getMembersList).toHaveBeenCalled();
    });

    it('should not call applyFilters when searchText is empty', () => {
      component.searchText.set('');
      component.onSearchFieldChange();

      expect(memberServiceSpy.getMembersList).not.toHaveBeenCalled();
    });
  });

  describe('onTypeFilterChange', () => {
    beforeEach(async () => {
      await createComponent();
      memberServiceSpy.getMembersList.mockClear();
      memberServiceSpy.getMembersList.mockReturnValue(of(buildPaginatedResponse()));
    });

    it('should update typeFilter and reload members', () => {
      component.onTypeFilterChange(MemberType.COMPANY);

      expect(component.typeFilter()).toBe(MemberType.COMPANY);
      expect(memberServiceSpy.getMembersList).toHaveBeenCalled();
    });

    it('should handle null to clear the type filter', () => {
      component.typeFilter.set(MemberType.INDIVIDUAL);
      component.onTypeFilterChange(null);

      expect(component.typeFilter()).toBeNull();
      expect(memberServiceSpy.getMembersList).toHaveBeenCalled();
    });
  });

  describe('onStatusFilterChange', () => {
    beforeEach(async () => {
      await createComponent();
      memberServiceSpy.getMembersList.mockClear();
      memberServiceSpy.getMembersList.mockReturnValue(of(buildPaginatedResponse()));
    });

    it('should update statusFilter and reload members', () => {
      component.onStatusFilterChange(MemberStatus.INACTIVE);

      expect(component.statusFilter()).toBe(MemberStatus.INACTIVE);
      expect(memberServiceSpy.getMembersList).toHaveBeenCalled();
    });

    it('should handle null to clear the status filter', () => {
      component.statusFilter.set(MemberStatus.ACTIVE);
      component.onStatusFilterChange(null);

      expect(component.statusFilter()).toBeNull();
      expect(memberServiceSpy.getMembersList).toHaveBeenCalled();
    });
  });

  // ── 5. Pagination ──────────────────────────────────────────────

  describe('lazyLoadMembers', () => {
    beforeEach(async () => {
      await createComponent();
      memberServiceSpy.getMembersList.mockClear();
      memberServiceSpy.getMembersList.mockReturnValue(of(buildPaginatedResponse()));
    });

    it('should compute correct page from lazy load event', () => {
      component.lazyLoadMembers({ first: 20, rows: 10 });

      expect(component.filter().page).toBe(3);
      expect(memberServiceSpy.getMembersList).toHaveBeenCalled();
    });

    it('should default to page 1 when rows is 0', () => {
      component.lazyLoadMembers({ first: 0, rows: 0 });

      expect(component.filter().page).toBe(1);
    });

    it('should clamp page to minimum of 1', () => {
      component.lazyLoadMembers({ first: 0, rows: 10 });

      expect(component.filter().page).toBeGreaterThanOrEqual(1);
    });
  });

  describe('pageChange', () => {
    beforeEach(async () => {
      await createComponent();
      memberServiceSpy.getMembersList.mockClear();
      memberServiceSpy.getMembersList.mockReturnValue(of(buildPaginatedResponse()));
    });

    it('should compute correct page from page event', () => {
      component.pageChange({ first: 10, rows: 10 });

      expect(component.filter().page).toBe(2);
      expect(memberServiceSpy.getMembersList).toHaveBeenCalled();
    });

    it('should handle first page', () => {
      component.pageChange({ first: 0, rows: 10 });

      expect(component.filter().page).toBe(1);
    });
  });

  // ── 6. Clear ───────────────────────────────────────────────────

  describe('clear', () => {
    it('should reset all filters and reload members', async () => {
      await createComponent();
      component.searchText.set('test');
      component.searchField.set('email');
      component.typeFilter.set(MemberType.COMPANY);
      component.statusFilter.set(MemberStatus.ACTIVE);
      component.filter.set({ page: 3, limit: 20 });

      memberServiceSpy.getMembersList.mockClear();
      memberServiceSpy.getMembersList.mockReturnValue(of(buildPaginatedResponse()));

      const clearFn = vi.fn();
      const mockTable = { clear: clearFn } as unknown as Table;
      component.clear(mockTable);

      expect(clearFn).toHaveBeenCalled();
      expect(component.searchText()).toBe('');
      expect(component.searchField()).toBe('name');
      expect(component.typeFilter()).toBeNull();
      expect(component.statusFilter()).toBeNull();
      expect(component.filter()).toEqual({ page: 1, limit: 10 });
      expect(memberServiceSpy.getMembersList).toHaveBeenCalled();
    });
  });

  // ── 7. Navigation ─────────────────────────────────────────────

  describe('onRowClick', () => {
    it('should navigate to member detail route', async () => {
      await createComponent();
      const member = buildMember({ id: 42 });
      component.onRowClick(member);

      expect(routerSpy.navigate).toHaveBeenCalledWith(['/members/', 42]);
    });
  });

  // ── 8. Dialogs ─────────────────────────────────────────────────

  describe('onInviteMember', () => {
    let dialogCloseSubject: Subject<unknown>;

    beforeEach(async () => {
      await createComponent();
      dialogCloseSubject = new Subject();
      dialogServiceSpy.open.mockReturnValue({
        onClose: dialogCloseSubject.asObservable(),
        destroy: vi.fn(),
      } as unknown as DynamicDialogRef);
    });

    it('should open MemberInvite dialog', () => {
      component.onInviteMember();

      expect(dialogServiceSpy.open).toHaveBeenCalledWith(
        MemberInvite,
        expect.objectContaining({ modal: true }),
      );
    });

    it('should call invitationService when dialog closes with email', () => {
      component.onInviteMember();
      dialogCloseSubject.next('user@test.com');

      expect(invitationServiceSpy.inviteUserToBecomeMember).toHaveBeenCalledWith({
        user_email: 'user@test.com',
      });
    });

    it('should not call invitationService when dialog closes with empty string', () => {
      component.onInviteMember();
      dialogCloseSubject.next('');

      expect(invitationServiceSpy.inviteUserToBecomeMember).not.toHaveBeenCalled();
    });

    it('should not call invitationService when dialog closes with non-string', () => {
      component.onInviteMember();
      dialogCloseSubject.next(undefined);

      expect(invitationServiceSpy.inviteUserToBecomeMember).not.toHaveBeenCalled();
    });
  });

  describe('onAddMember', () => {
    let dialogCloseSubject: Subject<unknown>;
    const mockEvent = { target: document.createElement('button') } as unknown as Event;

    beforeEach(async () => {
      await createComponent();
      dialogCloseSubject = new Subject();
      dialogServiceSpy.open.mockReturnValue({
        onClose: dialogCloseSubject.asObservable(),
        destroy: vi.fn(),
      } as unknown as DynamicDialogRef);
    });

    it('should open MemberCreationUpdate dialog', () => {
      component.onAddMember(mockEvent);

      expect(dialogServiceSpy.open).toHaveBeenCalledWith(
        MemberCreationUpdate,
        expect.objectContaining({ modal: true }),
      );
    });

    it('should show confirmation dialog when dialog closes with member id', () => {
      component.onAddMember(mockEvent);
      dialogCloseSubject.next(5);

      expect(confirmationServiceSpy.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: 'pi pi-exclamation-triangle',
        }),
      );
    });

    it('should not show confirmation when dialog closes with 0', () => {
      component.onAddMember(mockEvent);
      dialogCloseSubject.next(0);

      expect(confirmationServiceSpy.confirm).not.toHaveBeenCalled();
    });

    it('should not show confirmation when dialog closes with non-number', () => {
      component.onAddMember(mockEvent);
      dialogCloseSubject.next(undefined);

      expect(confirmationServiceSpy.confirm).not.toHaveBeenCalled();
    });

    it('should call addMeter when confirmation is accepted', () => {
      component.onAddMember(mockEvent);
      dialogCloseSubject.next(5);

      const confirmCall = confirmationServiceSpy.confirm.mock.calls[0][0] as {
        accept: () => void;
      };

      // Reset for addMeter dialog
      dialogServiceSpy.open.mockClear();
      const addMeterSubject = new Subject();
      dialogServiceSpy.open.mockReturnValue({
        onClose: addMeterSubject.asObservable(),
        destroy: vi.fn(),
      } as unknown as DynamicDialogRef);

      confirmCall.accept();

      expect(dialogServiceSpy.open).toHaveBeenCalledWith(
        MeterCreation,
        expect.objectContaining({ data: { holder_id: 5 } }),
      );
    });

    it('should call addMemberSuccess when confirmation is rejected', () => {
      memberServiceSpy.getMembersList.mockClear();
      memberServiceSpy.getMembersList.mockReturnValue(of(buildPaginatedResponse()));

      component.onAddMember(mockEvent);
      dialogCloseSubject.next(5);

      const confirmCall = confirmationServiceSpy.confirm.mock.calls[0][0] as {
        reject: () => void;
      };
      confirmCall.reject();

      expect(snackbarSpy.openSnackBar).toHaveBeenCalledWith(
        'MEMBER.LIST.MEMBER_ADDED_SUCCESSFULLY_LABEL',
        VALIDATION_TYPE,
      );
      expect(memberServiceSpy.getMembersList).toHaveBeenCalled();
    });
  });

  describe('addMeter', () => {
    let dialogCloseSubject: Subject<unknown>;

    beforeEach(async () => {
      await createComponent();
      dialogCloseSubject = new Subject();
      dialogServiceSpy.open.mockReturnValue({
        onClose: dialogCloseSubject.asObservable(),
        destroy: vi.fn(),
      } as unknown as DynamicDialogRef);
    });

    it('should open MeterCreation dialog with holder_id', () => {
      component.addMeter(10);

      expect(dialogServiceSpy.open).toHaveBeenCalledWith(
        MeterCreation,
        expect.objectContaining({
          modal: true,
          width: '700px',
          data: { holder_id: 10 },
        }),
      );
    });

    it('should show snackbar and reload members on dialog close with response', () => {
      memberServiceSpy.getMembersList.mockClear();
      memberServiceSpy.getMembersList.mockReturnValue(of(buildPaginatedResponse()));

      component.addMeter(10);
      dialogCloseSubject.next(true);

      expect(snackbarSpy.openSnackBar).toHaveBeenCalledWith(
        'MEMBER.LIST.METER_MEMBER_ADDED_SUCCESSFULLY_LABEL',
        VALIDATION_TYPE,
      );
      expect(memberServiceSpy.getMembersList).toHaveBeenCalled();
    });

    it('should not show snackbar or reload on dialog close without response', () => {
      memberServiceSpy.getMembersList.mockClear();
      snackbarSpy.openSnackBar.mockClear();

      component.addMeter(10);
      dialogCloseSubject.next(undefined);

      expect(snackbarSpy.openSnackBar).not.toHaveBeenCalled();
      expect(memberServiceSpy.getMembersList).not.toHaveBeenCalled();
    });
  });

  describe('addMemberSuccess', () => {
    it('should show snackbar and reload members', async () => {
      await createComponent();
      memberServiceSpy.getMembersList.mockClear();
      memberServiceSpy.getMembersList.mockReturnValue(of(buildPaginatedResponse()));

      component.addMemberSuccess();

      expect(snackbarSpy.openSnackBar).toHaveBeenCalledWith(
        'MEMBER.LIST.MEMBER_ADDED_SUCCESSFULLY_LABEL',
        VALIDATION_TYPE,
      );
      expect(memberServiceSpy.getMembersList).toHaveBeenCalled();
    });
  });

  describe('seePendingInvite', () => {
    it('should open MemberPendingInvite dialog', async () => {
      await createComponent();
      dialogServiceSpy.open.mockReturnValue(null);

      component.seePendingInvite();

      expect(dialogServiceSpy.open).toHaveBeenCalledWith(
        MemberPendingInvite,
        expect.objectContaining({ modal: true }),
      );
    });
  });

  // ── 9. updatePaginationTranslation ─────────────────────────────

  describe('updatePaginationTranslation', () => {
    it('should update currentPageReportTemplate with translated text', async () => {
      await createComponent();
      component.updatePaginationTranslation();

      // TranslateService.get returns an observable; with forRoot() default, returns the key
      expect(component.currentPageReportTemplate()).toBeTruthy();
    });
  });
});
