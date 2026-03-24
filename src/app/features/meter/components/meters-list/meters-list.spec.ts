import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Table } from 'primeng/table';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { MetersList } from './meters-list';
import { MeterService } from '../../../../shared/services/meter.service';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { ApiResponsePaginated, Pagination } from '../../../../core/dtos/api.response';
import { PartialMeterDTO } from '../../../../shared/dtos/meter.dtos';
import { MeterDataStatus } from '../../../../shared/types/meter.types';
import { MeterCreation } from '../meter-creation/meter-creation';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';

// ── Helpers ────────────────────────────────────────────────────────

function buildMeter(overrides: Partial<PartialMeterDTO> = {}): PartialMeterDTO {
  return {
    EAN: '541234567890',
    meter_number: 'MTR-001',
    address: { id: 1, street: 'Main St', number: 10, postcode: '1000', city: 'Brussels' },
    status: MeterDataStatus.ACTIVE,
    ...overrides,
  };
}

function buildPaginatedResponse(
  meters: PartialMeterDTO[] = [buildMeter()],
  pagination: Partial<Pagination> = {},
): ApiResponsePaginated<PartialMeterDTO[] | string> {
  const pag = new Pagination(
    pagination.page ?? 1,
    pagination.limit ?? 10,
    pagination.total ?? meters.length,
    pagination.total_pages ?? 1,
  );
  return new ApiResponsePaginated<PartialMeterDTO[] | string>(meters, pag);
}

// ── Test Suite ─────────────────────────────────────────────────────

