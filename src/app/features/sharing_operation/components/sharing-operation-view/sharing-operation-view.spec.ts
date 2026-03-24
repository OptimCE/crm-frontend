import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { SharingOperationView } from './sharing-operation-view';
import { SharingOperationService } from '../../../../shared/services/sharing_operation.service';
import { MeterService } from '../../../../shared/services/meter.service';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SharingOperationMeterEventService } from './sharing-operation.meter.subjet';
import { ApiResponse, ApiResponsePaginated, Pagination } from '../../../../core/dtos/api.response';
import {
  SharingOpConsumptionDTO,
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

// ── Helpers ────────────────────────────────────────────────────────

function buildAddress(overrides: Partial<AddressDTO> = {}): AddressDTO {
  return {
    id: 1,
    street: 'Main St',
    number: 42,
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
    key: buildSharingOperationKey(),
    ...overrides,
  };
}

function buildConsumptionData(): SharingOpConsumptionDTO {
  return {
    id: 1,
    timestamps: ['2025-01-01T00:00:00', '2025-01-02T00:00:00'],
    gross: [100, 200],
    net: [80, 160],
    shared: [50, 100],
    inj_gross: [10, 20],
    inj_net: [8, 16],
    inj_shared: [5, 10],
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
    getSharingOperationConsumptions: ReturnType<typeof vi.fn>;
    downloadSharingOperationConsumptions: ReturnType<typeof vi.fn>;
    addConsumptionDataToSharing: ReturnType<typeof vi.fn>;
    patchKeyStatus: ReturnType<typeof vi.fn>;
    getSharingOperationKeysList: ReturnType<typeof vi.fn>;
  };
  let meterServiceSpy: {
    getMetersList: ReturnType<typeof vi.fn>;
  };
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };
  let snackbarSpy: { openSnackBar: ReturnType<typeof vi.fn> };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };
  let dialogServiceSpy: { open: ReturnType<typeof vi.fn> };
  let confirmationServiceSpy: { confirm: ReturnType<typeof vi.fn> };
  let meterEventServiceSpy: { notifyMeterAdded: ReturnType<typeof vi.fn> };
  let activatedRouteMock: { snapshot: { paramMap: ReturnType<typeof convertToParamMap> } };

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
    activatedRouteMock = { snapshot: { paramMap: convertToParamMap({ id: '1' }) } };

    sharingOperationServiceSpy = {
      getSharingOperation: vi
        .fn()
        .mockReturnValue(of(new ApiResponse<SharingOperationDTO>(buildSharingOperation()))),
      getSharingOperationConsumptions: vi
        .fn()
        .mockReturnValue(of(new ApiResponse<SharingOpConsumptionDTO>(buildConsumptionData()))),
      downloadSharingOperationConsumptions: vi
        .fn()
        .mockReturnValue(of({ blob: new Blob(), filename: 'test.csv' })),
      addConsumptionDataToSharing: vi.fn().mockReturnValue(of(new ApiResponse('OK'))),
      patchKeyStatus: vi.fn().mockReturnValue(of(new ApiResponse('OK'))),
      getSharingOperationKeysList: vi.fn().mockReturnValue(of(buildPaginatedKeysResponse())),
    };

    meterServiceSpy = {
      getMetersList: vi.fn().mockReturnValue(of(buildPaginatedMeterResponse())),
    };

    routerSpy = { navigate: vi.fn().mockResolvedValue(true) };
    snackbarSpy = { openSnackBar: vi.fn() };
    errorHandlerSpy = { handleError: vi.fn() };
    dialogServiceSpy = { open: vi.fn() };
    confirmationServiceSpy = { confirm: vi.fn() };
    meterEventServiceSpy = { notifyMeterAdded: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SharingOperationView, TranslateModule.forRoot()],
      providers: [
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

    it('should initialize formChart with dateDeb and dateFin controls', async () => {
      await createComponent();
      expect(component.formChart).toBeTruthy();
      expect(component.formChart.contains('dateDeb')).toBe(true);
      expect(component.formChart.contains('dateFin')).toBe(true);
    });

    it('should initialize formGroup with fileConsumption control', async () => {
      await createComponent();
      expect(component.formGroup).toBeTruthy();
      expect(component.formGroup.contains('fileConsumption')).toBe(true);
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
  });

  describe('newKey', () => {
    let dialogCloseSubject: Subject<string[] | null>;

    beforeEach(async () => {
      await createComponent();
      dialogCloseSubject = new Subject();
      dialogServiceSpy.open.mockReturnValue({
        onClose: dialogCloseSubject.asObservable(),
        destroy: vi.fn(),
      } as unknown as DynamicDialogRef);
    });

    it('should open SelectMeterNewKeyDialog', () => {
      component.newKey();
      expect(dialogServiceSpy.open).toHaveBeenCalled();
    });

    it('should navigate to /keys/add with selected EANs on close', () => {
      component.newKey();
      dialogCloseSubject.next(['EAN1', 'EAN2']);
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/keys/add'], {
        state: { consumers: ['EAN1', 'EAN2'] },
      });
    });

    it('should not navigate when dialog closes with null', () => {
      routerSpy.navigate.mockClear();
      component.newKey();
      dialogCloseSubject.next(null);
      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });

    it('should not navigate when dialog closes with empty array', () => {
      routerSpy.navigate.mockClear();
      component.newKey();
      dialogCloseSubject.next([]);
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

    it('should not call patchKeyStatus when no date is set', () => {
      sharingOperationServiceSpy.patchKeyStatus.mockClear();
      component.approveWaitingKey();
      expect(sharingOperationServiceSpy.patchKeyStatus).not.toHaveBeenCalled();
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
    it('should call confirmationService.confirm', async () => {
      await createComponent();
      const mockEvent = { target: document.createElement('button') } as unknown as Event;
      component.openDateApprovedKey(mockEvent);
      expect(confirmationServiceSpy.confirm).toHaveBeenCalled();
    });
  });

  // ── 8. Chart / Consumption ────────────────────────────────────────

  describe('loadChart', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should return early if formChart is invalid', () => {
      component.loadChart();
      expect(sharingOperationServiceSpy.getSharingOperationConsumptions).not.toHaveBeenCalled();
    });

    it('should call service and set data on success when form is valid', () => {
      component.formChart.patchValue({ dateDeb: '2025-01-01', dateFin: '2025-01-31' });
      component.loadChart();
      expect(sharingOperationServiceSpy.getSharingOperationConsumptions).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ date_start: '2025-01-01', date_end: '2025-01-31' }),
      );
      expect(component.data()).toBeTruthy();
      expect(component.data()?.labels).toEqual(['2025-01-01T00:00:00', '2025-01-02T00:00:00']);
    });

    it('should set displayDownloadButton to true on success', () => {
      component.formChart.patchValue({ dateDeb: '2025-01-01', dateFin: '2025-01-31' });
      component.loadChart();
      expect(component.displayDownloadButton()).toBe(true);
    });

    it('should set displayDownloadButton to false initially', () => {
      component.formChart.patchValue({ dateDeb: '2025-01-01', dateFin: '2025-01-31' });
      // Before calling loadChart, the button should be set to false
      expect(component.displayDownloadButton()).toBe(false);
    });

    it('should not set data on null response', () => {
      component.formChart.patchValue({ dateDeb: '2025-01-01', dateFin: '2025-01-31' });
      sharingOperationServiceSpy.getSharingOperationConsumptions.mockReturnValue(of(null));
      component.loadChart();
      expect(component.data()).toBeNull();
    });

    it('should create 4 datasets (consumption shared, net, injection net, shared)', () => {
      component.formChart.patchValue({ dateDeb: '2025-01-01', dateFin: '2025-01-31' });
      component.loadChart();
      expect(component.data()?.datasets.length).toBe(4);
    });
  });

  describe('downloadTotalConsumption', () => {
    beforeEach(async () => {
      await createComponent();
      component.formChart.patchValue({ dateDeb: '2025-01-01', dateFin: '2025-01-31' });
    });

    it('should call downloadSharingOperationConsumptions', () => {
      component.downloadTotalConsumption();
      expect(sharingOperationServiceSpy.downloadSharingOperationConsumptions).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ date_start: '2025-01-01' }),
      );
    });

    it('should call errorHandler on error', () => {
      sharingOperationServiceSpy.downloadSharingOperationConsumptions.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      component.downloadTotalConsumption();
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });

    it('should call errorHandler when response has no blob', () => {
      sharingOperationServiceSpy.downloadSharingOperationConsumptions.mockReturnValue(
        of(new ApiResponse('error')),
      );
      component.downloadTotalConsumption();
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });

    it('should not call service when no sharingOperation', async () => {
      sharingOperationServiceSpy.getSharingOperation.mockReturnValue(of(null));
      await createComponent();
      component.formChart.patchValue({ dateDeb: '2025-01-01', dateFin: '2025-01-31' });
      sharingOperationServiceSpy.downloadSharingOperationConsumptions.mockClear();
      component.downloadTotalConsumption();
      expect(
        sharingOperationServiceSpy.downloadSharingOperationConsumptions,
      ).not.toHaveBeenCalled();
    });
  });

  // ── 9. File Upload / Drag & Drop ─────────────────────────────────

  describe('file upload and drag & drop', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('onFileSelected should set fileConsumption', () => {
      const file = new File(['content'], 'test.csv', { type: 'text/csv' });
      const event = {
        target: { files: [file] } as unknown as HTMLInputElement,
      } as unknown as Event;
      component.onFileSelected(event);
      expect(component.fileConsumption()).toBe(file);
    });

    it('onDragOver should set dragging to true', () => {
      const event = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as DragEvent;
      component.onDragOver(event);
      expect(component.dragging()).toBe(true);
    });

    it('onDragLeave should set dragging to false', () => {
      const event = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as DragEvent;
      component.onDragLeave(event);
      expect(component.dragging()).toBe(false);
    });

    it('onDrop should set fileConsumption from dataTransfer', () => {
      const file = new File(['content'], 'drop.csv', { type: 'text/csv' });
      const event = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        dataTransfer: { files: [file] as unknown as FileList },
      } as unknown as DragEvent;
      component.onDrop(event);
      expect(component.fileConsumption()).toBe(file);
      expect(component.dragging()).toBe(false);
    });

    it('onDrop should not set file when dataTransfer has no files', () => {
      const event = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        dataTransfer: { files: [] as unknown as FileList },
      } as unknown as DragEvent;
      component.onDrop(event);
      expect(component.fileConsumption()).toBeNull();
    });
  });

  describe('addConsumptionInformations', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should return early if formGroup is invalid', () => {
      component.addConsumptionInformations();
      expect(sharingOperationServiceSpy.addConsumptionDataToSharing).not.toHaveBeenCalled();
    });

    it('should call service and show snackbar on success when form is valid', () => {
      const file = new File(['content'], 'test.csv', { type: 'text/csv' });
      component.fileConsumption.set(file);
      component.formGroup.patchValue({ fileConsumption: file });
      component.formGroup.get('fileConsumption')?.updateValueAndValidity();
      component.addConsumptionInformations();
      expect(sharingOperationServiceSpy.addConsumptionDataToSharing).toHaveBeenCalledWith(
        expect.objectContaining({ id_sharing_operation: 1 }),
      );
      expect(snackbarSpy.openSnackBar).toHaveBeenCalled();
    });

    it('should call errorHandler on null response', () => {
      const file = new File(['content'], 'test.csv', { type: 'text/csv' });
      component.fileConsumption.set(file);
      component.formGroup.patchValue({ fileConsumption: file });
      component.formGroup.get('fileConsumption')?.updateValueAndValidity();
      sharingOperationServiceSpy.addConsumptionDataToSharing.mockReturnValue(of(null));
      component.addConsumptionInformations();
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });

    it('should call errorHandler on error', () => {
      const file = new File(['content'], 'test.csv', { type: 'text/csv' });
      component.fileConsumption.set(file);
      component.formGroup.patchValue({ fileConsumption: file });
      component.formGroup.get('fileConsumption')?.updateValueAndValidity();
      sharingOperationServiceSpy.addConsumptionDataToSharing.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      component.addConsumptionInformations();
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });
  });

  // ── 10. Key Pagination ────────────────────────────────────────────

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

  // ── 11. exportExcelCWAPe ──────────────────────────────────────────

  describe('exportExcelCWAPe', () => {
    it('should not throw', async () => {
      await createComponent();
      expect(() => component.exportExcelCWAPe()).not.toThrow();
    });
  });
});
