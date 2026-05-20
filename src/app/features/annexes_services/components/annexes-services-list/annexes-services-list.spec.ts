import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { DialogService, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ApiResponse } from '../../../../core/dtos/api.response';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { Role } from '../../../../core/dtos/role';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { CommunityAnnex } from '../../../../shared/dtos/annexes_services.dtos';
import { AnnexesServicesService } from '../../../../shared/services/annexes_services.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AnnexesServicesList } from './annexes-services-list';

// ── Helpers ──────────────────────────────────────────────────────────

function buildAnnex(overrides: Partial<CommunityAnnex> = {}): CommunityAnnex {
  return {
    feature: 'allocation_generation',
    displayKey: 'ANNEXES_SERVICES.ALGORITHM.NAME',
    descriptionKey: 'ANNEXES_SERVICES.ALGORITHM.DESCRIPTION',
    icon: 'pi pi-cog',
    minRole: Role.GESTIONNAIRE,
    frontendRoute: '/annexes-services/algorithm',
    subscribePath: '/api/annexes-services/allocation_generation/subscribe',
    unsubscribePath: '/api/annexes-services/allocation_generation/unsubscribe',
    subscribed: false,
    ...overrides,
  };
}

function buildAnnexList(): CommunityAnnex[] {
  return [
    buildAnnex({ feature: 'subbed', subscribed: true }),
    buildAnnex({ feature: 'avail', subscribed: false }),
  ];
}

// ── Test Suite ───────────────────────────────────────────────────────

