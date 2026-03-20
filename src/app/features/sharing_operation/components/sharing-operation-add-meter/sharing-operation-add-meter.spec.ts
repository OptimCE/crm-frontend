import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { SharingOperationAddMeter } from './sharing-operation-add-meter';
import { SharingOperationService } from '../../../../shared/services/sharing_operation.service';
import { MeterService } from '../../../../shared/services/meter.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { ApiResponse, ApiResponsePaginated, Pagination } from '../../../../core/dtos/api.response';
import { PartialMeterDTO } from '../../../../shared/dtos/meter.dtos';
import { MeterDataStatus } from '../../../../shared/types/meter.types';
import { AddressDTO } from '../../../../shared/dtos/address.dtos';

// ── Helpers ────────────────────────────────────────────────────

function buildAddress(overrides: Partial<AddressDTO> = {}): AddressDTO {
  return {
    id: 1,
    street: 'Rue de la Loi',
    number: 16,
    postcode: '1000',
    city: 'Brussels',
    ...overrides,
  };
}

function buildPartialMeter(overrides: Partial<PartialMeterDTO> = {}): PartialMeterDTO {
  return {
    EAN: '541449000000000001',
    meter_number: 'M001',
    address: buildAddress(),
    status: MeterDataStatus.ACTIVE,
    ...overrides,
  };
}

function buildPaginatedResponse(
  data: PartialMeterDTO[] = [],
  pagination: Pagination = new Pagination(1, 10, 0, 1),
): ApiResponsePaginated<PartialMeterDTO[] | string> {
  return new ApiResponsePaginated<PartialMeterDTO[] | string>(data, pagination);
}

// ── Test Suite ─────────────────────────────────────────────────

