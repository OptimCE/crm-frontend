import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Table, TableLazyLoadEvent } from 'primeng/table';

import { UsersCommunityList } from './users-community-list';
import { CommunityService } from '../../../../shared/services/community.service';
import { InvitationService } from '../../../../shared/services/invitation.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { ApiResponse, ApiResponsePaginated, Pagination } from '../../../../core/dtos/api.response';
import { UsersCommunityDTO } from '../../../../shared/dtos/community.dtos';
import { Role } from '../../../../core/dtos/role';
import { DialogService } from 'primeng/dynamicdialog';

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
    },
    {
      id_user: 2,
      id_community: 1,
      email: 'manager@test.com',
      role: Role.GESTIONNAIRE,
      first_name: 'Bob',
      last_name: 'Martin',
    },
    {
      id_user: 3,
      id_community: 1,
      email: 'member@test.com',
      role: Role.MEMBER,
      first_name: 'Charlie',
    },
  ];
}

function buildPaginatedResponse(
  data: UsersCommunityDTO[] = buildUsers(),
  pagination: Pagination = new Pagination(1, 10, 3, 1),
): ApiResponsePaginated<UsersCommunityDTO[] | string> {
  return new ApiResponsePaginated(data, pagination);
}

// ── Test Suite ─────────────────────────────────────────────────────

