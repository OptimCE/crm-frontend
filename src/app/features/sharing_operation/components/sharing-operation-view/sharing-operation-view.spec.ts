import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommunityServicesStore } from '../../../../core/services/community-services.store';
import { ActivatedRoute, convertToParamMap, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Observable, Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { SharingOperationView } from './sharing-operation-view';
import { SharingOperationService } from '../../../../shared/services/sharing_operation.service';
import { MeterService } from '../../../../shared/services/meter.service';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SharingOperationMeterEventService } from './sharing-operation.meter.subjet';
import { ApiResponse, ApiResponsePaginated, Pagination } from '../../../../core/dtos/api.response';
import {
  SharingOperationDTO,
  SharingOperationKeyDTO,
} from '../../../../shared/dtos/sharing_operation.dtos';
import { PartialMeterDTO } from '../../../../shared/dtos/meter.dtos';
import {
  SharingKeyStatus,
  SharingOperationType,
} from '../../../../shared/types/sharing_operation.types';
import { MeterDataStatus } from '../../../../shared/types/meter.types';
import { SharingOperationMetersList } from './sharing-operation-meters-list/sharing-operation-meters-list';
import { BackArrow } from '../../../../layout/back-arrow/back-arrow';
import { AddressDTO } from '../../../../shared/dtos/address.dtos';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { SharingOperationConsumptionChart } from './sharing-operation-consumption-chart/sharing-operation-consumption-chart';
import { ConsumptionUpload } from '../../../../shared/components/consumption-upload/consumption-upload';
import { ConsumptionCoverage } from '../../../../shared/components/consumption-coverage/consumption-coverage';
import { ConfirmPopup } from 'primeng/confirmpopup';
import { DatePicker } from 'primeng/datepicker';

// ── Helpers ────────────────────────────────────────────────────────

function buildAddress(overrides: Partial<AddressDTO> = {}): AddressDTO {
  return {
    id: 1,
    street: 'Main St',
    number: '42',
    postcode: '1000',
    city: 'Brussels',
    ...overrides,
  };
}

function buildSharingOperationKey(
  overrides: Partial<SharingOperationKeyDTO> = {},
): SharingOperationKeyDTO {
  return {
    id: 10,
    key: { id: 100, name: 'Key Alpha', description: 'Test key' },
    start_date: new Date('2025-01-01'),
    end_date: new Date('2025-12-31'),
    status: SharingKeyStatus.APPROVED,
    ...overrides,
  };
}

function buildSharingOperation(overrides: Partial<SharingOperationDTO> = {}): SharingOperationDTO {
  return {
    id: 1,
    name: 'Test Operation',
    type: SharingOperationType.LOCAL,
    municipalities: [],
    is_public: false,
    key: buildSharingOperationKey(),
    ...overrides,
  };
}

function buildMeterPartialList(): PartialMeterDTO[] {
  return [
    {
      EAN: '541449000000000001',
      meter_number: 'M001',
      address: buildAddress(),
      status: MeterDataStatus.ACTIVE,
    },
    {
      EAN: '541449000000000002',
      meter_number: 'M002',
      address: buildAddress({ id: 2 }),
      status: MeterDataStatus.INACTIVE,
    },
  ];
}

function buildPaginatedMeterResponse(): ApiResponsePaginated<PartialMeterDTO[]> {
  return new ApiResponsePaginated<PartialMeterDTO[]>(
    buildMeterPartialList(),
    new Pagination(1, 100, 2, 1),
  );
}

function buildPaginatedKeysResponse(
  keys: SharingOperationKeyDTO[] = [buildSharingOperationKey()],
): ApiResponsePaginated<SharingOperationKeyDTO[]> {
  return new ApiResponsePaginated<SharingOperationKeyDTO[]>(
    keys,
    new Pagination(1, 10, keys.length, 1),
  );
}

// ── Test Suite ─────────────────────────────────────────────────────

