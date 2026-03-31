import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Table, TablePageEvent } from 'primeng/table';
import { DialogService } from 'primeng/dynamicdialog';
import { of, Subject, throwError } from 'rxjs';

import {
  ApiResponse,
  ApiResponsePaginated,
  Pagination,
} from '../../../../../../core/dtos/api.response';
import { UserMemberInvitationDTO } from '../../../../../../shared/dtos/invitation.dtos';
import { MeService } from '../../../../../../shared/services/me.service';
import { IndividualDTO } from '../../../../../../shared/dtos/member.dtos';
import { DebouncedPInputComponent } from '../../../../../../shared/components/debounced-p-input/debounced-p-input.component';
import { InvitationDetailComponent } from './dialogs/invitation-detail/invitation-detail.component';
import { EncodeNewMemberSelfComponent } from './dialogs/encode-new-member/encode-new-member-self.component';
import { InvitationMember } from './invitation-member';

// ── Stubs ──────────────────────────────────────────────────────────

@Component({ selector: 'app-debounced-p-input', standalone: true, template: '' })
class DebouncedPInputStub {}

// ── Helpers ────────────────────────────────────────────────────────

function buildInvitation(
  overrides: Partial<UserMemberInvitationDTO> = {},
): UserMemberInvitationDTO {
  return {
    id: 1,
    user_email: 'user@test.com',
    created_at: new Date('2025-01-15'),
    to_be_encoded: false,
    community: { name: 'Test Community' },
    ...overrides,
  } as UserMemberInvitationDTO;
}

function buildPagination(overrides: Partial<Pagination> = {}): Pagination {
  return new Pagination(
    overrides.page ?? 1,
    overrides.limit ?? 10,
    overrides.total ?? 20,
    overrides.total_pages ?? 2,
  );
}

function buildPaginatedResponse(
  data: UserMemberInvitationDTO[] = [buildInvitation()],
  pagination: Pagination = buildPagination(),
): ApiResponsePaginated<UserMemberInvitationDTO[] | string> {
  return new ApiResponsePaginated(data, pagination);
}

// ── Tests ──────────────────────────────────────────────────────────

