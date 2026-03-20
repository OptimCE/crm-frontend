import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { DialogService } from 'primeng/dynamicdialog';
import { Table, TableLazyLoadEvent } from 'primeng/table';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { MemberViewMeterTab } from './member-view-meter-tab';
import { ApiResponsePaginated, Pagination } from '../../../../../../../core/dtos/api.response';
import { MeterPartialQuery, PartialMeterDTO } from '../../../../../../../shared/dtos/meter.dtos';
import { MeterService } from '../../../../../../../shared/services/meter.service';
import { ErrorMessageHandler } from '../../../../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../../../../shared/services-ui/snackbar.notifcation.service';
import { MeterDataStatus } from '../../../../../../../shared/types/meter.types';

// ── Helpers ────────────────────────────────────────────────────────

function buildMeters(): PartialMeterDTO[] {
  return [
    {
      EAN: '541449000000000001',
      meter_number: 'MTR-001',
      address: { id: 1, street: 'Rue Test', number: 10, postcode: '1000', city: 'Bruxelles' },
      status: MeterDataStatus.ACTIVE,
    },
    {
      EAN: '541449000000000002',
      meter_number: 'MTR-002',
      address: { id: 2, street: 'Avenue Libre', number: 5, postcode: '4000', city: 'Liege' },
      status: MeterDataStatus.INACTIVE,
    },
  ];
}

function buildPaginatedMeterResponse(
  data: PartialMeterDTO[] = buildMeters(),
  pagination: Pagination = new Pagination(1, 10, 2, 1),
): ApiResponsePaginated<PartialMeterDTO[] | string> {
  return new ApiResponsePaginated(data, pagination);
}

// ── Test Suite ─────────────────────────────────────────────────────