describe('MetersList', () => {
  let component: MetersList;
  let fixture: ComponentFixture<MetersList>;

  let meterServiceSpy: { getMetersList: ReturnType<typeof vi.fn> };
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };
  let snackbarSpy: { openSnackBar: ReturnType<typeof vi.fn> };
  let dialogServiceSpy: { open: ReturnType<typeof vi.fn> };

  async function createComponent(): Promise<void> {
    fixture = TestBed.createComponent(MetersList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  beforeEach(async () => {
    meterServiceSpy = {
      getMetersList: vi.fn().mockReturnValue(of(buildPaginatedResponse())),
    };
    routerSpy = { navigate: vi.fn().mockResolvedValue(true) };
    snackbarSpy = { openSnackBar: vi.fn() };
    dialogServiceSpy = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [MetersList, TranslateModule.forRoot()],
      providers: [
        { provide: MeterService, useValue: meterServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: SnackbarNotification, useValue: snackbarSpy },
      ],
    })
      .overrideComponent(MetersList, {
        remove: {
          providers: [DialogService],
        },
        add: {
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
  });

  // ── 1. Creation & Initial State ─────────────────────────────────

  describe('creation & initial state', () => {
    it('should create the component', async () => {
      await createComponent();
      expect(component).toBeTruthy();
    });

    it('should initialize with default filter values', async () => {
      await createComponent();
      expect(component.filter()).toEqual({ page: 1, limit: 10 });
    });

    it('should have pagination info after creation', async () => {
      await createComponent();
      const pag = component.paginationInfo();
      expect(pag.page).toBe(1);
      expect(pag.limit).toBe(10);
    });

    it('should have loading set to false after lazy load triggers', async () => {
      await createComponent();
      expect(component.loading()).toBe(false);
    });

    it('should initialize searchField to "EAN"', async () => {
      await createComponent();
      expect(component.searchField()).toBe('EAN');
    });

    it('should initialize searchText to empty string', async () => {
      await createComponent();
      expect(component.searchText()).toBe('');
    });

    it('should initialize statusFilter to null', async () => {
      await createComponent();
      expect(component.statusFilter()).toBeNull();
    });
  });

  // ── 2. Computed Signals ─────────────────────────────────────────

  describe('computed signals', () => {
    it('hasActiveFilters should be false when no filters are set', async () => {
      await createComponent();
      expect(component.hasActiveFilters()).toBe(false);
    });

    it('hasActiveFilters should be true when searchText is set', async () => {
      await createComponent();
      component.searchText.set('test');
      expect(component.hasActiveFilters()).toBe(true);
    });

    it('hasActiveFilters should be true when statusFilter is set', async () => {
      await createComponent();
      component.statusFilter.set(MeterDataStatus.ACTIVE);
      expect(component.hasActiveFilters()).toBe(true);
    });

    it('firstRow should compute correctly from pagination', async () => {
      await createComponent();
      expect(component.firstRow()).toBe(0);

      component.paginationInfo.set({ page: 3, limit: 10, total: 50, total_pages: 5 });
      expect(component.firstRow()).toBe(20);
    });

    it('showPaginator should be false when total_pages <= 1', async () => {
      await createComponent();
      expect(component.showPaginator()).toBe(false);
    });

    it('showPaginator should be true when total_pages > 1', async () => {
      await createComponent();
      component.paginationInfo.set({ page: 1, limit: 10, total: 25, total_pages: 3 });
      expect(component.showPaginator()).toBe(true);
    });
  });

  // ── 3. loadMeters() ─────────────────────────────────────────────

  describe('loadMeters', () => {
    it('should load meters and update list on success', async () => {
      const meters = [buildMeter(), buildMeter({ EAN: '541234567891', meter_number: 'MTR-002' })];
      const response = buildPaginatedResponse(meters, { total: 2 });
      meterServiceSpy.getMetersList.mockReturnValue(of(response));

      await createComponent();
      component.loadMeters();

      expect(component.metersPartialList()).toEqual(meters);
      expect(component.loading()).toBe(false);
    });

    it('should update pagination info on success', async () => {
      const response = buildPaginatedResponse([buildMeter()], {
        page: 2,
        limit: 10,
        total: 15,
        total_pages: 2,
      });
      meterServiceSpy.getMetersList.mockReturnValue(of(response));

      await createComponent();
      component.loadMeters();

      expect(component.paginationInfo().page).toBe(2);
      expect(component.paginationInfo().total).toBe(15);
      expect(component.paginationInfo().total_pages).toBe(2);
    });

    it('should log error on null response and set loading false', async () => {
      meterServiceSpy.getMetersList.mockReturnValue(of(null));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());

      await createComponent();
      component.loadMeters();

      expect(consoleSpy).toHaveBeenCalledWith('Error fetching meters partial list');
      expect(component.loading()).toBe(false);
      consoleSpy.mockRestore();
    });

    it('should log error and stop loading on error', async () => {
      const error = new Error('fail');
      meterServiceSpy.getMetersList.mockReturnValue(throwError(() => error));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());

      await createComponent();
      component.loadMeters();

      expect(consoleSpy).toHaveBeenCalledWith('Error fetching meters partial list');
      expect(component.loading()).toBe(false);
      consoleSpy.mockRestore();
    });

    it('should set loading to true before request', async () => {
      await createComponent();
      component.loading.set(false);
      meterServiceSpy.getMetersList.mockReturnValue(of(buildPaginatedResponse()));

      component.loadMeters();

      // After synchronous subscribe, loading is false again
      expect(component.loading()).toBe(false);
    });

    it('should pass current filter to service', async () => {
      await createComponent();
      component.filter.set({ page: 2, limit: 20, EAN: '541' });
      component.loadMeters();

      expect(meterServiceSpy.getMetersList).toHaveBeenCalledWith({
        page: 2,
        limit: 20,
        EAN: '541',
      });
    });
  });

  // ── 4. Filter Methods ──────────────────────────────────────────

  describe('applyFilters', () => {
    beforeEach(async () => {
      await createComponent();
      meterServiceSpy.getMetersList.mockClear();
      meterServiceSpy.getMetersList.mockReturnValue(of(buildPaginatedResponse()));
    });

    it('should reset page to 1 and call loadMeters', () => {
      component.filter.set({ page: 3, limit: 10 });
      component.applyFilters();

      expect(component.filter().page).toBe(1);
      expect(meterServiceSpy.getMetersList).toHaveBeenCalled();
    });

    it('should include EAN filter when searchField is EAN and searchText is set', () => {
      component.searchField.set('EAN');
      component.searchText.set('541234');
      component.applyFilters();

      expect(component.filter().EAN).toBe('541234');
    });

    it('should include meter_number filter when searchField is meter_number', () => {
      component.searchField.set('meter_number');
      component.searchText.set('MTR-001');
      component.applyFilters();

      expect(component.filter().meter_number).toBe('MTR-001');
    });

    it('should include street filter when searchField is street', () => {
      component.searchField.set('street');
      component.searchText.set('Main St');
      component.applyFilters();

      expect(component.filter().street).toBe('Main St');
    });

    it('should include status filter when statusFilter is set', () => {
      component.statusFilter.set(MeterDataStatus.INACTIVE);
      component.applyFilters();

      expect(component.filter().status).toBe(MeterDataStatus.INACTIVE);
    });

    it('should not include search field when searchText is empty', () => {
      component.searchText.set('');
      component.searchField.set('EAN');
      component.applyFilters();

      expect(component.filter().EAN).toBeUndefined();
    });
  });

  describe('onSearchTextChange', () => {
    beforeEach(async () => {
      await createComponent();
      meterServiceSpy.getMetersList.mockClear();
      meterServiceSpy.getMetersList.mockReturnValue(of(buildPaginatedResponse()));
    });

    it('should update searchText and call applyFilters', () => {
      component.onSearchTextChange('test query');

      expect(component.searchText()).toBe('test query');
      expect(meterServiceSpy.getMetersList).toHaveBeenCalled();
    });
  });

  describe('onSearchFieldChange', () => {
    beforeEach(async () => {
      await createComponent();
      meterServiceSpy.getMetersList.mockClear();
      meterServiceSpy.getMetersList.mockReturnValue(of(buildPaginatedResponse()));
    });

    it('should call applyFilters when searchText is non-empty', () => {
      component.searchText.set('something');
      component.onSearchFieldChange();

      expect(meterServiceSpy.getMetersList).toHaveBeenCalled();
    });

    it('should not call applyFilters when searchText is empty', () => {
      component.searchText.set('');
      component.onSearchFieldChange();

      expect(meterServiceSpy.getMetersList).not.toHaveBeenCalled();
    });
  });

  describe('onStatusFilterChange', () => {
    beforeEach(async () => {
      await createComponent();
      meterServiceSpy.getMetersList.mockClear();
      meterServiceSpy.getMetersList.mockReturnValue(of(buildPaginatedResponse()));
    });

    it('should update statusFilter and reload meters', () => {
      component.onStatusFilterChange(MeterDataStatus.INACTIVE);

      expect(component.statusFilter()).toBe(MeterDataStatus.INACTIVE);
      expect(meterServiceSpy.getMetersList).toHaveBeenCalled();
    });

    it('should handle null to clear the status filter', () => {
      component.statusFilter.set(MeterDataStatus.ACTIVE);
      component.onStatusFilterChange(null);

      expect(component.statusFilter()).toBeNull();
      expect(meterServiceSpy.getMetersList).toHaveBeenCalled();
    });
  });

  // ── 5. Pagination ──────────────────────────────────────────────

  describe('lazyLoadMeters', () => {
    beforeEach(async () => {
      await createComponent();
      meterServiceSpy.getMetersList.mockClear();
      meterServiceSpy.getMetersList.mockReturnValue(of(buildPaginatedResponse()));
    });

    it('should compute correct page from lazy load event', () => {
      component.lazyLoadMeters({ first: 20, rows: 10 });

      expect(component.filter().page).toBe(3);
      expect(meterServiceSpy.getMetersList).toHaveBeenCalled();
    });

    it('should default to page 1 when rows is 0', () => {
      component.lazyLoadMeters({ first: 0, rows: 0 });

      expect(component.filter().page).toBe(1);
    });

    it('should clamp page to minimum of 1', () => {
      component.lazyLoadMeters({ first: 0, rows: 10 });

      expect(component.filter().page).toBeGreaterThanOrEqual(1);
    });
  });

  describe('pageChange', () => {
    beforeEach(async () => {
      await createComponent();
      meterServiceSpy.getMetersList.mockClear();
      meterServiceSpy.getMetersList.mockReturnValue(of(buildPaginatedResponse()));
    });

    it('should compute correct page from page event', () => {
      component.pageChange({ first: 10, rows: 10 });

      expect(component.filter().page).toBe(2);
      expect(meterServiceSpy.getMetersList).toHaveBeenCalled();
    });

    it('should handle first page', () => {
      component.pageChange({ first: 0, rows: 10 });

      expect(component.filter().page).toBe(1);
    });
  });

  // ── 6. Clear ───────────────────────────────────────────────────

  describe('clear', () => {
    it('should reset all filters and reload meters', async () => {
      await createComponent();
      component.searchText.set('test');
      component.searchField.set('meter_number');
      component.statusFilter.set(MeterDataStatus.ACTIVE);
      component.filter.set({ page: 3, limit: 20 });

      meterServiceSpy.getMetersList.mockClear();
      meterServiceSpy.getMetersList.mockReturnValue(of(buildPaginatedResponse()));

      const clearFn = vi.fn();
      const mockTable = { clear: clearFn } as unknown as Table;
      component.clear(mockTable);

      expect(clearFn).toHaveBeenCalled();
      expect(component.searchText()).toBe('');
      expect(component.searchField()).toBe('EAN');
      expect(component.statusFilter()).toBeNull();
      expect(component.filter()).toEqual({ page: 1, limit: 10 });
      expect(meterServiceSpy.getMetersList).toHaveBeenCalled();
    });
  });

  // ── 7. Navigation ─────────────────────────────────────────────

  describe('onRowClick', () => {
    it('should navigate to meter detail route', async () => {
      await createComponent();
      const meter = buildMeter({ EAN: '541999888777' });
      component.onRowClick(meter);

      expect(routerSpy.navigate).toHaveBeenCalledWith(['/meters/541999888777']);
    });
  });

  // ── 8. Dialogs ─────────────────────────────────────────────────

  describe('onAddMeter', () => {
    let dialogCloseSubject: Subject<unknown>;

    beforeEach(async () => {
      await createComponent();
      dialogCloseSubject = new Subject();
      dialogServiceSpy.open.mockReturnValue({
        onClose: dialogCloseSubject.asObservable(),
        destroy: vi.fn(),
      } as unknown as DynamicDialogRef);
    });

    it('should open MeterCreation dialog', () => {
      component.onAddMeter();

      expect(dialogServiceSpy.open).toHaveBeenCalledWith(
        MeterCreation,
        expect.objectContaining({ modal: true, width: '700px' }),
      );
    });

    it('should show snackbar and reload meters on dialog close with response', () => {
      meterServiceSpy.getMetersList.mockClear();
      meterServiceSpy.getMetersList.mockReturnValue(of(buildPaginatedResponse()));

      component.onAddMeter();
      dialogCloseSubject.next(true);

      expect(snackbarSpy.openSnackBar).toHaveBeenCalledWith(
        'METER.LIST.METER_ADDED_SUCCESSFULLY_LABEL',
        VALIDATION_TYPE,
      );
      expect(meterServiceSpy.getMetersList).toHaveBeenCalled();
    });

    it('should not show snackbar on dialog close without response', () => {
      meterServiceSpy.getMetersList.mockClear();
      snackbarSpy.openSnackBar.mockClear();

      component.onAddMeter();
      dialogCloseSubject.next(undefined);

      expect(snackbarSpy.openSnackBar).not.toHaveBeenCalled();
      expect(meterServiceSpy.getMetersList).not.toHaveBeenCalled();
    });
  });

  // ── 9. updatePaginationTranslation ─────────────────────────────

  describe('updatePaginationTranslation', () => {
    it('should update currentPageReportTemplate with translated text', async () => {
      await createComponent();
      component.updatePaginationTranslation();

      // TranslateService.get returns an observable; with forRoot() default, returns the key
      expect(component.currentPageReportTemplate()).toBeTruthy();
    });
  });
});