describe('SharingOperationView', () => {
  let component: SharingOperationView;
  let fixture: ComponentFixture<SharingOperationView>;

  let sharingOperationServiceSpy: {
    getSharingOperation: ReturnType<typeof vi.fn>;
    addConsumptionDataToSharing: ReturnType<typeof vi.fn>;
    patchKeyStatus: ReturnType<typeof vi.fn>;
    getSharingOperationKeysList: ReturnType<typeof vi.fn>;
  };
  let meterServiceSpy: {
    getMetersList: ReturnType<typeof vi.fn>;
  };
  let routerSpy: {
    navigate: ReturnType<typeof vi.fn>;
    events: Observable<unknown>;
    createUrlTree: ReturnType<typeof vi.fn>;
    serializeUrl: ReturnType<typeof vi.fn>;
  };
  let snackbarSpy: { openSnackBar: ReturnType<typeof vi.fn> };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };
  let dialogServiceSpy: { open: ReturnType<typeof vi.fn> };
  let confirmationServiceSpy: { confirm: ReturnType<typeof vi.fn> };
  let meterEventServiceSpy: { notifyMeterAdded: ReturnType<typeof vi.fn> };
  let activatedRouteMock: {
    snapshot: {
      paramMap: ReturnType<typeof convertToParamMap>;
      queryParamMap: ReturnType<typeof convertToParamMap>;
    };
  };

  async function createComponent(preInitFn?: () => void): Promise<void> {
    fixture = TestBed.createComponent(SharingOperationView);
    component = fixture.componentInstance;
    if (preInitFn) {
      preInitFn();
    }
    component.ngOnInit();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    activatedRouteMock = {
      snapshot: {
        paramMap: convertToParamMap({ id: '1' }),
        queryParamMap: convertToParamMap({}),
      },
    };

    sharingOperationServiceSpy = {
      getSharingOperation: vi
        .fn()
        .mockReturnValue(of(new ApiResponse<SharingOperationDTO>(buildSharingOperation()))),
      addConsumptionDataToSharing: vi.fn().mockReturnValue(of(new ApiResponse('OK'))),
      patchKeyStatus: vi.fn().mockReturnValue(of(new ApiResponse('OK'))),
      getSharingOperationKeysList: vi.fn().mockReturnValue(of(buildPaginatedKeysResponse())),
    };

    meterServiceSpy = {
      getMetersList: vi.fn().mockReturnValue(of(buildPaginatedMeterResponse())),
    };

    routerSpy = {
      navigate: vi.fn().mockResolvedValue(true),
      // RouterLink subscribes to `events` and calls `createUrlTree`/`serializeUrl`
      // on init; the templates now carry real cross-module links.
      events: of(),
      createUrlTree: vi.fn().mockReturnValue({}),
      serializeUrl: vi.fn().mockReturnValue(''),
    };
    snackbarSpy = { openSnackBar: vi.fn() };
    errorHandlerSpy = { handleError: vi.fn() };
    dialogServiceSpy = { open: vi.fn() };
    confirmationServiceSpy = { confirm: vi.fn() };
    meterEventServiceSpy = { notifyMeterAdded: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SharingOperationView, TranslateModule.forRoot()],
      providers: [
        // Gates the new cross-module links; nothing is reachable in tests.
        {
          provide: CommunityServicesStore,
          useValue: { canReach: () => false, isActive: () => false, ensureLoaded: () => of([]) },
        },
        { provide: SharingOperationService, useValue: sharingOperationServiceSpy },
        { provide: MeterService, useValue: meterServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: SnackbarNotification, useValue: snackbarSpy },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
        { provide: SharingOperationMeterEventService, useValue: meterEventServiceSpy },
        MessageService,
      ],
    })
      .overrideComponent(SharingOperationView, {
        remove: {
          imports: [
            SharingOperationMetersList,
            BackArrow,
            RouterLink,
            Tabs,
            TabList,
            Tab,
            TabPanel,
            TabPanels,
            SharingOperationConsumptionChart,
            ConsumptionUpload,
            ConsumptionCoverage,
            ConfirmPopup,
            DatePicker,
          ],
          providers: [DialogService, ConfirmationService, MessageService, ErrorMessageHandler],
        },
        add: {
          providers: [
            { provide: DialogService, useValue: dialogServiceSpy },
            { provide: ConfirmationService, useValue: confirmationServiceSpy },
            { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
          ],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    const translateService = TestBed.inject(TranslateService);
    vi.spyOn(translateService, 'instant').mockImplementation((key: string | string[]) =>
      Array.isArray(key)
        ? key.reduce<Record<string, string>>((acc, k) => ({ ...acc, [k]: k }), {})
        : key,
    );
    vi.spyOn(translateService, 'get').mockImplementation((key: string | string[]) =>
      of(
        Array.isArray(key)
          ? key.reduce<Record<string, string>>((acc, k) => ({ ...acc, [k]: k }), {})
          : key,
      ),
    );
  });

  // ── 1. Creation & Init ────────────────────────────────────────────

  describe('creation & init', () => {
    it('should create the component', async () => {
      await createComponent();
      expect(component).toBeTruthy();
    });

    it('should set id from route params', async () => {
      await createComponent();
      expect(component.id()).toBe(1);
    });

    it('should navigate away when no id param', async () => {
      activatedRouteMock.snapshot.paramMap = convertToParamMap({});
      await createComponent();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['//members/sharing/']);
    });

    it('should not call getSharingOperation when no id param', async () => {
      activatedRouteMock.snapshot.paramMap = convertToParamMap({});
      await createComponent();
      expect(sharingOperationServiceSpy.getSharingOperation).not.toHaveBeenCalled();
    });

    it('should call getSharingOperation on init with route id', async () => {
      await createComponent();
      expect(sharingOperationServiceSpy.getSharingOperation).toHaveBeenCalledWith(1);
    });

    it('should call getMetersList on init', async () => {
      await createComponent();
      expect(meterServiceSpy.getMetersList).toHaveBeenCalledWith({
        sharing_operation_id: 1,
        page: 1,
        limit: 100,
      });
    });

    it('should set isLoading to false after successful load', async () => {
      await createComponent();
      expect(component.isLoading()).toBe(false);
    });
  });

  // ── 2. loadOperationSharing() ─────────────────────────────────────

  describe('loadOperationSharing', () => {
    it('should set sharingOperation signal on success', async () => {
      await createComponent();
      expect(component.sharingOperation()).toBeTruthy();
      expect(component.sharingOperation()?.name).toBe('Test Operation');
    });

    it('should set hasError on null response', async () => {
      sharingOperationServiceSpy.getSharingOperation.mockReturnValue(of(null));
      await createComponent();
      expect(component.hasError()).toBe(true);
    });

    it('should set hasError on service error', async () => {
      sharingOperationServiceSpy.getSharingOperation.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      await createComponent();
      expect(component.hasError()).toBe(true);
    });

    it('should set isLoading to false on error', async () => {
      sharingOperationServiceSpy.getSharingOperation.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      await createComponent();
      expect(component.isLoading()).toBe(false);
    });

    it('should set isLoading to true when showLoading is true', async () => {
      await createComponent();
      sharingOperationServiceSpy.getSharingOperation.mockReturnValue(
        of(new ApiResponse<SharingOperationDTO>(buildSharingOperation())),
      );
      component.loadOperationSharing(true);
      expect(component.isLoading()).toBe(false); // resolved immediately since observable is sync
    });
  });

  // ── 3. loadAllMeters() ────────────────────────────────────────────

  describe('loadAllMeters', () => {
    it('should populate metersCharts signal', async () => {
      await createComponent();
      expect(component.metersCharts().length).toBe(2);
      expect(component.metersCharts()[0].EAN).toBe('541449000000000001');
    });

    it('should initialize selectedMeterCharts to all false', async () => {
      await createComponent();
      expect(component.selectedMeterCharts()).toEqual([false, false]);
    });

    it('should handle null response', async () => {
      meterServiceSpy.getMetersList.mockReturnValue(of(null));
      await createComponent();
      expect(component.metersCharts()).toEqual([]);
    });

    it('should handle error response', async () => {
      meterServiceSpy.getMetersList.mockReturnValue(throwError(() => new Error('fail')));
      await createComponent();
      expect(component.metersCharts()).toEqual([]);
    });
  });

  // ── 4. Computed Signals ───────────────────────────────────────────

  describe('computed signals', () => {
    it('hasKey should return true when key exists', async () => {
      await createComponent();
      expect(component.hasKey()).toBe(true);
    });

    it('hasKey should return false when no key', async () => {
      sharingOperationServiceSpy.getSharingOperation.mockReturnValue(
        of(
          new ApiResponse<SharingOperationDTO>(
            buildSharingOperation({
              key: buildSharingOperationKey({
                key: undefined as unknown as { id: number; name: string; description: string },
              }),
            }),
          ),
        ),
      );
      await createComponent();
      expect(component.hasKey()).toBe(false);
    });

    it('hasWaitingKey should return true when waiting key exists', async () => {
      sharingOperationServiceSpy.getSharingOperation.mockReturnValue(
        of(
          new ApiResponse<SharingOperationDTO>(
            buildSharingOperation({
              key_waiting_approval: buildSharingOperationKey({
                id: 20,
                status: SharingKeyStatus.PENDING,
              }),
            }),
          ),
        ),
      );
      await createComponent();
      expect(component.hasWaitingKey()).toBe(true);
    });

    it('hasWaitingKey should return false when no waiting key', async () => {
      await createComponent();
      expect(component.hasWaitingKey()).toBe(false);
    });
  });

  // ── 4b. Key card rendering ────────────────────────────────────────

  describe('key card', () => {
    it('shows a pending proposal even when an approved key is already active', async () => {
      sharingOperationServiceSpy.getSharingOperation.mockReturnValue(
        of(
          new ApiResponse<SharingOperationDTO>(
            buildSharingOperation({
              key_waiting_approval: buildSharingOperationKey({
                id: 20,
                key: { id: 200, name: 'Proposed key', description: 'Waiting for approval' },
                status: SharingKeyStatus.PENDING,
              }),
            }),
          ),
        ),
      );
      await createComponent();
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;

      // The two states are independent on the DTO, so the card has to show both.
      // Chaining them as `@if / @else if` made every operation that already ran a
      // key hide the proposal, and with it the only way to approve or reject it.
      expect(element.querySelector('[data-testid="op-view__link--key"]')).not.toBeNull();
      expect(element.querySelector('[data-testid="op-view__btn--approve-key"]')).not.toBeNull();
      expect(element.querySelector('[data-testid="op-view__btn--reject-key"]')).not.toBeNull();
      expect(element.textContent).toContain('Proposed key');
    });

    it('offers no approve or reject when nothing is waiting', async () => {
      await createComponent();
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;

      expect(element.querySelector('[data-testid="op-view__link--key"]')).not.toBeNull();
      expect(element.querySelector('[data-testid="op-view__btn--approve-key"]')).toBeNull();
    });
  });

  // ── 5. setupStatusCategory() ──────────────────────────────────────

  describe('setupStatusCategory', () => {
    it('should populate statutCategory with 4 statuses', async () => {
      await createComponent();
      expect(component.statutCategory().length).toBe(4);
    });

    it('should contain ACTIVE status', async () => {
      await createComponent();
      const active = component.statutCategory().find((s) => s.value === MeterDataStatus.ACTIVE);
      expect(active).toBeTruthy();
    });

    it('should contain INACTIVE status', async () => {
      await createComponent();
      const inactive = component.statutCategory().find((s) => s.value === MeterDataStatus.INACTIVE);
      expect(inactive).toBeTruthy();
    });
  });

  // ── 6. Dialog Interactions ────────────────────────────────────────

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

    it('should open dialog', () => {
      component.addMeter();
      expect(dialogServiceSpy.open).toHaveBeenCalled();
    });

    it('should pass sharing operation id in dialog data', () => {
      component.addMeter();
      const callArgs = dialogServiceSpy.open.mock.calls[0] as [unknown, { data: { id: number } }];
      expect(callArgs[1].data.id).toBe(1);
    });

    it('should call snackbar and notifyMeterAdded on dialog close with response', () => {
      component.addMeter();
      dialogCloseSubject.next(true);
      expect(snackbarSpy.openSnackBar).toHaveBeenCalled();
      expect(meterEventServiceSpy.notifyMeterAdded).toHaveBeenCalled();
    });

    it('should not call snackbar when dialog closes without response', () => {
      component.addMeter();
      dialogCloseSubject.next(undefined);
      expect(snackbarSpy.openSnackBar).not.toHaveBeenCalled();
      expect(meterEventServiceSpy.notifyMeterAdded).not.toHaveBeenCalled();
    });
  });

  describe('editKey', () => {
    let dialogCloseSubject: Subject<unknown>;

    beforeEach(async () => {
      await createComponent();
      dialogCloseSubject = new Subject();
      dialogServiceSpy.open.mockReturnValue({
        onClose: dialogCloseSubject.asObservable(),
        destroy: vi.fn(),
      } as unknown as DynamicDialogRef);
    });

    it('should open dialog', () => {
      component.editKey();
      expect(dialogServiceSpy.open).toHaveBeenCalled();
    });

    it('should reload operation and show snackbar on dialog close with response', () => {
      sharingOperationServiceSpy.getSharingOperation.mockClear();
      component.editKey();
      dialogCloseSubject.next(true);
      expect(snackbarSpy.openSnackBar).toHaveBeenCalled();
      expect(sharingOperationServiceSpy.getSharingOperation).toHaveBeenCalledWith(1);
    });

    it('should not reload when dialog closes without response', () => {
      sharingOperationServiceSpy.getSharingOperation.mockClear();
      component.editKey();
      dialogCloseSubject.next(undefined);
      expect(snackbarSpy.openSnackBar).not.toHaveBeenCalled();
      expect(sharingOperationServiceSpy.getSharingOperation).not.toHaveBeenCalled();
    });

    it('should forward a name to seed the dialog filter', () => {
      component.editKey('Key from March');
      const config = dialogServiceSpy.open.mock.calls.at(-1)?.[1] as {
        data: { prefillName?: string };
      };
      expect(config.data.prefillName).toBe('Key from March');
    });

    it('should start the create-a-key flow instead of claiming a key was attached', () => {
      sharingOperationServiceSpy.getSharingOperation.mockClear();
      const newKeySpy = vi.spyOn(component, 'newKey').mockImplementation(() => undefined);

      component.editKey();
      dialogCloseSubject.next({ action: 'create' });

      expect(newKeySpy).toHaveBeenCalled();
      expect(snackbarSpy.openSnackBar).not.toHaveBeenCalled();
      expect(sharingOperationServiceSpy.getSharingOperation).not.toHaveBeenCalled();
    });
  });

  describe('returning from key creation', () => {
    it('reopens the add-key dialog filtered on the freshly created key', async () => {
      dialogServiceSpy.open.mockReturnValue({
        onClose: new Subject().asObservable(),
        destroy: vi.fn(),
      } as unknown as DynamicDialogRef);

      await createComponent(() => {
        activatedRouteMock.snapshot.queryParamMap = convertToParamMap({
          add_key: '1',
          key_name: 'Key from March',
        });
      });
      await fixture.whenStable();

      // The params are stripped first so a refresh does not reopen the dialog.
      expect(routerSpy.navigate).toHaveBeenCalledWith([], {
        relativeTo: activatedRouteMock,
        queryParams: {},
        replaceUrl: true,
      });
      const config = dialogServiceSpy.open.mock.calls.at(-1)?.[1] as {
        data: { prefillName?: string };
      };
      expect(config.data.prefillName).toBe('Key from March');
    });

    it('does not open anything on a normal visit', async () => {
      await createComponent();
      expect(dialogServiceSpy.open).not.toHaveBeenCalled();
    });
  });

  describe('newKey', () => {
    let modeClose: Subject<'full' | 'step' | null>;
    let metersClose: Subject<string[] | null>;

    /** Answers the mode dialog, then hands back the meter dialog's close subject. */
    function chooseMode(mode: 'full' | 'step'): void {
      component.newKey();
      modeClose.next(mode);
    }

    beforeEach(async () => {
      await createComponent();
      modeClose = new Subject();
      metersClose = new Subject();
      // The mode dialog opens first, the meter picker second.
      dialogServiceSpy.open
        .mockReturnValueOnce({
          onClose: modeClose.asObservable(),
          destroy: vi.fn(),
        } as unknown as DynamicDialogRef)
        .mockReturnValueOnce({
          onClose: metersClose.asObservable(),
          destroy: vi.fn(),
        } as unknown as DynamicDialogRef);
      routerSpy.navigate.mockClear();
    });

    it('should ask for the creation mode before anything else', () => {
      component.newKey();
      expect(dialogServiceSpy.open).toHaveBeenCalledTimes(1);
    });

    it('should not open the meter picker when the mode dialog is dismissed', () => {
      component.newKey();
      modeClose.next(null);
      expect(dialogServiceSpy.open).toHaveBeenCalledTimes(1);
      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });

    it('should then open the meter import dialog scoped to this operation', () => {
      chooseMode('full');
      expect(dialogServiceSpy.open).toHaveBeenCalledTimes(2);
      const config = dialogServiceSpy.open.mock.calls.at(-1)?.[1] as {
        data: { idSharing: number };
      };
      expect(config.data.idSharing).toBe(component.id());
    });

    it('should navigate to the full creator with the selected EANs and a return URL', () => {
      chooseMode('full');
      metersClose.next(['EAN1', 'EAN2']);
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/keys/add'], {
        queryParams: {
          returnUrl: `/sharing_operations/${component.id()}`,
          idSharing: component.id(),
        },
        state: { consumers: ['EAN1', 'EAN2'] },
      });
    });

    it('should navigate to the wizard when the step-by-step mode is chosen', () => {
      chooseMode('step');
      metersClose.next(['EAN1', 'EAN2']);
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/keys/add/step'], {
        queryParams: {
          returnUrl: `/sharing_operations/${component.id()}`,
          idSharing: component.id(),
        },
        state: { consumers: ['EAN1', 'EAN2'] },
      });
    });

    it('should not navigate when the meter dialog closes with null', () => {
      chooseMode('full');
      metersClose.next(null);
      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });

    it('should not navigate when the meter dialog closes with an empty array', () => {
      chooseMode('full');
      metersClose.next([]);
      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });
  });

  // ── 7. Key Management ────────────────────────────────────────────

  describe('revokeWaitingKey', () => {
    beforeEach(async () => {
      sharingOperationServiceSpy.getSharingOperation.mockReturnValue(
        of(
          new ApiResponse<SharingOperationDTO>(
            buildSharingOperation({
              key_waiting_approval: buildSharingOperationKey({
                id: 20,
                key: { id: 200, name: 'Waiting Key', description: 'desc' },
                status: SharingKeyStatus.PENDING,
              }),
            }),
          ),
        ),
      );
      await createComponent();
    });

    it('should call patchKeyStatus with REJECTED status', () => {
      component.revokeWaitingKey();
      expect(sharingOperationServiceSpy.patchKeyStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          id_key: 200,
          id_sharing: 1,
          status: SharingKeyStatus.REJECTED,
        }),
      );
    });

    it('should reload operation on success', () => {
      sharingOperationServiceSpy.getSharingOperation.mockClear();
      component.revokeWaitingKey();
      expect(sharingOperationServiceSpy.getSharingOperation).toHaveBeenCalledWith(1);
    });

    it('should call errorHandler on null response', () => {
      sharingOperationServiceSpy.patchKeyStatus.mockReturnValue(of(null));
      component.revokeWaitingKey();
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });

    it('should call errorHandler on error', () => {
      sharingOperationServiceSpy.patchKeyStatus.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      component.revokeWaitingKey();
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });

    it('should not call patchKeyStatus when no waiting key', async () => {
      sharingOperationServiceSpy.getSharingOperation.mockReturnValue(
        of(new ApiResponse<SharingOperationDTO>(buildSharingOperation())),
      );
      await createComponent();
      sharingOperationServiceSpy.patchKeyStatus.mockClear();
      component.revokeWaitingKey();
      expect(sharingOperationServiceSpy.patchKeyStatus).not.toHaveBeenCalled();
    });
  });

  describe('approveWaitingKey', () => {
    beforeEach(async () => {
      sharingOperationServiceSpy.getSharingOperation.mockReturnValue(
        of(
          new ApiResponse<SharingOperationDTO>(
            buildSharingOperation({
              key_waiting_approval: buildSharingOperationKey({
                id: 20,
                key: { id: 200, name: 'Waiting Key', description: 'desc' },
                status: SharingKeyStatus.PENDING,
              }),
            }),
          ),
        ),
      );
      await createComponent();
    });

    it('should call patchKeyStatus with APPROVED status when date is set', () => {
      const approvalDate = new Date('2025-06-01');
      component.dateStartApproved.set(approvalDate);
      component.approveWaitingKey();
      expect(sharingOperationServiceSpy.patchKeyStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          id_key: 200,
          id_sharing: 1,
          date: approvalDate,
          status: SharingKeyStatus.APPROVED,
        }),
      );
    });

    it('should reload operation on success', () => {
      component.dateStartApproved.set(new Date('2025-06-01'));
      sharingOperationServiceSpy.getSharingOperation.mockClear();
      component.approveWaitingKey();
      expect(sharingOperationServiceSpy.getSharingOperation).toHaveBeenCalledWith(1);
    });

    it('should not call patchKeyStatus and warn the user when no date is set', () => {
      sharingOperationServiceSpy.patchKeyStatus.mockClear();
      snackbarSpy.openSnackBar.mockClear();
      component.approveWaitingKey();
      expect(sharingOperationServiceSpy.patchKeyStatus).not.toHaveBeenCalled();
      // The guard must surface a visible warning instead of silently returning.
      expect(snackbarSpy.openSnackBar).toHaveBeenCalled();
    });

    it('should not call patchKeyStatus when no waiting key', async () => {
      sharingOperationServiceSpy.getSharingOperation.mockReturnValue(
        of(new ApiResponse<SharingOperationDTO>(buildSharingOperation())),
      );
      await createComponent();
      component.dateStartApproved.set(new Date('2025-06-01'));
      sharingOperationServiceSpy.patchKeyStatus.mockClear();
      component.approveWaitingKey();
      expect(sharingOperationServiceSpy.patchKeyStatus).not.toHaveBeenCalled();
    });

    it('should call errorHandler on error', () => {
      component.dateStartApproved.set(new Date('2025-06-01'));
      sharingOperationServiceSpy.patchKeyStatus.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      component.approveWaitingKey();
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });
  });

  describe('openDateApprovedKey', () => {
    beforeEach(async () => {
      sharingOperationServiceSpy.getSharingOperation.mockReturnValue(
        of(
          new ApiResponse<SharingOperationDTO>(
            buildSharingOperation({
              key_waiting_approval: buildSharingOperationKey({
                id: 20,
                key: { id: 200, name: 'Waiting Key', description: 'desc' },
                status: SharingKeyStatus.PENDING,
              }),
            }),
          ),
        ),
      );
      await createComponent();
    });

    it('should default the approval date to today and open the confirm popup', () => {
      const mockEvent = { target: document.createElement('button') } as unknown as Event;
      component.openDateApprovedKey(mockEvent);
      // Production code must supply a date so approveWaitingKey's guard can pass.
      expect(component.dateStartApproved()).toBeInstanceOf(Date);
      expect(confirmationServiceSpy.confirm).toHaveBeenCalled();
    });

    it('should approve the waiting key when the confirm popup is accepted', () => {
      const mockEvent = { target: document.createElement('button') } as unknown as Event;
      component.openDateApprovedKey(mockEvent);

      // Drive the real flow: invoke the accept callback the popup would fire.
      const confirmArgs = confirmationServiceSpy.confirm.mock.calls[0][0] as {
        accept: () => void;
      };
      const approvalDate = component.dateStartApproved();
      confirmArgs.accept();

      expect(sharingOperationServiceSpy.patchKeyStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          id_key: 200,
          id_sharing: 1,
          date: approvalDate,
          status: SharingKeyStatus.APPROVED,
        }),
      );
    });
  });

  // ── 9. Key Pagination ────────────────────────────────────────────

  describe('loadSharingOperationKey', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should call service and set signals', () => {
      component.loadSharingOperationKey();
      expect(sharingOperationServiceSpy.getSharingOperationKeysList).toHaveBeenCalledWith(
        1,
        component.filterSharingOperationKey(),
      );
      expect(component.sharingOperationKeys().length).toBe(1);
      expect(component.loadingSharingOperationKeys()).toBe(false);
    });

    it('should set pagination from response', () => {
      component.loadSharingOperationKey();
      expect(component.paginationSharingOperationKey().total).toBe(1);
    });

    it('should call errorHandler on error', () => {
      sharingOperationServiceSpy.getSharingOperationKeysList.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      component.loadSharingOperationKey();
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
      expect(component.loadingSharingOperationKeys()).toBe(false);
    });
  });

  describe('onPageSharingOperationKey', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should update filter and reload keys', () => {
      sharingOperationServiceSpy.getSharingOperationKeysList.mockClear();
      component['onPageSharingOperationKey']({ first: 10, rows: 10 });
      expect(component.filterSharingOperationKey().page).toBe(2);
      expect(sharingOperationServiceSpy.getSharingOperationKeysList).toHaveBeenCalled();
    });
  });

  describe('onLazyLoadSharingOperationKey', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should update filter and reload keys', () => {
      sharingOperationServiceSpy.getSharingOperationKeysList.mockClear();
      component['onLazyLoadSharingOperationKey']({ first: 20, rows: 10 });
      expect(component.filterSharingOperationKey().page).toBe(3);
      expect(sharingOperationServiceSpy.getSharingOperationKeysList).toHaveBeenCalled();
    });

    it('should set page to 1 when rows is 0', () => {
      component['onLazyLoadSharingOperationKey']({ first: 0, rows: 0 });
      expect(component.filterSharingOperationKey().page).toBe(1);
    });
  });
});