describe('UsersCommunityList', () => {
  let component: UsersCommunityList;
  let fixture: ComponentFixture<UsersCommunityList>;

  let communityServiceSpy: {
    getUsers: ReturnType<typeof vi.fn>;
    patchRoleUser: ReturnType<typeof vi.fn>;
    kick: ReturnType<typeof vi.fn>;
  };
  let invitationServiceSpy: {
    inviteUserToBecomeManager: ReturnType<typeof vi.fn>;
  };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };
  let userContextServiceSpy: {
    isActiveRole: ReturnType<typeof vi.fn>;
    compareWithActiveRole: ReturnType<typeof vi.fn>;
  };
  let dialogServiceSpy: { open: ReturnType<typeof vi.fn> };

  async function createComponent(): Promise<void> {
    fixture = TestBed.createComponent(UsersCommunityList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  beforeEach(async () => {
    communityServiceSpy = {
      getUsers: vi.fn().mockReturnValue(of(buildPaginatedResponse())),
      patchRoleUser: vi.fn().mockReturnValue(of(new ApiResponse('OK'))),
      kick: vi.fn().mockReturnValue(of(new ApiResponse('OK'))),
    };
    invitationServiceSpy = {
      inviteUserToBecomeManager: vi.fn().mockReturnValue(of(new ApiResponse('OK'))),
    };
    errorHandlerSpy = { handleError: vi.fn() };
    userContextServiceSpy = {
      isActiveRole: vi.fn().mockReturnValue(true),
      compareWithActiveRole: vi.fn().mockReturnValue(true),
    };
    dialogServiceSpy = {
      open: vi.fn().mockReturnValue({ onClose: new Subject(), destroy: vi.fn() }),
    };

    await TestBed.configureTestingModule({
      imports: [UsersCommunityList, TranslateModule.forRoot()],
      providers: [
        { provide: CommunityService, useValue: communityServiceSpy },
        { provide: InvitationService, useValue: invitationServiceSpy },
        { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
        { provide: UserContextService, useValue: userContextServiceSpy },
        { provide: DialogService, useValue: dialogServiceSpy },
      ],
    })
      .overrideComponent(UsersCommunityList, {
        set: {
          providers: [
            { provide: DialogService, useValue: dialogServiceSpy },
            { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
          ],
          schemas: [NO_ERRORS_SCHEMA],
        },
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
      expect(component.users().length).toBe(3);
    });
  });

  // ── 2. loadUsers ────────────────────────────────────────────────

  describe('loadUsers', () => {
    beforeEach(async () => {
      await createComponent();
      communityServiceSpy.getUsers.mockClear();
    });

    it('should call communityService.getUsers with current filter', () => {
      component.loadUsers();
      expect(communityServiceSpy.getUsers).toHaveBeenCalledWith(component.filter());
    });

    it('should set users from response data', () => {
      const users = buildUsers();
      communityServiceSpy.getUsers.mockReturnValue(of(buildPaginatedResponse(users)));
      component.loadUsers();
      expect(component.users()).toEqual(users);
    });

    it('should set pagination from response', () => {
      const pagination = new Pagination(2, 10, 25, 3);
      communityServiceSpy.getUsers.mockReturnValue(
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
      communityServiceSpy.getUsers.mockClear();
    });

    it('should reset page to 1 and call loadUsers', () => {
      component.filter.set({ page: 3, limit: 10 });
      component.applyFilters();
      expect(component.filter().page).toBe(1);
      expect(communityServiceSpy.getUsers).toHaveBeenCalled();
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
      communityServiceSpy.getUsers.mockClear();
    });

    it('should set searchText and trigger loadUsers', () => {
      component.onSearchTextChange('hello');
      expect(component.searchText()).toBe('hello');
      expect(communityServiceSpy.getUsers).toHaveBeenCalled();
    });
  });

  // ── 5. onRoleFilterChange ──────────────────────────────────────

  describe('onRoleFilterChange', () => {
    beforeEach(async () => {
      await createComponent();
      communityServiceSpy.getUsers.mockClear();
    });

    it('should set roleFilter and trigger loadUsers', () => {
      component.onRoleFilterChange(Role.GESTIONNAIRE);
      expect(component.roleFilter()).toBe(Role.GESTIONNAIRE);
      expect(communityServiceSpy.getUsers).toHaveBeenCalled();
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
      communityServiceSpy.getUsers.mockClear();
    });

    it('should compute correct page from event and call loadUsers', () => {
      component.lazyLoadUsers({ first: 20, rows: 10 } as TableLazyLoadEvent);
      expect(component.filter().page).toBe(3);
      expect(communityServiceSpy.getUsers).toHaveBeenCalled();
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
      communityServiceSpy.getUsers.mockClear();
    });

    it('should compute page from event and call loadUsers', () => {
      component.pageChange({ first: 10, rows: 10 });
      expect(component.filter().page).toBe(2);
      expect(communityServiceSpy.getUsers).toHaveBeenCalled();
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
      communityServiceSpy.getUsers.mockClear();
    });

    it('should call table.clear(), reset all filters and call loadUsers', () => {
      const mockTable = { clear: vi.fn() } as unknown as Table;

      component.searchText.set('test');
      component.roleFilter.set(Role.ADMIN);
      component.filter.set({ page: 3, limit: 10, email: 'test', role: Role.ADMIN });

      component.clear(mockTable);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockTable.clear).toHaveBeenCalled();
      expect(component.searchText()).toBe('');
      expect(component.roleFilter()).toBeNull();
      expect(component.filter()).toEqual({ page: 1, limit: 10 });
      expect(communityServiceSpy.getUsers).toHaveBeenCalled();
    });
  });

  // ── 9. openDialogEditRole ─────────────────────────────────────

  describe('openDialogEditRole', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should set dialogVisible to true, userSelected, and roleSelected to -1', () => {
      const user = buildUsers()[1];
      component.openDialogEditRole(user);

      expect(component.dialogVisible()).toBe(true);
      expect(component.userSelected()).toBe(user);
      expect(component.roleSelected()).toBe(-1);
    });
  });

  // ── 10. updateRole ────────────────────────────────────────────

  describe('updateRole', () => {
    beforeEach(async () => {
      await createComponent();
      communityServiceSpy.getUsers.mockClear();
      communityServiceSpy.patchRoleUser.mockClear();
      errorHandlerSpy.handleError.mockClear();
    });

    it('should return early if roleSelected is -1', () => {
      component.userSelected.set(buildUsers()[0]);
      component.roleSelected.set(-1);
      component.updateRole();
      expect(communityServiceSpy.patchRoleUser).not.toHaveBeenCalled();
    });

    it('should return early if no user is selected', () => {
      component.userSelected.set(undefined);
      component.roleSelected.set(Role.MEMBER);
      component.updateRole();
      expect(communityServiceSpy.patchRoleUser).not.toHaveBeenCalled();
    });

    it('should call patchRoleUser and reload on success', () => {
      const user = buildUsers()[1];
      component.userSelected.set(user);
      component.roleSelected.set(Role.MEMBER);

      component.updateRole();

      expect(communityServiceSpy.patchRoleUser).toHaveBeenCalledWith({
        id_user: user.id_user,
        new_role: Role.MEMBER,
      });
      expect(communityServiceSpy.getUsers).toHaveBeenCalled();
    });

    it('should close dialog and reset state after update', () => {
      const user = buildUsers()[1];
      component.userSelected.set(user);
      component.roleSelected.set(Role.MEMBER);

      component.updateRole();

      expect(component.dialogVisible()).toBe(false);
      expect(component.roleSelected()).toBe(-1);
      expect(component.userSelected()).toBeUndefined();
    });

    it('should call errorHandler.handleError on API error', () => {
      const user = buildUsers()[1];
      component.userSelected.set(user);
      component.roleSelected.set(Role.MEMBER);

      const error = new Error('update failed');
      communityServiceSpy.patchRoleUser.mockReturnValue(throwError(() => error));

      component.updateRole();

      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(error);
    });
  });

  // ── 11. deleteUser ────────────────────────────────────────────

  describe('deleteUser', () => {
    beforeEach(async () => {
      await createComponent();
      communityServiceSpy.getUsers.mockClear();
    });

    it('should call communityService.kick with user id', () => {
      const user = buildUsers()[2];
      component.deleteUser(user);
      expect(communityServiceSpy.kick).toHaveBeenCalledWith(user.id_user);
    });

    it('should reload users on success', () => {
      const user = buildUsers()[2];
      component.deleteUser(user);
      expect(communityServiceSpy.getUsers).toHaveBeenCalled();
    });
  });

  // ── 12. seePendingInvite ──────────────────────────────────────

  describe('seePendingInvite', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should open CommunityPendingInvitation dialog via dialogService', () => {
      const mockRef = { onClose: new Subject(), destroy: vi.fn() };
      dialogServiceSpy.open.mockReturnValue(mockRef);

      component.seePendingInvite();

      expect(dialogServiceSpy.open).toHaveBeenCalled();
      const callArgs = dialogServiceSpy.open.mock.calls[0] as [unknown, Record<string, unknown>];
      expect(callArgs[1]['modal']).toBe(true);
      expect(callArgs[1]['closable']).toBe(true);
    });
  });

  // ── 13. inviteGestionnaire ────────────────────────────────────

  describe('inviteGestionnaire', () => {
    beforeEach(async () => {
      await createComponent();
      invitationServiceSpy.inviteUserToBecomeManager.mockClear();
      errorHandlerSpy.handleError.mockClear();
    });

    it('should open CommunityInvitation dialog via dialogService', () => {
      const onClose = new Subject<unknown>();
      dialogServiceSpy.open.mockReturnValue({ onClose, destroy: vi.fn() });

      component.inviteGestionnaire();

      expect(dialogServiceSpy.open).toHaveBeenCalled();
    });

    it('should call inviteUserToBecomeManager when dialog closes with email string', () => {
      const onClose = new Subject<unknown>();
      dialogServiceSpy.open.mockReturnValue({ onClose, destroy: vi.fn() });

      component.inviteGestionnaire();
      onClose.next('new-manager@test.com');

      expect(invitationServiceSpy.inviteUserToBecomeManager).toHaveBeenCalledWith({
        user_email: 'new-manager@test.com',
      });
    });

    it('should not call inviteUserToBecomeManager when dialog closes with empty string', () => {
      const onClose = new Subject<unknown>();
      dialogServiceSpy.open.mockReturnValue({ onClose, destroy: vi.fn() });

      component.inviteGestionnaire();
      onClose.next('');

      expect(invitationServiceSpy.inviteUserToBecomeManager).not.toHaveBeenCalled();
    });

    it('should not call inviteUserToBecomeManager when dialog closes with non-string value', () => {
      const onClose = new Subject<unknown>();
      dialogServiceSpy.open.mockReturnValue({ onClose, destroy: vi.fn() });

      component.inviteGestionnaire();
      onClose.next(undefined);

      expect(invitationServiceSpy.inviteUserToBecomeManager).not.toHaveBeenCalled();
    });

    it('should call errorHandler.handleError on invitation error', () => {
      const onClose = new Subject<unknown>();
      dialogServiceSpy.open.mockReturnValue({ onClose, destroy: vi.fn() });
      const error = new Error('invite failed');
      invitationServiceSpy.inviteUserToBecomeManager.mockReturnValue(throwError(() => error));

      component.inviteGestionnaire();
      onClose.next('fail@test.com');

      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(error);
    });
  });

  // ── 14. getUserDisplayName ────────────────────────────────────

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

  // ── 15. Computed signals ──────────────────────────────────────

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
