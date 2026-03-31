import { NO_ERRORS_SCHEMA } from '@angular/core';
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
    number: 42,
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
  };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };
  let confirmationServiceSpy: { confirm: ReturnType<typeof vi.fn> };
  let meterAddedSubject: Subject<void>;

  beforeEach(async () => {
    sharingServiceSpy = {
      getSharingOperationMetersList: vi.fn().mockReturnValue(of(buildPaginatedResponse())),
      patchMeterStatus: vi.fn().mockReturnValue(of(new ApiResponse('OK'))),
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
    it('should set filter type from input', () => {
      expect(component['filter']().type).toBe(SharingOperationMetersQueryType.NOW);
    });

    it('should load meters on init', () => {
      expect(sharingServiceSpy.getSharingOperationMetersList).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ page: 1, limit: 10, type: SharingOperationMetersQueryType.NOW }),
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
      sharingServiceSpy.getSharingOperationMetersList.mockReturnValue(
        throwError(() => ({ data: 'server error' })),
      );
      meterAddedSubject.next();
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith('server error');
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
        expect.objectContaining({ EAN: 'EAN123', page: 1 }),
      );
    });

    it('should add meter_number filter', () => {
      component['searchField'].set('meter_number');
      component['searchText'].set('MTR-X');
      component.applyFilters();
      expect(sharingServiceSpy.getSharingOperationMetersList).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ meter_number: 'MTR-X' }),
      );
    });

    it('should add street filter', () => {
      component['searchField'].set('street');
      component['searchText'].set('Rue');
      component.applyFilters();
      expect(sharingServiceSpy.getSharingOperationMetersList).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ street: 'Rue' }),
      );
    });

    it('should add city filter', () => {
      component['searchField'].set('city');
      component['searchText'].set('Liège');
      component.applyFilters();
      expect(sharingServiceSpy.getSharingOperationMetersList).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ city: 'Liège' }),
      );
    });

    it('should add status filter when statusFilter is set', () => {
      component['statusFilter'].set(MeterDataStatus.ACTIVE);
      component.applyFilters();
      expect(sharingServiceSpy.getSharingOperationMetersList).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ status: MeterDataStatus.ACTIVE }),
      );
    });

    it('should not include search params when searchText is empty', () => {
      component['searchText'].set('');
      component.applyFilters();
      const query = sharingServiceSpy.getSharingOperationMetersList.mock
        .calls[0][1] as SharingOperationMetersQuery;
      expect(query.EAN).toBeUndefined();
      expect(query.meter_number).toBeUndefined();
      expect(query.street).toBeUndefined();
      expect(query.city).toBeUndefined();
    });

    it('should reset page to 1', () => {
      component['filter'].set({
        page: 5,
        limit: 10,
        type: SharingOperationMetersQueryType.NOW,
      });
      component.applyFilters();
      const query = sharingServiceSpy.getSharingOperationMetersList.mock
        .calls[0][1] as SharingOperationMetersQuery;
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
      const query = sharingServiceSpy.getSharingOperationMetersList.mock
        .calls[0][1] as SharingOperationMetersQuery;
      expect(query.page).toBe(3);
    });

    it('should default page to 1 when rows is 0', () => {
      sharingServiceSpy.getSharingOperationMetersList.mockClear();
      component['lazyLoadMeter']({ first: 0, rows: 0 } as never);
      const query = sharingServiceSpy.getSharingOperationMetersList.mock
        .calls[0][1] as SharingOperationMetersQuery;
      expect(query.page).toBe(1);
    });

    it('should clamp page to at least 1', () => {
      sharingServiceSpy.getSharingOperationMetersList.mockClear();
      component['lazyLoadMeter']({ first: undefined, rows: undefined } as never);
      const query = sharingServiceSpy.getSharingOperationMetersList.mock
        .calls[0][1] as SharingOperationMetersQuery;
      expect(query.page).toBeGreaterThanOrEqual(1);
    });
  });

  // ── pageChange ────────────────────────────────────────────────────
  describe('pageChange', () => {
    it('should update filter page and reload', () => {
      sharingServiceSpy.getSharingOperationMetersList.mockClear();
      component['pageChange']({ first: 10, rows: 10 } as never);
      const query = sharingServiceSpy.getSharingOperationMetersList.mock
        .calls[0][1] as SharingOperationMetersQuery;
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
        type: SharingOperationMetersQueryType.NOW,
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

    it('should use dateStartMeter value if set', () => {
      const date = new Date('2026-06-15');
      component['dateStartMeter'].set(date);
      component.approveMeter(meter);
      expect(sharingServiceSpy.patchMeterStatus).toHaveBeenCalledWith(
        expect.objectContaining({ date }),
      );
    });

    it('should call errorHandler on error', () => {
      sharingServiceSpy.patchMeterStatus.mockReturnValue(
        throwError(() => ({ data: 'patch error' })),
      );
      component.approveMeter(meter);
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith('patch error');
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
      sharingServiceSpy.patchMeterStatus.mockReturnValue(
        throwError(() => ({ data: 'remove error' })),
      );
      component.removeMeter(meter);
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith('remove error');
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
});