describe('AnnexesServicesList', () => {
  let component: AnnexesServicesList;
  let fixture: ComponentFixture<AnnexesServicesList>;

  let annexesServiceSpy: {
    getCommunityServices: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
  };
  let userContextSpy: { compareWithActiveRole: ReturnType<typeof vi.fn> };
  let dialogServiceSpy: { open: ReturnType<typeof vi.fn> };
  let confirmationSpy: { confirm: ReturnType<typeof vi.fn> };
  let messageServiceSpy: { add: ReturnType<typeof vi.fn> };
  let routerSpy: { navigateByUrl: ReturnType<typeof vi.fn> };
  let snackbarSpy: { openSnackBar: ReturnType<typeof vi.fn> };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };

  async function createComponent(): Promise<void> {
    fixture = TestBed.createComponent(AnnexesServicesList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  beforeEach(async () => {
    annexesServiceSpy = {
      getCommunityServices: vi.fn().mockReturnValue(of(new ApiResponse(buildAnnexList()))),
      unsubscribe: vi.fn().mockReturnValue(of(new ApiResponse('ok'))),
    };
    userContextSpy = { compareWithActiveRole: vi.fn().mockReturnValue(true) };
    dialogServiceSpy = { open: vi.fn() };
    confirmationSpy = { confirm: vi.fn() };
    messageServiceSpy = { add: vi.fn() };
    routerSpy = { navigateByUrl: vi.fn().mockResolvedValue(true) };
    snackbarSpy = { openSnackBar: vi.fn() };
    errorHandlerSpy = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AnnexesServicesList, TranslateModule.forRoot()],
      providers: [
        { provide: AnnexesServicesService, useValue: annexesServiceSpy },
        { provide: UserContextService, useValue: userContextSpy },
        { provide: Router, useValue: routerSpy },
        { provide: SnackbarNotification, useValue: snackbarSpy },
      ],
    })
      .overrideComponent(AnnexesServicesList, {
        set: {
          template: '',
          providers: [
            { provide: DialogService, useValue: dialogServiceSpy },
            { provide: MessageService, useValue: messageServiceSpy },
            { provide: ConfirmationService, useValue: confirmationSpy },
            { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
          ],
        },
      })
      .compileComponents();
  });

  // ── 1. Creation & init ─────────────────────────────────────────────

  describe('creation', () => {
    it('should create the component', async () => {
      await createComponent();
      expect(component).toBeTruthy();
    });

    it('should call loadServices on ngOnInit', async () => {
      await createComponent();
      component.ngOnInit();
      expect(annexesServiceSpy.getCommunityServices).toHaveBeenCalled();
    });

    it('should initialise default signal values before load', () => {
      annexesServiceSpy.getCommunityServices.mockReturnValueOnce(new Subject());
      fixture = TestBed.createComponent(AnnexesServicesList);
      component = fixture.componentInstance;
      // Before any subscribe resolves, services should be empty and loading true
      expect(component.services()).toEqual([]);
      expect(component.loading()).toBe(true);
      expect(component.pendingUnsubscribe()).toBeNull();
    });
  });

  // ── 2. loadServices ───────────────────────────────────────────────

  describe('loadServices', () => {
    beforeEach(async () => {
      await createComponent();
      annexesServiceSpy.getCommunityServices.mockClear();
    });

    it('should populate services and clear loading on success', () => {
      const list = buildAnnexList();
      annexesServiceSpy.getCommunityServices.mockReturnValue(of(new ApiResponse(list)));
      component.loadServices();
      expect(component.services()).toEqual(list);
      expect(component.loading()).toBe(false);
    });

    it('should default to empty array when response.data is missing', () => {
      annexesServiceSpy.getCommunityServices.mockReturnValue(
        of(new ApiResponse(undefined as unknown as CommunityAnnex[])),
      );
      component.loadServices();
      expect(component.services()).toEqual([]);
      expect(component.loading()).toBe(false);
    });

    it('should add an error toast and clear loading on error', () => {
      annexesServiceSpy.getCommunityServices.mockReturnValue(throwError(() => new Error('boom')));
      component.loadServices();
      expect(messageServiceSpy.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' }),
      );
      expect(component.loading()).toBe(false);
    });
  });

  // ── 3. Computed signals ───────────────────────────────────────────

  describe('computed signals', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('subscribedServices should keep only subscribed entries', () => {
      component.services.set([
        buildAnnex({ feature: 'a', subscribed: true }),
        buildAnnex({ feature: 'b', subscribed: false }),
        buildAnnex({ feature: 'c', subscribed: true }),
      ]);
      expect(component.subscribedServices().map((s) => s.feature)).toEqual(['a', 'c']);
    });

    it('availableToAdd should keep only unsubscribed entries', () => {
      component.services.set([
        buildAnnex({ feature: 'a', subscribed: true }),
        buildAnnex({ feature: 'b', subscribed: false }),
        buildAnnex({ feature: 'c', subscribed: false }),
      ]);
      expect(component.availableToAdd().map((s) => s.feature)).toEqual(['b', 'c']);
    });

    it('canManage should reflect UserContextService.compareWithActiveRole', async () => {
      userContextSpy.compareWithActiveRole.mockReturnValue(true);
      expect(component.canManage()).toBe(true);
      expect(userContextSpy.compareWithActiveRole).toHaveBeenCalledWith(Role.GESTIONNAIRE);

      // `canManage` is a computed signal — its value is memoized until a
      // reactive dependency changes. The mocked `compareWithActiveRole` is
      // not a signal, so re-mocking it on the same instance won't trigger a
      // recompute. Recreate the component to evaluate the new mock value.
      userContextSpy.compareWithActiveRole.mockReturnValue(false);
      await createComponent();
      expect(component.canManage()).toBe(false);
    });
  });

  // ── 4. openModule ─────────────────────────────────────────────────

  describe('openModule', () => {
    it('should navigate by url to the service frontendRoute', async () => {
      await createComponent();
      const annex = buildAnnex({ frontendRoute: '/foo/bar' });
      component.openModule(annex);
      expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/foo/bar');
    });
  });

  // ── 5. openAddDialog ──────────────────────────────────────────────

  describe('openAddDialog', () => {
    let onClose: Subject<boolean | undefined>;

    beforeEach(async () => {
      onClose = new Subject<boolean | undefined>();
      dialogServiceSpy.open.mockReturnValue({ onClose, destroy: vi.fn() });
      await createComponent();
    });

    it('should open the dialog with the currently available services', () => {
      const available: CommunityAnnex[] = [buildAnnex({ feature: 'avail', subscribed: false })];
      component.services.set([...available, buildAnnex({ feature: 'subbed', subscribed: true })]);
      component.openAddDialog();
      expect(dialogServiceSpy.open).toHaveBeenCalledTimes(1);
      const config = dialogServiceSpy.open.mock.calls[0][1] as DynamicDialogConfig<{
        available: CommunityAnnex[];
      }>;
      expect(config.data?.available.map((a) => a.feature)).toEqual(['avail']);
      expect(config.modal).toBe(true);
    });

    it('should reload services when the dialog closes with true', () => {
      component.openAddDialog();
      const reloadSpy = vi.spyOn(component, 'loadServices');
      onClose.next(true);
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('should NOT reload services when the dialog closes with false', () => {
      component.openAddDialog();
      const reloadSpy = vi.spyOn(component, 'loadServices');
      onClose.next(false);
      expect(reloadSpy).not.toHaveBeenCalled();
    });
  });

  // ── 6. unsubscribe ────────────────────────────────────────────────

  describe('unsubscribe', () => {
    beforeEach(async () => {
      await createComponent();
    });

    function buildEvent(): { event: MouseEvent; stopPropagation: ReturnType<typeof vi.fn> } {
      const stopPropagation = vi.fn();
      const event = {
        stopPropagation,
        currentTarget: {} as EventTarget,
      } as unknown as MouseEvent;
      return { event, stopPropagation };
    }

    it('should stop event propagation', () => {
      const { event, stopPropagation } = buildEvent();
      component.unsubscribe(buildAnnex(), event);
      expect(stopPropagation).toHaveBeenCalled();
    });

    it('should short-circuit when an unsubscribe is already pending', () => {
      component.pendingUnsubscribe.set('other-feature');
      const { event } = buildEvent();
      component.unsubscribe(buildAnnex(), event);
      expect(confirmationSpy.confirm).not.toHaveBeenCalled();
    });

    it('should ask for confirmation with a danger severity', () => {
      component.unsubscribe(buildAnnex(), buildEvent().event);
      expect(confirmationSpy.confirm).toHaveBeenCalledTimes(1);
      const args = confirmationSpy.confirm.mock.calls[0][0] as Confirmation;
      expect(args.acceptButtonProps).toEqual({ severity: 'danger' });
    });

    it('should call service.unsubscribe and reload on confirm-accept success', () => {
      const annex = buildAnnex({ unsubscribePath: '/api/unsub' });
      component.unsubscribe(annex, buildEvent().event);
      const reloadSpy = vi.spyOn(component, 'loadServices');
      // simulate accept
      const confirmation = confirmationSpy.confirm.mock.calls[0][0] as Confirmation;
      const accept = confirmation.accept as () => void;
      accept();
      expect(annexesServiceSpy.unsubscribe).toHaveBeenCalledWith('/api/unsub');
      expect(snackbarSpy.openSnackBar).toHaveBeenCalledWith(
        'ANNEXES_SERVICES.UNSUBSCRIBE_SUCCESS',
        VALIDATION_TYPE,
      );
      expect(reloadSpy).toHaveBeenCalled();
      expect(component.pendingUnsubscribe()).toBeNull();
    });

    it('should call errorHandler and clear pendingUnsubscribe on error', () => {
      annexesServiceSpy.unsubscribe.mockReturnValue(throwError(() => new Error('nope')));
      component.unsubscribe(buildAnnex(), buildEvent().event);
      const confirmation = confirmationSpy.confirm.mock.calls[0][0] as Confirmation;
      const accept = confirmation.accept as () => void;
      accept();
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
      expect(component.pendingUnsubscribe()).toBeNull();
    });
  });
});
