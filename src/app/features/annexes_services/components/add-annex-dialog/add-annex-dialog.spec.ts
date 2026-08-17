import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { vi } from 'vitest';

import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { Role } from '../../../../core/dtos/role';
import { ApiResponse } from '../../../../core/dtos/api.response';
import { CommunityAnnex } from '../../../../shared/dtos/annexes_services.dtos';
import { CommunityServicesStore } from '../../../../core/services/community-services.store';
import { AnnexesServicesService } from '../../../../shared/services/annexes_services.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AddAnnexDialog } from './add-annex-dialog';

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

// ── Test Suite ───────────────────────────────────────────────────────

describe('AddAnnexDialog', () => {
  let component: AddAnnexDialog;
  let fixture: ComponentFixture<AddAnnexDialog>;

  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };
  // A live signal, not a snapshot: the component derives `available` from the
  // store so that opening before GET /annexes-services/ resolves cannot render
  // the terminal "already activated" empty state. See AddAnnexDialog.available.
  let storeStub: { services: ReturnType<typeof signal<CommunityAnnex[]>> };
  let annexesServiceSpy: { subscribe: ReturnType<typeof vi.fn> };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };
  let snackbarSpy: { openSnackBar: ReturnType<typeof vi.fn> };

  async function createComponent(): Promise<void> {
    fixture = TestBed.createComponent(AddAnnexDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  beforeEach(() => {
    dialogRefSpy = { close: vi.fn() };
    storeStub = {
      services: signal<CommunityAnnex[]>([
        buildAnnex({ feature: 'a' }),
        buildAnnex({ feature: 'b' }),
      ]),
    };
    annexesServiceSpy = { subscribe: vi.fn().mockReturnValue(of(new ApiResponse('ok'))) };
    errorHandlerSpy = { handleError: vi.fn() };
    snackbarSpy = { openSnackBar: vi.fn() };
  });

  async function configureModule(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [AddAnnexDialog, TranslateModule.forRoot()],
      providers: [
        { provide: DynamicDialogRef, useValue: dialogRefSpy },
        { provide: CommunityServicesStore, useValue: storeStub },
        { provide: AnnexesServicesService, useValue: annexesServiceSpy },
        { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
        { provide: SnackbarNotification, useValue: snackbarSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(AddAnnexDialog, { set: { template: '' } })
      .compileComponents();
  }

  // ── 1. Creation & initialization ────────────────────────────────────

  describe('initialization', () => {
    it('should derive the available list from the store, excluding subscribed', async () => {
      storeStub.services.set([
        buildAnnex({ feature: 'a', subscribed: false }),
        buildAnnex({ feature: 'b', subscribed: false }),
        buildAnnex({ feature: 'already', subscribed: true }),
      ]);
      await configureModule();
      await createComponent();
      expect(component).toBeTruthy();
      expect(component.available().map((a) => a.feature)).toEqual(['a', 'b']);
    });

    it('is empty when the store is empty', async () => {
      storeStub.services.set([]);
      await configureModule();
      await createComponent();
      expect(component.available()).toEqual([]);
    });

    it('FILLS IN when the catalogue resolves after the dialog opened', async () => {
      // The regression guard. `available` used to be a snapshot of dialog data
      // taken at open time and never written again, so opening before
      // GET /annexes-services/ landed showed "everything is already activated"
      // on a community with nothing activated — and it never recovered.
      storeStub.services.set([]);
      await configureModule();
      await createComponent();
      expect(component.available()).toEqual([]);

      storeStub.services.set([buildAnnex({ feature: 'late', subscribed: false })]);
      expect(component.available().map((a) => a.feature)).toEqual(['late']);
    });

    it('should default pendingFeature to null', async () => {
      await configureModule();
      await createComponent();
      expect(component.pendingFeature()).toBeNull();
    });
  });

  // ── 2. add() ───────────────────────────────────────────────────────

  describe('add', () => {
    beforeEach(async () => {
      await configureModule();
      await createComponent();
    });

    it('should call the service with the service subscribe path', () => {
      const annex = buildAnnex();
      component.add(annex);
      expect(annexesServiceSpy.subscribe).toHaveBeenCalledWith(annex.subscribePath);
    });

    it('should set pendingFeature while the call is in flight', () => {
      // never-completing observable so we can inspect mid-flight
      annexesServiceSpy.subscribe.mockReturnValue(
        new (class {
          subscribe() {
            return { unsubscribe: () => undefined };
          }
          pipe() {
            return this;
          }
        })(),
      );
      const annex = buildAnnex({ feature: 'pending-feature' });
      component.add(annex);
      expect(component.pendingFeature()).toBe('pending-feature');
    });

    it('should snackbar success and close dialog with true on success', () => {
      const annex = buildAnnex();
      component.add(annex);
      expect(snackbarSpy.openSnackBar).toHaveBeenCalledWith(
        'ANNEXES_SERVICES.DIALOG.SUBSCRIBE_SUCCESS',
        VALIDATION_TYPE,
      );
      expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
    });

    it('should call errorHandler and reset pendingFeature on error', () => {
      annexesServiceSpy.subscribe.mockReturnValue(throwError(() => new Error('fail')));
      component.add(buildAnnex());
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
      expect(component.pendingFeature()).toBeNull();
      expect(dialogRefSpy.close).not.toHaveBeenCalled();
    });

    it('should be a no-op while pendingFeature is set', () => {
      component.pendingFeature.set('already-running');
      component.add(buildAnnex({ feature: 'second' }));
      expect(annexesServiceSpy.subscribe).not.toHaveBeenCalled();
      expect(component.pendingFeature()).toBe('already-running');
    });
  });

  // ── 3. close() ─────────────────────────────────────────────────────

  describe('close', () => {
    it('should close the dialog with false', async () => {
      await configureModule();
      await createComponent();
      component.close();
      expect(dialogRefSpy.close).toHaveBeenCalledWith(false);
    });
  });
});