describe('InvitationMember', () => {
  let component: InvitationMember;
  let fixture: ComponentFixture<InvitationMember>;

  let meServiceSpy: {
    getOwnMembersPendingInviation: ReturnType<typeof vi.fn>;
    acceptInvitationMember: ReturnType<typeof vi.fn>;
    refuseMemberInvitation: ReturnType<typeof vi.fn>;
    getOwnMemberPendingInvitationById: ReturnType<typeof vi.fn>;
  };

  let dialogServiceSpy: {
    open: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    meServiceSpy = {
      getOwnMembersPendingInviation: vi.fn().mockReturnValue(of(buildPaginatedResponse())),
      acceptInvitationMember: vi.fn().mockReturnValue(of(new ApiResponse('OK'))),
      refuseMemberInvitation: vi.fn().mockReturnValue(of(new ApiResponse('OK'))),
      getOwnMemberPendingInvitationById: vi.fn().mockReturnValue(
        of(
          new ApiResponse<IndividualDTO | string>({
            member_type: 'individual',
          } as unknown as IndividualDTO),
        ),
      ),
    };

    dialogServiceSpy = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [InvitationMember, TranslateModule.forRoot()],
      providers: [{ provide: MeService, useValue: meServiceSpy }],
    })
      .overrideComponent(InvitationMember, {
        remove: {
          imports: [DebouncedPInputComponent],
          providers: [DialogService],
        },
        add: {
          imports: [DebouncedPInputStub],
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

    fixture = TestBed.createComponent(InvitationMember);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ── Creation ───────────────────────────────────────────────────

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ── Initial signal state ───────────────────────────────────────

  describe('initial state (after lazy load)', () => {
    it('should have pagination from loaded response', () => {
      expect(component.pagination()).toEqual(new Pagination(1, 10, 20, 2));
    });

    it('should have invitations from loaded response', () => {
      expect(component.invitations()).toHaveLength(1);
      expect(component.invitations()[0].id).toBe(1);
    });

    it('should not be loading after initial load completes', () => {
      expect(component.loading()).toBe(false);
    });

    it('should have filter with page 1 and limit 10', () => {
      expect(component.filter().page).toBe(1);
      expect(component.filter().limit).toBe(10);
    });

    it('should have empty searchText', () => {
      expect(component.searchText()).toBe('');
    });

    it('should have null stateFilter', () => {
      expect(component.stateFilter()).toBeNull();
    });

    it('should have stateOptions defined', () => {
      expect(component.stateOptions).toHaveLength(2);
      expect(component.stateOptions[0].value).toBe(true);
      expect(component.stateOptions[1].value).toBe(false);
    });
  });

  // ── Computed signals ───────────────────────────────────────────

  describe('computed signals', () => {
    it('firstRow should compute from pagination page and limit', () => {
      component.pagination.set({ page: 3, limit: 10, total: 50, total_pages: 5 });
      expect(component.firstRow()).toBe(20);
    });

    it('firstRow should be 0 for page 1', () => {
      component.pagination.set({ page: 1, limit: 10, total: 50, total_pages: 5 });
      expect(component.firstRow()).toBe(0);
    });

    it('showPaginator should be true when total_pages > 1', () => {
      component.pagination.set({ page: 1, limit: 10, total: 20, total_pages: 2 });
      expect(component.showPaginator()).toBe(true);
    });

    it('showPaginator should be false when total_pages is 1', () => {
      component.pagination.set({ page: 1, limit: 10, total: 5, total_pages: 1 });
      expect(component.showPaginator()).toBe(false);
    });

    it('hasActiveFilters should be false when no filters are set', () => {
      component.searchText.set('');
      component.stateFilter.set(null);
      expect(component.hasActiveFilters()).toBe(false);
    });

    it('hasActiveFilters should be true when searchText is set', () => {
      component.searchText.set('hello');
      expect(component.hasActiveFilters()).toBe(true);
    });

    it('hasActiveFilters should be true when stateFilter is set', () => {
      component.stateFilter.set(true);
      expect(component.hasActiveFilters()).toBe(true);
    });
  });

  // ── loadMemberInvitation ───────────────────────────────────────

  describe('loadMemberInvitation', () => {
    it('should call meService.getOwnMembersPendingInviation with current filter', () => {
      component.filter.set({ page: 2, limit: 10 });
      component.loadMemberInvitation();
      expect(meServiceSpy.getOwnMembersPendingInviation).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
      });
    });

    it('should set loading to true then false on success', () => {
      component.loadMemberInvitation();
      expect(component.loading()).toBe(false);
    });

    it('should set invitations from response data', () => {
      const inv = [buildInvitation({ id: 10 }), buildInvitation({ id: 20 })];
      meServiceSpy.getOwnMembersPendingInviation.mockReturnValue(of(buildPaginatedResponse(inv)));
      component.loadMemberInvitation();
      expect(component.invitations()).toEqual(inv);
    });

    it('should set pagination from response', () => {
      const pag = buildPagination({ page: 2, total: 30, total_pages: 3 });
      meServiceSpy.getOwnMembersPendingInviation.mockReturnValue(
        of(buildPaginatedResponse([buildInvitation()], pag)),
      );
      component.loadMemberInvitation();
      expect(component.pagination().page).toBe(2);
      expect(component.pagination().total).toBe(30);
      expect(component.pagination().total_pages).toBe(3);
    });

    it('should set loading to false on error', () => {
      meServiceSpy.getOwnMembersPendingInviation.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      component.loadMemberInvitation();
      expect(component.loading()).toBe(false);
    });

    it('should log error on failure', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      meServiceSpy.getOwnMembersPendingInviation.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      component.loadMemberInvitation();
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  // ── applyFilters ───────────────────────────────────────────────

  describe('applyFilters', () => {
    it('should reset page to 1 and keep current limit', () => {
      component.filter.set({ page: 3, limit: 20 });
      component.applyFilters();
      expect(component.filter().page).toBe(1);
      expect(component.filter().limit).toBe(20);
    });

    it('should include name when searchText is set', () => {
      component.searchText.set('John');
      component.applyFilters();
      expect(component.filter().name).toBe('John');
    });

    it('should not include name when searchText is empty', () => {
      component.searchText.set('');
      component.applyFilters();
      expect(component.filter().name).toBeUndefined();
    });

    it('should include to_be_encoded when stateFilter is set', () => {
      component.stateFilter.set(true);
      component.applyFilters();
      expect(component.filter().to_be_encoded).toBe(true);
    });

    it('should not include to_be_encoded when stateFilter is null', () => {
      component.stateFilter.set(null);
      component.applyFilters();
      expect(component.filter().to_be_encoded).toBeUndefined();
    });

    it('should call loadMemberInvitation', () => {
      const loadSpy = vi.spyOn(component, 'loadMemberInvitation');
      component.applyFilters();
      expect(loadSpy).toHaveBeenCalled();
    });
  });

  // ── onSearchTextChange / onStateFilterChange ───────────────────

  describe('onSearchTextChange', () => {
    it('should update searchText signal and apply filters', () => {
      const applySpy = vi.spyOn(component, 'applyFilters');
      component.onSearchTextChange('test query');
      expect(component.searchText()).toBe('test query');
      expect(applySpy).toHaveBeenCalled();
    });
  });

  describe('onStateFilterChange', () => {
    it('should update stateFilter signal and apply filters', () => {
      const applySpy = vi.spyOn(component, 'applyFilters');
      component.onStateFilterChange(true);
      expect(component.stateFilter()).toBe(true);
      expect(applySpy).toHaveBeenCalled();
    });

    it('should handle null state', () => {
      component.stateFilter.set(true);
      component.onStateFilterChange(null);
      expect(component.stateFilter()).toBeNull();
    });
  });

  // ── clear ──────────────────────────────────────────────────────

  describe('clear', () => {
    it('should reset all filters and reload', () => {
      const tableMock = { clear: vi.fn() } as unknown as Table;
      const loadSpy = vi.spyOn(component, 'loadMemberInvitation');

      component.searchText.set('something');
      component.stateFilter.set(true);
      component.filter.set({ page: 3, limit: 20, name: 'test' });

      component.clear(tableMock);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(tableMock.clear).toHaveBeenCalled();
      expect(component.searchText()).toBe('');
      expect(component.stateFilter()).toBeNull();
      expect(component.filter()).toEqual({ page: 1, limit: 10 });
      expect(loadSpy).toHaveBeenCalled();
    });
  });

  // ── lazyLoadMemberInvitation ───────────────────────────────────

  describe('lazyLoadMemberInvitation', () => {
    it('should compute page from event and call load', () => {
      const loadSpy = vi.spyOn(component, 'loadMemberInvitation');
      component.lazyLoadMemberInvitation({ first: 20, rows: 10 });
      expect(component.filter().page).toBe(3);
      expect(loadSpy).toHaveBeenCalled();
    });

    it('should default to page 1 when rows is 0', () => {
      component.lazyLoadMemberInvitation({ first: 0, rows: 0 });
      expect(component.filter().page).toBe(1);
    });

    it('should preserve existing filter values', () => {
      component.filter.set({ page: 1, limit: 10, name: 'test' });
      component.lazyLoadMemberInvitation({ first: 10, rows: 10 });
      expect(component.filter().name).toBe('test');
    });
  });

  // ── pageChange ─────────────────────────────────────────────────

  describe('pageChange', () => {
    it('should compute page from event and call load', () => {
      const loadSpy = vi.spyOn(component, 'loadMemberInvitation');
      component.pageChange({ first: 20, rows: 10 });
      expect(component.filter().page).toBe(3);
      expect(loadSpy).toHaveBeenCalled();
    });

    it('should use defaults when event values are undefined', () => {
      component.pageChange({ first: undefined, rows: undefined } as unknown as TablePageEvent);
      expect(component.filter().page).toBe(1);
    });
  });

  // ── acceptInvitation ───────────────────────────────────────────

  describe('acceptInvitation', () => {
    it('should call meService.acceptInvitationMember with invitation id', () => {
      const invitation = buildInvitation({ id: 42 });
      component.acceptInvitation(invitation);
      expect(meServiceSpy.acceptInvitationMember).toHaveBeenCalledWith({ invitation_id: 42 });
    });

    it('should reload invitations on success', () => {
      const loadSpy = vi.spyOn(component, 'loadMemberInvitation');
      component.acceptInvitation(buildInvitation());
      expect(loadSpy).toHaveBeenCalled();
    });

    it('should log error on failure', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      meServiceSpy.acceptInvitationMember.mockReturnValue(throwError(() => new Error('fail')));
      component.acceptInvitation(buildInvitation());
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  // ── refuseInvitation ───────────────────────────────────────────

  describe('refuseInvitation', () => {
    it('should call meService.refuseMemberInvitation with invitation id', () => {
      const invitation = buildInvitation({ id: 99 });
      component.refuseInvitation(invitation);
      expect(meServiceSpy.refuseMemberInvitation).toHaveBeenCalledWith(99);
    });

    it('should reload invitations on success', () => {
      const loadSpy = vi.spyOn(component, 'loadMemberInvitation');
      component.refuseInvitation(buildInvitation());
      expect(loadSpy).toHaveBeenCalled();
    });

    it('should log error on failure', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      meServiceSpy.refuseMemberInvitation.mockReturnValue(throwError(() => new Error('fail')));
      component.refuseInvitation(buildInvitation());
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  // ── fetchDetail ────────────────────────────────────────────────

  describe('fetchDetail', () => {
    it('should call meService.getOwnMemberPendingInvitationById with invitation id', () => {
      const invitation = buildInvitation({ id: 7 });
      component.fetchDetail(invitation);
      expect(meServiceSpy.getOwnMemberPendingInvitationById).toHaveBeenCalledWith(7);
    });

    it('should open InvitationDetailComponent dialog with member data', () => {
      const memberData = { member_type: 'individual' } as unknown as IndividualDTO;
      meServiceSpy.getOwnMemberPendingInvitationById.mockReturnValue(
        of(new ApiResponse(memberData)),
      );

      component.fetchDetail(buildInvitation());

      expect(dialogServiceSpy.open).toHaveBeenCalledWith(
        InvitationDetailComponent,
        expect.objectContaining({
          modal: true,
          closable: true,
          closeOnEscape: true,
          data: {
            member: memberData,
            member_type: 'individual',
          },
        }),
      );
    });

    it('should not open dialog when response has no data', () => {
      meServiceSpy.getOwnMemberPendingInvitationById.mockReturnValue(of({ data: null }));

      component.fetchDetail(buildInvitation());
      expect(dialogServiceSpy.open).not.toHaveBeenCalled();
    });
  });

  // ── encodeNewMember ────────────────────────────────────────────

  describe('encodeNewMember', () => {
    it('should open EncodeNewMemberSelfComponent dialog with invitation id', () => {
      const onClose$ = new Subject<boolean>();
      dialogServiceSpy.open.mockReturnValue({
        onClose: onClose$.asObservable(),
        destroy: vi.fn(),
      });

      const invitation = buildInvitation({ id: 55 });
      component.encodeNewMember(invitation);

      expect(dialogServiceSpy.open).toHaveBeenCalledWith(
        EncodeNewMemberSelfComponent,
        expect.objectContaining({
          modal: true,
          closable: true,
          closeOnEscape: true,
          data: { invitationID: 55 },
        }),
      );
    });

    it('should reload invitations when dialog closes with true', () => {
      const onClose$ = new Subject<boolean>();
      dialogServiceSpy.open.mockReturnValue({
        onClose: onClose$.asObservable(),
        destroy: vi.fn(),
      });

      const loadSpy = vi.spyOn(component, 'loadMemberInvitation');
      component.encodeNewMember(buildInvitation());
      loadSpy.mockClear();

      onClose$.next(true);
      expect(loadSpy).toHaveBeenCalled();
    });

    it('should not reload invitations when dialog closes with false', () => {
      const onClose$ = new Subject<boolean>();
      dialogServiceSpy.open.mockReturnValue({
        onClose: onClose$.asObservable(),
        destroy: vi.fn(),
      });

      const loadSpy = vi.spyOn(component, 'loadMemberInvitation');
      component.encodeNewMember(buildInvitation());
      loadSpy.mockClear();

      onClose$.next(false);
      expect(loadSpy).not.toHaveBeenCalled();
    });
  });
});
