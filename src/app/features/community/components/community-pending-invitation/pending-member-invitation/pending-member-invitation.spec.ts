import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { PendingMemberInvitation } from './pending-member-invitation';
import { InvitationService } from '../../../../../shared/services/invitation.service';
import { ErrorMessageHandler } from '../../../../../shared/services-ui/error.message.handler';
import {
  ApiResponse,
  ApiResponsePaginated,
  Pagination,
} from '../../../../../core/dtos/api.response';
import { UserMemberInvitationDTO } from '../../../../../shared/dtos/invitation.dtos';
import { CommunityDTO } from '../../../../../shared/dtos/community.dtos';
import { TableLazyLoadEvent } from 'primeng/table';

// ── Helpers ────────────────────────────────────────────────────────

function buildMemberInvitations(): UserMemberInvitationDTO[] {
  return [
    {
      id: 1,
      user_email: 'a@test.com',
      created_at: new Date(),
      to_be_encoded: false,
      community: { id: 1, name: 'Community A' } as CommunityDTO,
    },
    {
      id: 2,
      user_email: 'b@test.com',
      created_at: new Date(),
      to_be_encoded: true,
      community: { id: 2, name: 'Community B' } as CommunityDTO,
    },
  ];
}

function buildPaginatedResponse(
  data: UserMemberInvitationDTO[] = buildMemberInvitations(),
): ApiResponsePaginated<UserMemberInvitationDTO[] | string> {
  return new ApiResponsePaginated(data, new Pagination(1, 10, 2, 1));
}

// ── Test Suite ─────────────────────────────────────────────────────

