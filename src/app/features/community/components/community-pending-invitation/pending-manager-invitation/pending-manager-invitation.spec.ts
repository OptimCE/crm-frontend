import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { PendingManagerInvitation } from './pending-manager-invitation';
import { InvitationService } from '../../../../../shared/services/invitation.service';
import { ErrorMessageHandler } from '../../../../../shared/services-ui/error.message.handler';
import {
  ApiResponse,
  ApiResponsePaginated,
  Pagination,
} from '../../../../../core/dtos/api.response';
import { UserManagerInvitationDTO } from '../../../../../shared/dtos/invitation.dtos';
import { CommunityDTO } from '../../../../../shared/dtos/community.dtos';
import { TableLazyLoadEvent } from 'primeng/table';

// ── Helpers ────────────────────────────────────────────────────────

function buildManagerInvitations(): UserManagerInvitationDTO[] {
  return [
    {
      id: 1,
      user_email: 'manager-a@test.com',
      created_at: new Date(),
      community: { id: 1, name: 'Community A' } as CommunityDTO,
    },
    {
      id: 2,
      user_email: 'manager-b@test.com',
      created_at: new Date(),
      community: { id: 2, name: 'Community B' } as CommunityDTO,
    },
  ];
}

function buildPaginatedResponse(
  data: UserManagerInvitationDTO[] = buildManagerInvitations(),
): ApiResponsePaginated<UserManagerInvitationDTO[] | string> {
  return new ApiResponsePaginated(data, new Pagination(1, 10, 2, 1));
}

// ── Test Suite ─────────────────────────────────────────────────────

describe('PendingManagerInvitation', () => {
  let component: PendingManagerInvitation;
  let fixture: ComponentFixture<PendingManagerInvitation>;

  let invitationServiceSpy: {
    getManagerPendingInvitation: ReturnType<typeof vi.fn>;
    cancelManagerInvitation: ReturnType<typeof vi.fn>;
  };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };

  async function createComponent(): Promise<void> {
    fixture = TestBed.createComponent(PendingManagerInvitation);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  beforeEach(async () => {
    invitationServiceSpy = {
      getManagerPendingInvitation: vi.fn().mockReturnValue(of(buildPaginatedResponse())),
      cancelManagerInvitation: vi.fn().mockReturnValue(of(new ApiResponse('OK'))),
    };
    errorHandlerSpy = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [PendingManagerInvitation, TranslateModule.forRoot()],
      providers: [
        { provide: InvitationService, useValue: invitationServiceSpy },
        { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
      ],
    })
      .overrideComponent(PendingManagerInvitation, {
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
      expect(component.pendingGestionnaireInvitation().length).toBe(2);
    });

    it('should set loadingGestionnaire to false after init', () => {
      expect(component.loadingGestionnaire()).toBe(false);
    });

    it('should have filter with page 1 and limit 10', () => {
      expect(component.filter().page).toBe(1);
      expect(component.filter().limit).toBe(10);
    });
  });

  // ── 2. loadPendingGestionnaireInvitation ────────────────────────

  describe('loadPendingGestionnaireInvitation', () => {
    beforeEach(async () => {
      await createComponent();
      invitationServiceSpy.getManagerPendingInvitation.mockClear();
      errorHandlerSpy.handleError.mockClear();
    });

    it('should call invitationService.getManagerPendingInvitation with current filter', () => {
      component.loadPendingGestionnaireInvitation();
      expect(invitationServiceSpy.getManagerPendingInvitation).toHaveBeenCalledWith(
        component.filter(),
      );
    });

    it('should set pendingGestionnaireInvitation from response data', () => {
      const invitations = buildManagerInvitations();
      invitationServiceSpy.getManagerPendingInvitation.mockReturnValue(
        of(buildPaginatedResponse(invitations)),
      );
      component.loadPendingGestionnaireInvitation();
      expect(component.pendingGestionnaireInvitation()).toEqual(invitations);
    });

    it('should set loadingGestionnaire to false after success', () => {
      component.loadPendingGestionnaireInvitation();
      expect(component.loadingGestionnaire()).toBe(false);
    });

    it('should call errorHandler.handleError when response is falsy', () => {
      invitationServiceSpy.getManagerPendingInvitation.mockReturnValue(of(null));
      component.loadPendingGestionnaireInvitation();
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(null);
    });

    it('should set loadingGestionnaire to false when response is falsy', () => {
      invitationServiceSpy.getManagerPendingInvitation.mockReturnValue(of(null));
      component.loadPendingGestionnaireInvitation();
      expect(component.loadingGestionnaire()).toBe(false);
    });

    it('should call errorHandler.handleError on observable error', () => {
      const error = new Error('network fail');
      invitationServiceSpy.getManagerPendingInvitation.mockReturnValue(throwError(() => error));
      component.loadPendingGestionnaireInvitation();
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(error);
    });

    it('should set loadingGestionnaire to false on error', () => {
      invitationServiceSpy.getManagerPendingInvitation.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      component.loadPendingGestionnaireInvitation();
      expect(component.loadingGestionnaire()).toBe(false);
    });
  });

  // ── 3. lazyLoadPendingGestionnaireInvitation ────────────────────

  describe('lazyLoadPendingGestionnaireInvitation', () => {
    beforeEach(async () => {
      await createComponent();
      invitationServiceSpy.getManagerPendingInvitation.mockClear();
    });

    it('should update filter and call loadPendingGestionnaireInvitation', () => {
      component.lazyLoadPendingGestionnaireInvitation({
        sortField: undefined,
        sortOrder: undefined,
      } as TableLazyLoadEvent);
      expect(invitationServiceSpy.getManagerPendingInvitation).toHaveBeenCalled();
    });

    it('should preserve filter when sortField is provided but sorting is commented out', () => {
      component.lazyLoadPendingGestionnaireInvitation({
        sortField: 'email',
        sortOrder: 1,
      } as TableLazyLoadEvent);
      // Sorting logic is commented out in the component, so filter should remain unchanged
      expect(component.filter().page).toBe(1);
      expect(component.filter().limit).toBe(10);
    });
  });

  // ── 4. cancelInvitation ─────────────────────────────────────────

  describe('cancelInvitation', () => {
    const invitation: UserManagerInvitationDTO = {
      id: 99,
      user_email: 'cancel-manager@test.com',
      created_at: new Date(),
      community: { id: 1, name: 'Test' } as CommunityDTO,
    };

    beforeEach(async () => {
      await createComponent();
      invitationServiceSpy.getManagerPendingInvitation.mockClear();
      errorHandlerSpy.handleError.mockClear();
    });

    it('should call invitationService.cancelManagerInvitation with invitation id', () => {
      component.cancelInvitation(invitation);
      expect(invitationServiceSpy.cancelManagerInvitation).toHaveBeenCalledWith(99);
    });

    it('should reload data on success', () => {
      component.cancelInvitation(invitation);
      expect(invitationServiceSpy.getManagerPendingInvitation).toHaveBeenCalled();
    });

    it('should call errorHandler.handleError when response is falsy', () => {
      invitationServiceSpy.cancelManagerInvitation.mockReturnValue(of(null));
      component.cancelInvitation(invitation);
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(null);
    });

    it('should call errorHandler.handleError on observable error', () => {
      const error = new Error('cancel failed');
      invitationServiceSpy.cancelManagerInvitation.mockReturnValue(throwError(() => error));
      component.cancelInvitation(invitation);
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(error);
    });
  });
});