describe('SharingOperationAddMeter', () => {
  let component: SharingOperationAddMeter;
  let fixture: ComponentFixture<SharingOperationAddMeter>;

  let dialogConfigMock: { data: { id: number } };
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };
  let sharingOperationServiceSpy: { addMeterToSharing: ReturnType<typeof vi.fn> };
  let meterServiceSpy: { getMetersList: ReturnType<typeof vi.fn> };

  async function createComponent(): Promise<void> {
    fixture = TestBed.createComponent(SharingOperationAddMeter);
    component = fixture.componentInstance;
    component.ngOnInit();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    dialogConfigMock = { data: { id: 42 } };
    dialogRefSpy = { close: vi.fn() };
    sharingOperationServiceSpy = {
      addMeterToSharing: vi.fn().mockReturnValue(of(new ApiResponse('OK'))),
    };
    meterServiceSpy = {
      getMetersList: vi.fn().mockReturnValue(of(buildPaginatedResponse())),
    };

    await TestBed.configureTestingModule({
      imports: [SharingOperationAddMeter, TranslateModule.forRoot()],
      providers: [
        { provide: DynamicDialogConfig, useValue: dialogConfigMock },
        { provide: DynamicDialogRef, useValue: dialogRefSpy },
        { provide: SharingOperationService, useValue: sharingOperationServiceSpy },
        { provide: MeterService, useValue: meterServiceSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(SharingOperationAddMeter, {
        remove: { providers: [ErrorMessageHandler] },
        add: { providers: [{ provide: ErrorMessageHandler, useValue: {} }] },
      })
      .compileComponents();

    vi.spyOn(TestBed.inject(TranslateService), 'get').mockImplementation(
      (key: string | string[]) => {
        if (Array.isArray(key)) {
          const result = key.reduce<Record<string, string>>((acc, k) => ({ ...acc, [k]: k }), {});
          return of(result);
        }
        return of(key);
      },
    );
  });

  // ── 1. Creation & Init ──────────────────────────────────────────

  describe('creation & init', () => {
    it('should create the component', async () => {
      await createComponent();
      expect(component).toBeTruthy();
    });

    it('should read id from dialog config data', async () => {
      await createComponent();
      expect(component.id).toBe(42);
    });

    it('should set statutCategory on init via setupStatusCategory', async () => {
      await createComponent();
      const categories = component.statutCategory();
      expect(categories).toHaveLength(4);
      expect(categories[0].value).toBe(MeterDataStatus.ACTIVE);
      expect(categories[1].value).toBe(MeterDataStatus.INACTIVE);
      expect(categories[2].value).toBe(MeterDataStatus.WAITING_GRD);
      expect(categories[3].value).toBe(MeterDataStatus.WAITING_MANAGER);
    });

    it('should initialize minDate to today', async () => {
      await createComponent();
      const minDate = component.minDate();
      const today = new Date();
      expect(minDate.getFullYear()).toBe(today.getFullYear());
      expect(minDate.getMonth()).toBe(today.getMonth());
      expect(minDate.getDate()).toBe(today.getDate());
    });

    it('should initialize selectedMeters as empty', async () => {
      await createComponent();
      expect(component.selectedMeters()).toEqual([]);
    });

    it('should initialize dateSelected as null', async () => {
      await createComponent();
      expect(component.dateSelected()).toBeNull();
    });
  });

  // ── 2. updateAddressFilter ──────────────────────────────────────

  describe('updateAddressFilter', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should update streetName field', () => {
      component.updateAddressFilter('streetName', 'Rue Neuve');
      expect(component.addressFilter().streetName).toBe('Rue Neuve');
      expect(component.addressFilter().postcode).toBe('');
      expect(component.addressFilter().cityName).toBe('');
    });

    it('should update postcode field', () => {
      component.updateAddressFilter('postcode', '1050');
      expect(component.addressFilter().postcode).toBe('1050');
      expect(component.addressFilter().streetName).toBe('');
    });

    it('should update cityName field', () => {
      component.updateAddressFilter('cityName', 'Liège');
      expect(component.addressFilter().cityName).toBe('Liège');
      expect(component.addressFilter().streetName).toBe('');
    });
  });

  // ── 3. loadMeters ──────────────────────────────────────────────

  describe('loadMeters', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should call getMetersList with default params', () => {
      component.loadMeters();
      expect(meterServiceSpy.getMetersList).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          limit: 10,
          not_sharing_operation_id: 42,
        }),
      );
    });

    it('should include street filter when streetName is set', () => {
      component.updateAddressFilter('streetName', 'Rue Neuve');
      component.loadMeters();
      expect(meterServiceSpy.getMetersList).toHaveBeenCalledWith(
        expect.objectContaining({ street: 'Rue Neuve' }),
      );
    });

    it('should include postcode filter when postcode is set', () => {
      component.updateAddressFilter('postcode', '1050');
      component.loadMeters();
      expect(meterServiceSpy.getMetersList).toHaveBeenCalledWith(
        expect.objectContaining({ postcode: 1050 }),
      );
    });

    it('should include city filter when cityName is set', () => {
      component.updateAddressFilter('cityName', 'Liège');
      component.loadMeters();
      expect(meterServiceSpy.getMetersList).toHaveBeenCalledWith(
        expect.objectContaining({ city: 'Liège' }),
      );
    });

    it('should include status filter from table filters', () => {
      component.loadMeters({
        statut: { value: MeterDataStatus.ACTIVE, matchMode: 'equals' },
      });
      expect(meterServiceSpy.getMetersList).toHaveBeenCalledWith(
        expect.objectContaining({ status: MeterDataStatus.ACTIVE }),
      );
    });

    it('should include EAN filter from table filters', () => {
      component.loadMeters({
        EAN: { value: '541449000000000001', matchMode: 'contains' },
      });
      expect(meterServiceSpy.getMetersList).toHaveBeenCalledWith(
        expect.objectContaining({ EAN: '541449000000000001' }),
      );
    });

    it('should include meter_number filter from table filters', () => {
      component.loadMeters({
        meter_number: { value: 'M001', matchMode: 'contains' },
      });
      expect(meterServiceSpy.getMetersList).toHaveBeenCalledWith(
        expect.objectContaining({ meter_number: 'M001' }),
      );
    });

    it('should ignore filters with null or empty values', () => {
      component.loadMeters({
        EAN: { value: null, matchMode: 'contains' },
        meter_number: { value: '', matchMode: 'contains' },
      });
      const callArgs = meterServiceSpy.getMetersList.mock.calls[0][0] as Record<string, unknown>;
      expect(callArgs['EAN']).toBeUndefined();
      expect(callArgs['meter_number']).toBeUndefined();
    });

    it('should handle array filter metadata', () => {
      component.loadMeters({
        EAN: [{ value: '541449000000000001', matchMode: 'contains' }],
      });
      expect(meterServiceSpy.getMetersList).toHaveBeenCalledWith(
        expect.objectContaining({ EAN: '541449000000000001' }),
      );
    });

    it('should set metersPartialList and paginationMetersInfo on success', () => {
      const meters = [buildPartialMeter(), buildPartialMeter({ EAN: '541449000000000002' })];
      const pagination = new Pagination(1, 10, 2, 1);
      meterServiceSpy.getMetersList.mockReturnValue(of(buildPaginatedResponse(meters, pagination)));
      component.loadMeters();
      expect(component.metersPartialList()).toEqual(meters);
      expect(component.paginationMetersInfo()).toEqual(pagination);
    });

    it('should log error on null response', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());
      meterServiceSpy.getMetersList.mockReturnValue(of(null));
      component.loadMeters();
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching meters partial list');
      consoleSpy.mockRestore();
    });

    it('should log error on HTTP error', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());
      meterServiceSpy.getMetersList.mockReturnValue(throwError(() => new Error('Network error')));
      component.loadMeters();
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching meters partial list');
      consoleSpy.mockRestore();
    });
  });

  // ── 4. lazyLoadMeters ──────────────────────────────────────────

  describe('lazyLoadMeters', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should compute page from event.first and event.rows and call loadMeters', () => {
      const loadMetersSpy = vi.spyOn(component, 'loadMeters');
      component.lazyLoadMeters({ first: 20, rows: 10, filters: {} });
      expect(loadMetersSpy).toHaveBeenCalledWith({}, 3);
    });

    it('should default to page 1 when first and rows are missing', () => {
      const loadMetersSpy = vi.spyOn(component, 'loadMeters');
      component.lazyLoadMeters({
        first: 0,
        rows: 0,
        filters: { EAN: { value: 'test', matchMode: 'contains' } },
      });
      expect(loadMetersSpy).toHaveBeenCalledWith(
        { EAN: { value: 'test', matchMode: 'contains' } },
        1,
      );
    });
  });

  // ── 5. clear ───────────────────────────────────────────────────

  describe('clear', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should call table.clear() and reset address filter', () => {
      component.updateAddressFilter('streetName', 'Rue Neuve');
      component.updateAddressFilter('postcode', '1050');
      component.updateAddressFilter('cityName', 'Brussels');

      const tableMock = { clear: vi.fn() } as never;
      component.clear(tableMock);

      expect((tableMock as { clear: ReturnType<typeof vi.fn> }).clear).toHaveBeenCalled();
      expect(component.addressFilter()).toEqual({
        streetName: '',
        postcode: '',
        cityName: '',
      });
    });
  });

  // ── 6. pageChange ──────────────────────────────────────────────

  describe('pageChange', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should compute page and call loadMeters', () => {
      const loadMetersSpy = vi.spyOn(component, 'loadMeters');
      component.pageChange({ first: 10, rows: 10 });
      expect(loadMetersSpy).toHaveBeenCalledWith(undefined, 2);
    });

    it('should compute page 1 for first page', () => {
      const loadMetersSpy = vi.spyOn(component, 'loadMeters');
      component.pageChange({ first: 0, rows: 10 });
      expect(loadMetersSpy).toHaveBeenCalledWith(undefined, 1);
    });
  });

  // ── 7. onValidate ─────────────────────────────────────────────

  describe('onValidate', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should return early when dateSelected is null', () => {
      component.selectedMeters.set([buildPartialMeter()]);
      component.dateSelected.set(null);
      component.onValidate();
      expect(sharingOperationServiceSpy.addMeterToSharing).not.toHaveBeenCalled();
    });

    it('should return early when selectedMeters is empty', () => {
      component.dateSelected.set(new Date(2026, 5, 1));
      component.selectedMeters.set([]);
      component.onValidate();
      expect(sharingOperationServiceSpy.addMeterToSharing).not.toHaveBeenCalled();
    });

    it('should call addMeterToSharing with correct DTO when valid', () => {
      const date = new Date(2026, 5, 1);
      const meter1 = buildPartialMeter({ EAN: 'EAN001' });
      const meter2 = buildPartialMeter({ EAN: 'EAN002' });
      component.dateSelected.set(date);
      component.selectedMeters.set([meter1, meter2]);

      component.onValidate();

      expect(sharingOperationServiceSpy.addMeterToSharing).toHaveBeenCalledWith({
        date: date,
        ean_list: ['EAN001', 'EAN002'],
        id_sharing: 42,
      });
    });

    it('should close dialog with true on success', () => {
      component.dateSelected.set(new Date(2026, 5, 1));
      component.selectedMeters.set([buildPartialMeter()]);
      sharingOperationServiceSpy.addMeterToSharing.mockReturnValue(of(new ApiResponse('OK')));

      component.onValidate();

      expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
    });

    it('should close dialog with false on null response', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());
      component.dateSelected.set(new Date(2026, 5, 1));
      component.selectedMeters.set([buildPartialMeter()]);
      sharingOperationServiceSpy.addMeterToSharing.mockReturnValue(of(null));

      component.onValidate();

      expect(dialogRefSpy.close).toHaveBeenCalledWith(false);
      consoleSpy.mockRestore();
    });
  });

  // ── 8. Computed signals ────────────────────────────────────────

  describe('computed signals', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('firstRow should compute (page - 1) * limit', () => {
      component.paginationMetersInfo.set(new Pagination(3, 10, 50, 5));
      expect(component.firstRow()).toBe(20);
    });

    it('firstRow should be 0 for page 1', () => {
      component.paginationMetersInfo.set(new Pagination(1, 10, 50, 5));
      expect(component.firstRow()).toBe(0);
    });

    it('showPaginator should be true when total_pages > 1', () => {
      component.paginationMetersInfo.set(new Pagination(1, 10, 25, 3));
      expect(component.showPaginator()).toBe(true);
    });

    it('showPaginator should be false when total_pages is 1', () => {
      component.paginationMetersInfo.set(new Pagination(1, 10, 5, 1));
      expect(component.showPaginator()).toBe(false);
    });
  });
});