describe('PendingMemberInvitation', () => {
  let component: PendingMemberInvitation;
  let fixture: ComponentFixture<PendingMemberInvitation>;

  let invitationServiceSpy: {
    getMembersPendingInviation: ReturnType<typeof vi.fn>;
    cancelMemberInvitation: ReturnType<typeof vi.fn>;
  };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };

  async function createComponent(): Promise<void> {
    fixture = TestBed.createComponent(PendingMemberInvitation);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  beforeEach(async () => {
    invitationServiceSpy = {
      getMembersPendingInviation: vi.fn().mockReturnValue(of(buildPaginatedResponse())),
      cancelMemberInvitation: vi.fn().mockReturnValue(of(new ApiResponse('OK'))),
    };
    errorHandlerSpy = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [PendingMemberInvitation, TranslateModule.forRoot()],
      providers: [
        { provide: InvitationService, useValue: invitationServiceSpy },
        { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
      ],
    })
      .overrideComponent(PendingMemberInvitation, {
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

    it('should have data loaded after init (lazy load fires automatically)', () => {
      // p-table lazy fires onLazyLoad on init, so data is already loaded
      expect(component.pendingMembresInvitation().length).toBe(2);
    });

    it('should set loadingMembers to false after init', () => {
      expect(component.loadingMembers()).toBe(false);
    });

    it('should have filter with page 1 and limit 10', () => {
      expect(component.filter().page).toBe(1);
      expect(component.filter().limit).toBe(10);
    });
  });

  // ── 2. loadPendingMemberInvitation ──────────────────────────────

  describe('loadPendingMemberInvitation', () => {
    beforeEach(async () => {
      await createComponent();
      invitationServiceSpy.getMembersPendingInviation.mockClear();
      errorHandlerSpy.handleError.mockClear();
    });

    it('should call invitationService.getMembersPendingInviation with current filter', () => {
      component.loadPendingMemberInvitation();
      expect(invitationServiceSpy.getMembersPendingInviation).toHaveBeenCalledWith(
        component.filter(),
      );
    });

    it('should set pendingMembresInvitation from response data', () => {
      const invitations = buildMemberInvitations();
      invitationServiceSpy.getMembersPendingInviation.mockReturnValue(
        of(buildPaginatedResponse(invitations)),
      );
      component.loadPendingMemberInvitation();
      expect(component.pendingMembresInvitation()).toEqual(invitations);
    });

    it('should set loadingMembers to false after success', () => {
      component.loadPendingMemberInvitation();
      expect(component.loadingMembers()).toBe(false);
    });

    it('should call errorHandler.handleError when response is falsy', () => {
      invitationServiceSpy.getMembersPendingInviation.mockReturnValue(of(null));
      component.loadPendingMemberInvitation();
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(null);
    });

    it('should set loadingMembers to false when response is falsy', () => {
      invitationServiceSpy.getMembersPendingInviation.mockReturnValue(of(null));
      component.loadPendingMemberInvitation();
      expect(component.loadingMembers()).toBe(false);
    });

    it('should call errorHandler.handleError on observable error', () => {
      const error = new Error('network fail');
      invitationServiceSpy.getMembersPendingInviation.mockReturnValue(throwError(() => error));
      component.loadPendingMemberInvitation();
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(error);
    });

    it('should set loadingMembers to false on error', () => {
      invitationServiceSpy.getMembersPendingInviation.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      component.loadPendingMemberInvitation();
      expect(component.loadingMembers()).toBe(false);
    });
  });

  // ── 3. lazyLoadPendingMemberInvitation ──────────────────────────

  describe('lazyLoadPendingMemberInvitation', () => {
    beforeEach(async () => {
      await createComponent();
      invitationServiceSpy.getMembersPendingInviation.mockClear();
    });

    it('should set sort_email ASC when sortField is email and sortOrder is 1', () => {
      component.lazyLoadPendingMemberInvitation({
        sortField: 'email',
        sortOrder: 1,
      } as TableLazyLoadEvent);
      expect(component.filter().sort_email).toBe('ASC');
    });

    it('should set sort_email DESC when sortField is email and sortOrder is -1', () => {
      component.lazyLoadPendingMemberInvitation({
        sortField: 'email',
        sortOrder: -1,
      } as TableLazyLoadEvent);
      expect(component.filter().sort_email).toBe('DESC');
    });

    it('should set sort_name when sortField is name', () => {
      component.lazyLoadPendingMemberInvitation({
        sortField: 'name',
        sortOrder: 1,
      } as TableLazyLoadEvent);
      expect(component.filter().sort_name).toBe('ASC');
    });

    it('should clear previous sort fields when switching sort', () => {
      // First sort by email
      component.lazyLoadPendingMemberInvitation({
        sortField: 'email',
        sortOrder: 1,
      } as TableLazyLoadEvent);
      expect(component.filter().sort_email).toBe('ASC');

      // Then sort by name — email sort should be removed
      component.lazyLoadPendingMemberInvitation({
        sortField: 'name',
        sortOrder: 1,
      } as TableLazyLoadEvent);
      expect(component.filter().sort_email).toBeUndefined();
      expect(component.filter().sort_name).toBe('ASC');
    });

    it('should call loadPendingMemberInvitation', () => {
      component.lazyLoadPendingMemberInvitation({
        sortField: undefined,
        sortOrder: undefined,
      } as TableLazyLoadEvent);
      expect(invitationServiceSpy.getMembersPendingInviation).toHaveBeenCalled();
    });
  });

  // ── 4. cancelMemberInvitation ───────────────────────────────────

  describe('cancelMemberInvitation', () => {
    const invitation: UserMemberInvitationDTO = {
      id: 42,
      user_email: 'cancel@test.com',
      created_at: new Date(),
      to_be_encoded: false,
      community: { id: 1, name: 'Test' } as CommunityDTO,
    };

    beforeEach(async () => {
      await createComponent();
      invitationServiceSpy.getMembersPendingInviation.mockClear();
      errorHandlerSpy.handleError.mockClear();
    });

    it('should call invitationService.cancelMemberInvitation with invitation id', () => {
      component.cancelMemberInvitation(invitation);
      expect(invitationServiceSpy.cancelMemberInvitation).toHaveBeenCalledWith(42);
    });

    it('should reload data on success', () => {
      component.cancelMemberInvitation(invitation);
      expect(invitationServiceSpy.getMembersPendingInviation).toHaveBeenCalled();
    });

    it('should call errorHandler.handleError when response is falsy', () => {
      invitationServiceSpy.cancelMemberInvitation.mockReturnValue(of(null));
      component.cancelMemberInvitation(invitation);
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });

    it('should call errorHandler.handleError with data on ApiResponse error', () => {
      invitationServiceSpy.cancelMemberInvitation.mockReturnValue(
        throwError(() => new ApiResponse('Cancel failed')),
      );
      component.cancelMemberInvitation(invitation);
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith('Cancel failed');
    });

    it('should call errorHandler.handleError with null on non-ApiResponse error', () => {
      invitationServiceSpy.cancelMemberInvitation.mockReturnValue(
        throwError(() => new Error('generic')),
      );
      component.cancelMemberInvitation(invitation);
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(null);
    });
  });
});