describe('MemberViewMeterTab', () => {
  let component: MemberViewMeterTab;
  let fixture: ComponentFixture<MemberViewMeterTab>;

  let meterServiceSpy: {
    getMetersList: ReturnType<typeof vi.fn>;
  };
  let routerSpy: {
    navigate: ReturnType<typeof vi.fn>;
  };
  let snackbarSpy: {
    openSnackBar: ReturnType<typeof vi.fn>;
  };
  let dialogServiceSpy: {
    open: ReturnType<typeof vi.fn>;
  };
  let errorHandlerSpy: {
    handleError: ReturnType<typeof vi.fn>;
  };

  async function createComponent(id: number = 1): Promise<void> {
    fixture = TestBed.createComponent(MemberViewMeterTab);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', id);
    component.ngOnInit();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    meterServiceSpy = {
      getMetersList: vi.fn().mockReturnValue(of(buildPaginatedMeterResponse())),
    };
    routerSpy = { navigate: vi.fn().mockResolvedValue(true) };
    snackbarSpy = { openSnackBar: vi.fn() };
    dialogServiceSpy = { open: vi.fn() };
    errorHandlerSpy = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [MemberViewMeterTab, TranslateModule.forRoot()],
      providers: [
        { provide: MeterService, useValue: meterServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: SnackbarNotification, useValue: snackbarSpy },
      ],
    })
      .overrideComponent(MemberViewMeterTab, {
        remove: { providers: [DialogService, ErrorMessageHandler] },
        add: {
          providers: [
            { provide: DialogService, useValue: dialogServiceSpy },
            { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
          ],
          schemas: [NO_ERRORS_SCHEMA],
        },
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

    it('should have default filter with page 1, limit 10 and holder_id', () => {
      expect(component.filter().page).toBe(1);
      expect(component.filter().limit).toBe(10);
      expect(component.filter().holder_id).toBe(1);
    });

    it('should have meters loaded after init (lazy load fires automatically)', () => {
      expect(component.metersPartialList().length).toBe(2);
    });

    it('should have default search field set to EAN', () => {
      expect(component.searchField()).toBe('EAN');
    });

    it('should have default empty search text', () => {
      expect(component.searchText()).toBe('');
    });

    it('should have default null status filter', () => {
      expect(component.statusFilter()).toBeNull();
    });
  });

  // ── 2. ngOnInit ─────────────────────────────────────────────────

  describe('ngOnInit', () => {
    it('should set filter with holder_id from input', async () => {
      await createComponent(42);
      expect(component.filter().holder_id).toBe(42);
    });

    it('should set currentPageReportTemplate after init', async () => {
      await createComponent();
      // TranslateModule.forRoot() returns the key as-is
      expect(component.currentPageReportTemplate()).toBeTruthy();
    });
  });

  // ── 3. loadMeters ───────────────────────────────────────────────

  describe('loadMeters', () => {
    beforeEach(async () => {
      await createComponent();
      meterServiceSpy.getMetersList.mockClear();
    });

    it('should call meterService.getMetersList with current filter', () => {
      component.loadMeters();
      expect(meterServiceSpy.getMetersList).toHaveBeenCalledWith(component.filter());
    });

    it('should set metersPartialList from response data', () => {
      const meters = buildMeters();
      meterServiceSpy.getMetersList.mockReturnValue(of(buildPaginatedMeterResponse(meters)));
      component.loadMeters();
      expect(component.metersPartialList()).toEqual(meters);
    });

    it('should set paginationMetersInfo from response', () => {
      const pagination = new Pagination(2, 10, 25, 3);
      meterServiceSpy.getMetersList.mockReturnValue(
        of(buildPaginatedMeterResponse(buildMeters(), pagination)),
      );
      component.loadMeters();
      expect(component.paginationMetersInfo()).toEqual(pagination);
    });

    it('should call errorHandler when response is falsy', () => {
      meterServiceSpy.getMetersList.mockReturnValue(of(null));
      component.loadMeters();
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(null);
    });

    it('should call errorHandler on error', () => {
      const error = new Error('Network error');
      meterServiceSpy.getMetersList.mockReturnValue(throwError(() => error));
      component.loadMeters();
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(error);
    });
  });

  // ── 4. applyFilters ─────────────────────────────────────────────

  describe('applyFilters', () => {
    beforeEach(async () => {
      await createComponent();
      meterServiceSpy.getMetersList.mockClear();
    });

    it('should reset page to 1', () => {
      component.filter.set({ page: 3, limit: 10, holder_id: 1 });
      component.applyFilters();
      expect(component.filter().page).toBe(1);
    });

    it('should include street filter when searchField is street', () => {
      component.searchField.set('street');
      component.searchText.set('Rue Test');
      component.applyFilters();
      expect(component.filter().street).toBe('Rue Test');
    });

    it('should include EAN filter when searchField is EAN', () => {
      component.searchField.set('EAN');
      component.searchText.set('5414');
      component.applyFilters();
      expect(component.filter().EAN).toBe('5414');
    });

    it('should include meter_number filter when searchField is meter_number', () => {
      component.searchField.set('meter_number');
      component.searchText.set('MTR-001');
      component.applyFilters();
      expect(component.filter().meter_number).toBe('MTR-001');
    });

    it('should include status filter when statusFilter is set', () => {
      component.statusFilter.set(MeterDataStatus.ACTIVE);
      component.applyFilters();
      expect(component.filter().status).toBe(MeterDataStatus.ACTIVE);
    });

    it('should omit search fields when searchText is empty', () => {
      component.searchText.set('');
      component.applyFilters();
      expect(component.filter().street).toBeUndefined();
      expect(component.filter().EAN).toBeUndefined();
      expect(component.filter().meter_number).toBeUndefined();
    });

    it('should omit status when statusFilter is null', () => {
      component.statusFilter.set(null);
      component.applyFilters();
      expect(component.filter().status).toBeUndefined();
    });

    it('should call loadMeters', () => {
      component.applyFilters();
      expect(meterServiceSpy.getMetersList).toHaveBeenCalled();
    });
  });

  // ── 5. onSearchTextChange ───────────────────────────────────────

  describe('onSearchTextChange', () => {
    beforeEach(async () => {
      await createComponent();
      meterServiceSpy.getMetersList.mockClear();
    });

    it('should set searchText and trigger loadMeters', () => {
      component.onSearchTextChange('hello');
      expect(component.searchText()).toBe('hello');
      expect(meterServiceSpy.getMetersList).toHaveBeenCalled();
    });
  });

  // ── 6. onSearchFieldChange ──────────────────────────────────────

  describe('onSearchFieldChange', () => {
    beforeEach(async () => {
      await createComponent();
      meterServiceSpy.getMetersList.mockClear();
    });

    it('should trigger loadMeters when searchText is non-empty', () => {
      component.searchText.set('test');
      component.onSearchFieldChange();
      expect(meterServiceSpy.getMetersList).toHaveBeenCalled();
    });

    it('should not trigger loadMeters when searchText is empty', () => {
      component.searchText.set('');
      component.onSearchFieldChange();
      expect(meterServiceSpy.getMetersList).not.toHaveBeenCalled();
    });
  });

  // ── 7. onStatusFilterChange ─────────────────────────────────────

  describe('onStatusFilterChange', () => {
    beforeEach(async () => {
      await createComponent();
      meterServiceSpy.getMetersList.mockClear();
    });

    it('should set statusFilter and trigger loadMeters', () => {
      component.onStatusFilterChange(MeterDataStatus.WAITING_GRD);
      expect(component.statusFilter()).toBe(MeterDataStatus.WAITING_GRD);
      expect(meterServiceSpy.getMetersList).toHaveBeenCalled();
    });

    it('should accept null to clear the status filter', () => {
      component.onStatusFilterChange(null);
      expect(component.statusFilter()).toBeNull();
    });
  });

  // ── 8. lazyLoadMeters ───────────────────────────────────────────

  describe('lazyLoadMeters', () => {
    beforeEach(async () => {
      await createComponent();
      meterServiceSpy.getMetersList.mockClear();
    });

    it('should compute correct page from event and call loadMeters', () => {
      component.lazyLoadMeters({ first: 20, rows: 10 } as TableLazyLoadEvent);
      expect(component.filter().page).toBe(3);
      expect(meterServiceSpy.getMetersList).toHaveBeenCalled();
    });

    it('should default page to 1 when rows is 0', () => {
      component.lazyLoadMeters({ first: 0, rows: 0 } as TableLazyLoadEvent);
      expect(component.filter().page).toBe(1);
    });

    it('should keep existing filter fields when paging', () => {
      component.filter.set({
        page: 1,
        limit: 10,
        holder_id: 1,
        EAN: '5414',
      } as MeterPartialQuery);
      component.lazyLoadMeters({ first: 10, rows: 10 } as TableLazyLoadEvent);
      expect(component.filter().EAN).toBe('5414');
      expect(component.filter().page).toBe(2);
    });
  });

  // ── 9. pageChange ───────────────────────────────────────────────

  describe('pageChange', () => {
    beforeEach(async () => {
      await createComponent();
      meterServiceSpy.getMetersList.mockClear();
    });

    it('should compute page from event and call loadMeters', () => {
      component.pageChange({ first: 10, rows: 10 });
      expect(component.filter().page).toBe(2);
      expect(meterServiceSpy.getMetersList).toHaveBeenCalled();
    });

    it('should set page to 1 when first is 0', () => {
      component.pageChange({ first: 0, rows: 10 });
      expect(component.filter().page).toBe(1);
    });
  });

  // ── 10. clear ───────────────────────────────────────────────────

  describe('clear', () => {
    beforeEach(async () => {
      await createComponent();
      meterServiceSpy.getMetersList.mockClear();
    });

    it('should call table.clear(), reset all filters and call loadMeters', () => {
      const mockTable = { clear: vi.fn() } as unknown as Table;

      // Set some filters first
      component.searchText.set('test');
      component.statusFilter.set(MeterDataStatus.ACTIVE);
      component.searchField.set('street');
      component.filter.set({ page: 3, limit: 10, holder_id: 1, street: 'test' });

      component.clear(mockTable);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockTable.clear).toHaveBeenCalled();
      expect(component.searchText()).toBe('');
      expect(component.statusFilter()).toBeNull();
      expect(component.searchField()).toBe('EAN');
      expect(component.filter()).toEqual({ page: 1, limit: 10, holder_id: 1 });
      expect(meterServiceSpy.getMetersList).toHaveBeenCalled();
    });
  });

  // ── 11. onRowClick ──────────────────────────────────────────────

  describe('onRowClick', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should navigate to meter detail page', () => {
      const meter = buildMeters()[0];
      component.onRowClick(meter);
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/members/meter/' + meter.EAN]);
    });
  });

  // ── 12. toAddMeter ──────────────────────────────────────────────

  describe('toAddMeter', () => {
    beforeEach(async () => {
      await createComponent();
      meterServiceSpy.getMetersList.mockClear();
    });

    it('should open dialog with correct config', () => {
      const onCloseSubject = new Subject<unknown>();
      dialogServiceSpy.open.mockReturnValue({
        onClose: onCloseSubject.asObservable(),
        destroy: vi.fn(),
      });

      component.toAddMeter();

      expect(dialogServiceSpy.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          modal: true,
          closable: true,
          closeOnEscape: true,
          width: '700px',
          data: { holder_id: 1 },
        }),
      );
    });

    it('should call snackbar and reload meters when dialog closes with response', () => {
      const onCloseSubject = new Subject<unknown>();
      dialogServiceSpy.open.mockReturnValue({
        onClose: onCloseSubject.asObservable(),
        destroy: vi.fn(),
      });

      component.toAddMeter();
      onCloseSubject.next(true);

      expect(snackbarSpy.openSnackBar).toHaveBeenCalled();
      expect(meterServiceSpy.getMetersList).toHaveBeenCalled();
    });

    it('should not reload meters when dialog closes without response', () => {
      const onCloseSubject = new Subject<unknown>();
      dialogServiceSpy.open.mockReturnValue({
        onClose: onCloseSubject.asObservable(),
        destroy: vi.fn(),
      });

      component.toAddMeter();
      onCloseSubject.next(undefined);

      expect(snackbarSpy.openSnackBar).not.toHaveBeenCalled();
      expect(meterServiceSpy.getMetersList).not.toHaveBeenCalled();
    });
  });

  // ── 13. Computed signals ────────────────────────────────────────

  describe('computed signals', () => {
    beforeEach(async () => {
      await createComponent();
    });

    describe('firstRow', () => {
      it('should compute (page - 1) * limit', () => {
        component.paginationMetersInfo.set(new Pagination(3, 10, 30, 3));
        expect(component.firstRow()).toBe(20);
      });

      it('should be 0 when page is 1', () => {
        component.paginationMetersInfo.set(new Pagination(1, 10, 5, 1));
        expect(component.firstRow()).toBe(0);
      });
    });

    describe('showPaginator', () => {
      it('should be true when total_pages > 1', () => {
        component.paginationMetersInfo.set(new Pagination(1, 10, 25, 3));
        expect(component.showPaginator()).toBe(true);
      });

      it('should be false when total_pages is 1', () => {
        component.paginationMetersInfo.set(new Pagination(1, 10, 5, 1));
        expect(component.showPaginator()).toBe(false);
      });
    });

    describe('hasActiveFilters', () => {
      it('should be true when searchText is set', () => {
        component.searchText.set('test');
        expect(component.hasActiveFilters()).toBe(true);
      });

      it('should be true when statusFilter is set', () => {
        component.statusFilter.set(MeterDataStatus.ACTIVE);
        expect(component.hasActiveFilters()).toBe(true);
      });

      it('should be false when no filters are active', () => {
        component.searchText.set('');
        component.statusFilter.set(null);
        expect(component.hasActiveFilters()).toBe(false);
      });
    });
  });
});
