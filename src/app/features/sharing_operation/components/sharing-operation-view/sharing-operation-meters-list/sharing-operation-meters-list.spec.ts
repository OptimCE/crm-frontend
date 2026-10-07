import { NO_ERRORS_SCHEMA } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { SharingOperationMetersList } from './sharing-operation-meters-list';
import { SharingOperationService } from '../../../../../shared/services/sharing_operation.service';
import { SharingOperationMeterEventService } from '../sharing-operation.meter.subjet';
import { ErrorMessageHandler } from '../../../../../shared/services-ui/error.message.handler';
import { ApiResponse, ApiResponsePaginated } from '../../../../../core/dtos/api.response';
import { Pagination } from '../../../../../core/dtos/api.response';
import { PartialMeterDTO } from '../../../../../shared/dtos/meter.dtos';
import {
  SharingOperationMetersQueryType,
  SharingOperationMetersQuery,
} from '../../../../../shared/dtos/sharing_operation.dtos';
import { MeterDataStatus } from '../../../../../shared/types/meter.types';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmPopup } from 'primeng/confirmpopup';
import { DialogService } from 'primeng/dynamicdialog';
import { Toast } from 'primeng/toast';
import { AddressDTO } from '../../../../../shared/dtos/address.dtos';

function buildAddress(): AddressDTO {
  return {
    id: 1,
    street: 'Rue Test',
    number: '42',
    postcode: '1000',
    city: 'Bruxelles',
  };
}

function buildMeter(status: MeterDataStatus = MeterDataStatus.ACTIVE): PartialMeterDTO {
  return {
    EAN: 'EAN001',
    meter_number: 'MTR-001',
    address: buildAddress(),
    status,
  };
}

function buildPagination(overrides: Partial<Pagination> = {}): Pagination {
  return { total: 1, total_pages: 1, page: 1, limit: 10, ...overrides };
}

function buildPaginatedResponse(
  meters: PartialMeterDTO[] = [buildMeter()],
  pagination: Pagination = buildPagination(),
): ApiResponsePaginated<PartialMeterDTO[]> {
  return new ApiResponsePaginated<PartialMeterDTO[]>(meters, pagination);
}

describe('SharingOperationMetersList', () => {
  let component: SharingOperationMetersList;
  let fixture: ComponentFixture<SharingOperationMetersList>;

  let sharingServiceSpy: {
    getSharingOperationMetersList: ReturnType<typeof vi.fn>;
    patchMeterStatus: ReturnType<typeof vi.fn>;
    deleteMeterFromSharingOperation: ReturnType<typeof vi.fn>;
  };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };
  let confirmationServiceSpy: { confirm: ReturnType<typeof vi.fn> };
  let meterAddedSubject: Subject<void>;

  beforeEach(async () => {
    sharingServiceSpy = {
      getSharingOperationMetersList: vi.fn().mockReturnValue(of(buildPaginatedResponse())),
      patchMeterStatus: vi.fn().mockReturnValue(of(new ApiResponse('OK'))),
      deleteMeterFromSharingOperation: vi.fn().mockReturnValue(of(new ApiResponse('OK'))),
    };
    errorHandlerSpy = { handleError: vi.fn() };
    routerSpy = { navigate: vi.fn().mockResolvedValue(true) };
    confirmationServiceSpy = { confirm: vi.fn() };
    meterAddedSubject = new Subject<void>();

    await TestBed.configureTestingModule({
      imports: [SharingOperationMetersList, TranslateModule.forRoot()],
      providers: [
        { provide: SharingOperationService, useValue: sharingServiceSpy },
        {
          provide: SharingOperationMeterEventService,
          useValue: { meterAdded$: meterAddedSubject.asObservable() },
        },
        { provide: Router, useValue: routerSpy },
      ],
    })
      .overrideComponent(SharingOperationMetersList, {
        remove: {
          imports: [ConfirmPopup, Toast],
          providers: [DialogService, ConfirmationService, MessageService, ErrorMessageHandler],
        },
        add: {
          providers: [
            { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
            { provide: ConfirmationService, useValue: confirmationServiceSpy },
            { provide: MessageService, useValue: { add: vi.fn() } },
            { provide: DialogService, useValue: {} },
          ],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(SharingOperationMetersList);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('id_sharing', 1);
    fixture.componentRef.setInput('type', SharingOperationMetersQueryType.NOW);

    vi.spyOn(TestBed.inject(TranslateService), 'instant').mockImplementation(
      (key: string | string[]) =>
        Array.isArray(key)
          ? key.reduce<Record<string, string>>((acc, k) => ({ ...acc, [k]: k }), {})
          : key,
    );

    fixture.detectChanges();
  });

  // ── Creation ──────────────────────────────────────────────────────
  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ── ngOnInit ──────────────────────────────────────────────────────
  describe('ngOnInit', () => {
    it('should load meters on init with type passed as a separate argument', () => {
      expect(sharingServiceSpy.getSharingOperationMetersList).toHaveBeenCalledWith(
        1,
        SharingOperationMetersQueryType.NOW,
        expect.objectContaining({ page: 1, limit: 10 }),
      );
    });

    it('should reload meters when meterAdded$ emits', () => {
      sharingServiceSpy.getSharingOperationMetersList.mockClear();
      meterAddedSubject.next();
      expect(sharingServiceSpy.getSharingOperationMetersList).toHaveBeenCalled();
    });
  });

  // ── loadMetersSharingOperation ────────────────────────────────────
  describe('loadMetersSharingOperation', () => {
    it('should populate metersPartialList and pagination on success', () => {
      expect(component.metersPartialList().length).toBe(1);
      expect(component.metersPartialList()[0].EAN).toBe('EAN001');
      expect(component.pagination().total).toBe(1);
      expect(component.loading()).toBe(false);
    });

    it('should call errorHandler and stop loading on error', () => {
      // HttpClient fails with an HttpErrorResponse; the backend's message is in its body.
      const message = 'This sharing operation does not exist';
      sharingServiceSpy.getSharingOperationMetersList.mockReturnValue(
        throwError(
          () => new HttpErrorResponse({ status: 404, error: { data: message, error_code: 3004 } }),
        ),
      );
      meterAddedSubject.next();
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(message);
      expect(component.loading()).toBe(false);
    });

    it('should call errorHandler with null when error has no data', () => {
      sharingServiceSpy.getSharingOperationMetersList.mockReturnValue(throwError(() => ({})));
      meterAddedSubject.next();
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(null);
    });
  });

  // ── applyFilters ──────────────────────────────────────────────────
  describe('applyFilters', () => {
    beforeEach(() => sharingServiceSpy.getSharingOperationMetersList.mockClear());

    it('should add EAN filter when searchField is EAN', () => {
      component['searchField'].set('EAN');
      component['searchText'].set('EAN123');
      component.applyFilters();
      expect(sharingServiceSpy.getSharingOperationMetersList).toHaveBeenCalledWith(
        1,
        SharingOperationMetersQueryType.NOW,
        expect.objectContaining({ EAN: 'EAN123', page: 1 }),
      );
    });

    it('should add meter_number filter', () => {
      component['searchField'].set('meter_number');
      component['searchText'].set('MTR-X');
      component.applyFilters();
      expect(sharingServiceSpy.getSharingOperationMetersList).toHaveBeenCalledWith(
        1,
        SharingOperationMetersQueryType.NOW,
        expect.objectContaining({ meter_number: 'MTR-X' }),
      );
    });

    it('should add street filter', () => {
      component['searchField'].set('street');
      component['searchText'].set('Rue');
      component.applyFilters();
      expect(sharingServiceSpy.getSharingOperationMetersList).toHaveBeenCalledWith(
        1,
        SharingOperationMetersQueryType.NOW,
        expect.objectContaining({ street: 'Rue' }),
      );
    });

    it('should add city filter', () => {
      component['searchField'].set('city');
      component['searchText'].set('Liège');
      component.applyFilters();
      expect(sharingServiceSpy.getSharingOperationMetersList).toHaveBeenCalledWith(
        1,
        SharingOperationMetersQueryType.NOW,
        expect.objectContaining({ city: 'Liège' }),
      );
    });

    it('should add status filter when statusFilter is set', () => {
      component['statusFilter'].set(MeterDataStatus.ACTIVE);
      component.applyFilters();
      expect(sharingServiceSpy.getSharingOperationMetersList).toHaveBeenCalledWith(
        1,
        SharingOperationMetersQueryType.NOW,
        expect.objectContaining({ status: MeterDataStatus.ACTIVE }),
      );
    });

    it('should not include search params when searchText is empty', () => {
      component['searchText'].set('');
      component.applyFilters();
      const query = sharingServiceSpy.getSharingOperationMetersList.mock.calls[0][2] as Omit<
        SharingOperationMetersQuery,
        'type'
      >;
      expect(query.EAN).toBeUndefined();
      expect(query.meter_number).toBeUndefined();
      expect(query.street).toBeUndefined();
      expect(query.city).toBeUndefined();
    });

    it('should reset page to 1', () => {
      component['filter'].set({
        page: 5,
        limit: 10,
      });
      component.applyFilters();
      const query = sharingServiceSpy.getSharingOperationMetersList.mock.calls[0][2] as Omit<
        SharingOperationMetersQuery,
        'type'
      >;
      expect(query.page).toBe(1);
    });
  });

  // ── onSearchTextChange ────────────────────────────────────────────
  describe('onSearchTextChange', () => {
    it('should update searchText and call applyFilters', () => {
      sharingServiceSpy.getSharingOperationMetersList.mockClear();
      const spy = vi.spyOn(component, 'applyFilters');
      component.onSearchTextChange('test');
      expect(component['searchText']()).toBe('test');
      expect(spy).toHaveBeenCalled();
    });
  });

  // ── onSearchFieldChange ───────────────────────────────────────────
  describe('onSearchFieldChange', () => {
    it('should call applyFilters if searchText is non-empty', () => {
      component['searchText'].set('something');
      const spy = vi.spyOn(component, 'applyFilters');
      component.onSearchFieldChange();
      expect(spy).toHaveBeenCalled();
    });

    it('should not call applyFilters if searchText is empty', () => {
      component['searchText'].set('');
      const spy = vi.spyOn(component, 'applyFilters');
      component.onSearchFieldChange();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ── onStatusFilterChange ──────────────────────────────────────────
  describe('onStatusFilterChange', () => {
    it('should update statusFilter and call applyFilters', () => {
      const spy = vi.spyOn(component, 'applyFilters');
      component.onStatusFilterChange(MeterDataStatus.INACTIVE);
      expect(component['statusFilter']()).toBe(MeterDataStatus.INACTIVE);
      expect(spy).toHaveBeenCalled();
    });

    it('should handle null to clear status filter', () => {
      component.onStatusFilterChange(null);
      expect(component['statusFilter']()).toBeNull();
    });
  });

  // ── lazyLoadMeter ─────────────────────────────────────────────────
  describe('lazyLoadMeter', () => {
    it('should calculate page from event and reload', () => {
      sharingServiceSpy.getSharingOperationMetersList.mockClear();
      component['lazyLoadMeter']({ first: 20, rows: 10 } as never);
      const query = sharingServiceSpy.getSharingOperationMetersList.mock.calls[0][2] as Omit<
        SharingOperationMetersQuery,
        'type'
      >;
      expect(query.page).toBe(3);
    });

    it('should default page to 1 when rows is 0', () => {
      sharingServiceSpy.getSharingOperationMetersList.mockClear();
      component['lazyLoadMeter']({ first: 0, rows: 0 } as never);
      const query = sharingServiceSpy.getSharingOperationMetersList.mock.calls[0][2] as Omit<
        SharingOperationMetersQuery,
        'type'
      >;
      expect(query.page).toBe(1);
    });

    it('should clamp page to at least 1', () => {
      sharingServiceSpy.getSharingOperationMetersList.mockClear();
      component['lazyLoadMeter']({ first: undefined, rows: undefined } as never);
      const query = sharingServiceSpy.getSharingOperationMetersList.mock.calls[0][2] as Omit<
        SharingOperationMetersQuery,
        'type'
      >;
      expect(query.page).toBeGreaterThanOrEqual(1);
    });
  });

  // ── pageChange ────────────────────────────────────────────────────
  describe('pageChange', () => {
    it('should update filter page and reload', () => {
      sharingServiceSpy.getSharingOperationMetersList.mockClear();
      component['pageChange']({ first: 10, rows: 10 } as never);
      const query = sharingServiceSpy.getSharingOperationMetersList.mock.calls[0][2] as Omit<
        SharingOperationMetersQuery,
        'type'
      >;
      expect(query.page).toBe(2);
    });
  });

  // ── clear ─────────────────────────────────────────────────────────
  describe('clear', () => {
    it('should reset all filters and reload', () => {
      component['searchText'].set('something');
      component['searchField'].set('city');
      component['statusFilter'].set(MeterDataStatus.ACTIVE);

      const clearFn = vi.fn();
      const tableMock = { clear: clearFn } as unknown as import('primeng/table').Table;
      sharingServiceSpy.getSharingOperationMetersList.mockClear();

      component.clear(tableMock);

      expect(clearFn).toHaveBeenCalled();
      expect(component['searchText']()).toBe('');
      expect(component['searchField']()).toBe('EAN');
      expect(component['statusFilter']()).toBeNull();
      expect(component['filter']()).toEqual({
        page: 1,
        limit: 10,
      });
      expect(sharingServiceSpy.getSharingOperationMetersList).toHaveBeenCalled();
    });
  });

  // ── openMeterChangeStatusPopup ────────────────────────────────────
  describe('openMeterChangeStatusPopup', () => {
    let event: Event;
    let stopPropagationFn: ReturnType<typeof vi.fn>;
    const meter = buildMeter();

    beforeEach(() => {
      stopPropagationFn = vi.fn();
      event = {
        stopPropagation: stopPropagationFn,
        target: document.createElement('button'),
      } as unknown as Event;
    });

    it('should stop event propagation', () => {
      component.openMeterChangeStatusPopup(event, meter, 1);
      expect(stopPropagationFn).toHaveBeenCalled();
    });

    it('should set starting text for action 1', () => {
      component.openMeterChangeStatusPopup(event, meter, 1);
      expect(component['textChangeStatusMeter']()).toBe(
        'SHARING_OPERATION.VIEW.METER.CHANGE_STATUS_METER_STARTING_LABEL',
      );
    });

    it('should set ending text for action 2', () => {
      component.openMeterChangeStatusPopup(event, meter, 2);
      expect(component['textChangeStatusMeter']()).toBe(
        'SHARING_OPERATION.VIEW.METER.CHANGE_STATUS_METER_ENDING_LABEL',
      );
    });

    it('should set waiting text for action 3', () => {
      component.openMeterChangeStatusPopup(event, meter, 3);
      expect(component['textChangeStatusMeter']()).toBe(
        'SHARING_OPERATION.VIEW.METER.CHANGE_STATUS_METER_WAITING_LABEL',
      );
    });

    it('should call confirmationService.confirm', () => {
      component.openMeterChangeStatusPopup(event, meter, 1);
      expect(confirmationServiceSpy.confirm).toHaveBeenCalled();
    });

    it('should call approveMeter on accept with action 1', () => {
      const spy = vi.spyOn(component, 'approveMeter');
      component.openMeterChangeStatusPopup(event, meter, 1);
      const confirmCall = confirmationServiceSpy.confirm.mock.calls[0][0] as {
        accept: () => void;
      };
      confirmCall.accept();
      expect(spy).toHaveBeenCalledWith(meter);
    });

    it('should call removeMeter on accept with action 2', () => {
      const spy = vi.spyOn(component, 'removeMeter');
      component.openMeterChangeStatusPopup(event, meter, 2);
      const confirmCall = confirmationServiceSpy.confirm.mock.calls[0][0] as {
        accept: () => void;
      };
      confirmCall.accept();
      expect(spy).toHaveBeenCalledWith(meter);
    });

    it('should call putMeterToWaiting on accept with action 3', () => {
      const spy = vi.spyOn(component, 'putMeterToWaiting');
      component.openMeterChangeStatusPopup(event, meter, 3);
      const confirmCall = confirmationServiceSpy.confirm.mock.calls[0][0] as {
        accept: () => void;
      };
      confirmCall.accept();
      expect(spy).toHaveBeenCalledWith(meter);
    });
  });

  // ── approveMeter ──────────────────────────────────────────────────
  describe('approveMeter', () => {
    const meter = buildMeter();

    it('should call patchMeterStatus with ACTIVE status', () => {
      component.approveMeter(meter);
      expect(sharingServiceSpy.patchMeterStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          id_meter: 'EAN001',
          id_sharing: 1,
          status: MeterDataStatus.ACTIVE,
        }),
      );
    });

    it('should reload meters on success', () => {
      sharingServiceSpy.getSharingOperationMetersList.mockClear();
      component.approveMeter(meter);
      expect(sharingServiceSpy.getSharingOperationMetersList).toHaveBeenCalled();
    });

    it('should reset dateStartMeter to null', () => {
      component['dateStartMeter'].set(new Date());
      component.approveMeter(meter);
      expect(component['dateStartMeter']()).toBeNull();
    });

    it('should use dateStartMeter value if set, serialized as YYYY-MM-DD local string', () => {
      const date = new Date(2026, 5, 15); // June 15 2026 local time
      component['dateStartMeter'].set(date);
      component.approveMeter(meter);
      expect(sharingServiceSpy.patchMeterStatus).toHaveBeenCalledWith(
        expect.objectContaining({ date: '2026-06-15' }),
      );
    });

    it('should call errorHandler on error', () => {
      const message = 'The meter cannot be activated before the end of its previous period';
      sharingServiceSpy.patchMeterStatus.mockReturnValue(
        throwError(
          () => new HttpErrorResponse({ status: 422, error: { data: message, error_code: 3021 } }),
        ),
      );
      component.approveMeter(meter);
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(message);
    });
  });

  // ── removeMeter ───────────────────────────────────────────────────
  describe('removeMeter', () => {
    const meter = buildMeter();

    it('should call patchMeterStatus with INACTIVE status', () => {
      component.removeMeter(meter);
      expect(sharingServiceSpy.patchMeterStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          id_meter: 'EAN001',
          id_sharing: 1,
          status: MeterDataStatus.INACTIVE,
        }),
      );
    });

    it('should reset dateStartMeter to null', () => {
      component['dateStartMeter'].set(new Date());
      component.removeMeter(meter);
      expect(component['dateStartMeter']()).toBeNull();
    });

    it('should call errorHandler on error', () => {
      const message = 'This meter is not active in the sharing operation';
      sharingServiceSpy.patchMeterStatus.mockReturnValue(
        throwError(
          () => new HttpErrorResponse({ status: 409, error: { data: message, error_code: 3022 } }),
        ),
      );
      component.removeMeter(meter);
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(message);
    });
  });

  // ── putMeterToWaiting ─────────────────────────────────────────────
  describe('putMeterToWaiting', () => {
    const meter = buildMeter();

    it('should call patchMeterStatus with WAITING_GRD status', () => {
      component.putMeterToWaiting(meter);
      expect(sharingServiceSpy.patchMeterStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          id_meter: 'EAN001',
          id_sharing: 1,
          status: MeterDataStatus.WAITING_GRD,
        }),
      );
    });

    it('should reset dateStartMeter to null', () => {
      component['dateStartMeter'].set(new Date());
      component.putMeterToWaiting(meter);
      expect(component['dateStartMeter']()).toBeNull();
    });

    it("shows the server's message when the meter cannot be set to waiting", () => {
      const message = 'This meter is already waiting for approval by the DSO';
      sharingServiceSpy.patchMeterStatus.mockReturnValue(
        throwError(
          () => new HttpErrorResponse({ status: 409, error: { data: message, error_code: 3023 } }),
        ),
      );
      component.putMeterToWaiting(meter);
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(message);
    });
  });

  // ── hardDeleteMeter ───────────────────────────────────────────────
  describe('hardDeleteMeter', () => {
    it("shows the server's message when the future meter cannot be deleted", () => {
      const message = 'Only a meter that has not started yet can be deleted';
      sharingServiceSpy.deleteMeterFromSharingOperation.mockReturnValue(
        throwError(
          () => new HttpErrorResponse({ status: 409, error: { data: message, error_code: 3024 } }),
        ),
      );
      const event = {
        stopPropagation: vi.fn(),
        target: document.createElement('button'),
      } as unknown as Event;

      component.hardDeleteMeter(event, buildMeter());
      const confirmCall = confirmationServiceSpy.confirm.mock.calls[0][0] as {
        accept: () => void;
      };
      confirmCall.accept();

      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(message);
    });
  });

  // ── onRowClick ────────────────────────────────────────────────────
  describe('onRowClick', () => {
    it('should navigate to /meters/{EAN}', () => {
      component.onRowClick(buildMeter());
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/meters/EAN001']);
    });
  });

  // ── Computed signals ──────────────────────────────────────────────
  describe('computed signals', () => {
    describe('hasActiveFilters', () => {
      it('should be false when no filters are set', () => {
        component['searchText'].set('');
        component['statusFilter'].set(null);
        expect(component.hasActiveFilters()).toBe(false);
      });

      it('should be true when searchText is set', () => {
        component['searchText'].set('test');
        expect(component.hasActiveFilters()).toBe(true);
      });

      it('should be true when statusFilter is set', () => {
        component['statusFilter'].set(MeterDataStatus.ACTIVE);
        expect(component.hasActiveFilters()).toBe(true);
      });
    });

    describe('firstRow', () => {
      it('should compute (page - 1) * limit', () => {
        component['pagination'].set(buildPagination({ page: 3, limit: 10 }));
        expect(component.firstRow()).toBe(20);
      });
    });

    describe('showPaginator', () => {
      it('should be true when total_pages > 1', () => {
        component['pagination'].set(buildPagination({ total_pages: 2 }));
        expect(component.showPaginator()).toBe(true);
      });

      it('should be false when total_pages is 1', () => {
        component['pagination'].set(buildPagination({ total_pages: 1 }));
        expect(component.showPaginator()).toBe(false);
      });
    });
  });

  // ── Translated select labels ──────────────────────────────────────

  // PrimeNG copies an option's label into the select's aria-label, so a key
  // there is what a screen reader announces.
  describe('select labels', () => {
    let translate: TranslateService;

    function ariaLabelOf(testId: string): string | null {
      return (
        (fixture.nativeElement as HTMLElement)
          .querySelector(`[data-testid="${testId}"] [role="combobox"]`)
          ?.getAttribute('aria-label') ?? null
      );
    }

    beforeEach(async () => {
      translate = TestBed.inject(TranslateService);
      // The suite echoes keys through a mocked `instant`; these need the real one.
      vi.restoreAllMocks();
      translate.setTranslation('fr', {
        SHARING_OPERATION: {
          VIEW: {
            ADDRESS: { STREET_NAME_LABEL: 'Rue', CITY_LABEL: 'Ville' },
            METER: {
              INFORMATIONS: { EAN_LABEL: 'EAN', METER_NUMBER_LABEL: 'Numéro de compteur' },
              STATUS: {
                ACTIVATED_LABEL: 'Activé',
                DEACTIVATED_LABEL: 'Désactivé',
                WAITING_FOR_GRD_ACCEPTANCE_LABEL: 'En attente du GRD',
                WAITING_FOR_MANAGER_ACCEPTANCE_LABEL: 'En attente du gestionnaire',
              },
            },
          },
        },
      });
      translate.setTranslation('en', {
        SHARING_OPERATION: {
          VIEW: {
            ADDRESS: { STREET_NAME_LABEL: 'Street', CITY_LABEL: 'City' },
            METER: {
              INFORMATIONS: { EAN_LABEL: 'EAN code', METER_NUMBER_LABEL: 'Meter number' },
              STATUS: {
                ACTIVATED_LABEL: 'Activated',
                DEACTIVATED_LABEL: 'Deactivated',
                WAITING_FOR_GRD_ACCEPTANCE_LABEL: 'Waiting for the DSO',
                WAITING_FOR_MANAGER_ACCEPTANCE_LABEL: 'Waiting for the manager',
              },
            },
          },
        },
      });
      translate.use('fr');
      await fixture.whenStable();
    });

    it('should label the search-field options with their translation, keeping the values', () => {
      expect(component.searchFieldOptions()).toEqual([
        { label: 'EAN', value: 'EAN' },
        { label: 'Numéro de compteur', value: 'meter_number' },
        { label: 'Rue', value: 'street' },
        { label: 'Ville', value: 'city' },
      ]);
    });

    it('should label the status options with their translation, keeping values and severities', () => {
      expect(component.statusOptions()).toEqual([
        { label: 'Activé', value: MeterDataStatus.ACTIVE, severity: 'success' },
        { label: 'Désactivé', value: MeterDataStatus.INACTIVE, severity: 'danger' },
        { label: 'En attente du GRD', value: MeterDataStatus.WAITING_GRD, severity: 'warn' },
        {
          label: 'En attente du gestionnaire',
          value: MeterDataStatus.WAITING_MANAGER,
          severity: 'warn',
        },
      ]);
    });

    it('should give every selected option a translated aria-label, not the i18n key', async () => {
      component.searchField.set('city');
      component.statusFilter.set(MeterDataStatus.INACTIVE);
      await fixture.whenStable();

      expect(ariaLabelOf('op-meters-list__select--search-field')).toBe('Ville');
      expect(ariaLabelOf('op-meters-list__select--status')).toBe('Désactivé');
    });

    it('should translate the aria-labels again when the language changes', async () => {
      component.statusFilter.set(MeterDataStatus.ACTIVE);
      await fixture.whenStable();

      translate.use('en');
      await fixture.whenStable();

      expect(ariaLabelOf('op-meters-list__select--search-field')).toBe('EAN code');
      expect(ariaLabelOf('op-meters-list__select--status')).toBe('Activated');
    });
  });
});
