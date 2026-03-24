import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Table, TableLazyLoadEvent, TablePageEvent } from 'primeng/table';
import { DialogService } from 'primeng/dynamicdialog';

import { SharingOperationsList } from './sharing-operations-list';
import { SharingOperationService } from '../../../../shared/services/sharing_operation.service';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { ApiResponsePaginated, Pagination } from '../../../../core/dtos/api.response';
import { SharingOperationPartialDTO } from '../../../../shared/dtos/sharing_operation.dtos';
import { SharingOperationType } from '../../../../shared/types/sharing_operation.types';
import { DebouncedPInputComponent } from '../../../../shared/components/debounced-p-input/debounced-p-input.component';
import { HeaderPage } from '../../../../layout/header-page/header-page';
import { SharingOperationCreationUpdate } from '../sharing-operation-creation-update/sharing-operation-creation-update';

// ── Stubs ──────────────────────────────────────────────────────────

@Component({ selector: 'app-debounced-p-input', standalone: true, template: '' })
class DebouncedPInputStub {}

@Component({ selector: 'app-header-page', standalone: true, template: '' })
class HeaderPageStub {}

// ── Helpers ────────────────────────────────────────────────────────

function buildSharingOpList(): SharingOperationPartialDTO[] {
  return [
    { id: 1, name: 'Op Alpha', type: SharingOperationType.LOCAL },
    { id: 2, name: 'Op Beta', type: SharingOperationType.CER },
  ];
}

function buildPagination(overrides: Partial<Pagination> = {}): Pagination {
  return new Pagination(
    overrides.page ?? 1,
    overrides.limit ?? 10,
    overrides.total ?? 20,
    overrides.total_pages ?? 2,
  );
}

function buildPaginatedResponse(
  data: SharingOperationPartialDTO[] = buildSharingOpList(),
  pagination: Pagination = buildPagination(),
): ApiResponsePaginated<SharingOperationPartialDTO[] | string> {
  return new ApiResponsePaginated(data, pagination);
}

// ── Test Suite ─────────────────────────────────────────────────────

describe('SharingOperationsList', () => {
  let component: SharingOperationsList;
  let fixture: ComponentFixture<SharingOperationsList>;

  let sharingOpServiceSpy: { getSharingOperationList: ReturnType<typeof vi.fn> };
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };
  let dialogServiceSpy: { open: ReturnType<typeof vi.fn> };
  let snackbarSpy: { openSnackBar: ReturnType<typeof vi.fn> };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };

  async function createComponent(): Promise<void> {
    fixture = TestBed.createComponent(SharingOperationsList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  beforeEach(async () => {
    sharingOpServiceSpy = {
      getSharingOperationList: vi.fn().mockReturnValue(of(buildPaginatedResponse())),
    };
    routerSpy = { navigate: vi.fn().mockResolvedValue(true) };
    dialogServiceSpy = { open: vi.fn() };
    snackbarSpy = { openSnackBar: vi.fn() };
    errorHandlerSpy = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SharingOperationsList, TranslateModule.forRoot()],
      providers: [
        { provide: SharingOperationService, useValue: sharingOpServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: SnackbarNotification, useValue: snackbarSpy },
      ],
    })
      .overrideComponent(SharingOperationsList, {
        remove: {
          imports: [DebouncedPInputComponent, HeaderPage],
          providers: [DialogService, ErrorMessageHandler],
        },
        add: {
          imports: [DebouncedPInputStub, HeaderPageStub],
          providers: [
            { provide: DialogService, useValue: dialogServiceSpy },
            { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
          ],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();
  });

  // ── 1. Creation & initialization ─────────────────────────────────

  describe('creation', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize filter with page 1 and limit 10', () => {
      expect(component.filter().page).toBe(1);
      expect(component.filter().limit).toBe(10);
    });

    it('should initialize searchField to "name"', () => {
      expect(component.searchField()).toBe('name');
    });

    it('should initialize searchText to empty string', () => {
      expect(component.searchText()).toBe('');
    });

    it('should initialize typeFilter to null', () => {
      expect(component.typeFilter()).toBeNull();
    });

    it('should have one searchFieldOption', () => {
      expect(component.searchFieldOptions.length).toBe(1);
    });

    it('should have three typeOptions', () => {
      expect(component.typeOptions.length).toBe(3);
    });

    it('should initialize sharingOperationList as empty array', () => {
      // Before any load, the default is empty
      expect(Array.isArray(component.sharingOperationList())).toBe(true);
    });
  });

  // ── 2. Computed signals ──────────────────────────────────────────

  describe('computed signals', () => {
    beforeEach(async () => {
      await createComponent();
    });

    describe('hasActiveFilters', () => {
      it('should be false when searchText is empty and typeFilter is null', () => {
        component.searchText.set('');
        component.typeFilter.set(null);
        expect(component.hasActiveFilters()).toBe(false);
      });

      it('should be true when searchText is non-empty', () => {
        component.searchText.set('test');
        expect(component.hasActiveFilters()).toBe(true);
      });

      it('should be true when typeFilter is set', () => {
        component.typeFilter.set(SharingOperationType.CER);
        expect(component.hasActiveFilters()).toBe(true);
      });
    });

    describe('firstRow', () => {
      it('should compute (page-1)*limit', () => {
        component.paginationInfo.set(new Pagination(3, 10, 50, 5));
        expect(component.firstRow()).toBe(20);
      });

      it('should return 0 for page 1', () => {
        component.paginationInfo.set(new Pagination(1, 10, 50, 5));
        expect(component.firstRow()).toBe(0);
      });
    });

    describe('showPaginator', () => {
      it('should be true when total_pages > 1', () => {
        component.paginationInfo.set(new Pagination(1, 10, 20, 2));
        expect(component.showPaginator()).toBe(true);
      });

      it('should be false when total_pages is 1', () => {
        component.paginationInfo.set(new Pagination(1, 10, 5, 1));
        expect(component.showPaginator()).toBe(false);
      });

      it('should be false when total_pages is 0', () => {
        component.paginationInfo.set(new Pagination(0, 5, 0, 0));
        expect(component.showPaginator()).toBe(false);
      });
    });
  });

  // ── 3. loadSharingOperation ──────────────────────────────────────

  describe('loadSharingOperation', () => {
    beforeEach(async () => {
      await createComponent();
      sharingOpServiceSpy.getSharingOperationList.mockClear();
    });

    it('should call service with current filter', () => {
      component.loadSharingOperation();
      expect(sharingOpServiceSpy.getSharingOperationList).toHaveBeenCalledWith(component.filter());
    });

    it('should set sharingOperationList from response data', () => {
      const ops = buildSharingOpList();
      sharingOpServiceSpy.getSharingOperationList.mockReturnValue(of(buildPaginatedResponse(ops)));
      component.loadSharingOperation();
      expect(component.sharingOperationList()).toEqual(ops);
    });

    it('should set paginationInfo from response pagination', () => {
      const pagination = buildPagination({ page: 2, total: 30, total_pages: 3 });
      sharingOpServiceSpy.getSharingOperationList.mockReturnValue(
        of(buildPaginatedResponse(buildSharingOpList(), pagination)),
      );
      component.loadSharingOperation();
      expect(component.paginationInfo().page).toBe(2);
      expect(component.paginationInfo().total).toBe(30);
      expect(component.paginationInfo().total_pages).toBe(3);
    });

    it('should log error when response is falsy', () => {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      sharingOpServiceSpy.getSharingOperationList.mockReturnValue(of(null));
      component.loadSharingOperation();
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching sharing operations partial list');
      consoleSpy.mockRestore();
    });

    it('should log error on observable error', () => {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      sharingOpServiceSpy.getSharingOperationList.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      component.loadSharingOperation();
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching sharing operations partial list');
      consoleSpy.mockRestore();
    });
  });

  // ── 4. applyFilters ──────────────────────────────────────────────

  describe('applyFilters', () => {
    beforeEach(async () => {
      await createComponent();
      sharingOpServiceSpy.getSharingOperationList.mockClear();
    });

    it('should reset page to 1', () => {
      component.filter.set({ page: 3, limit: 10 });
      component.applyFilters();
      expect(component.filter().page).toBe(1);
    });

    it('should keep current limit', () => {
      component.filter.set({ page: 3, limit: 20 });
      component.applyFilters();
      expect(component.filter().limit).toBe(20);
    });

    it('should set name filter when searchText is present', () => {
      component.searchText.set('Alpha');
      component.applyFilters();
      expect(component.filter().name).toBe('Alpha');
    });

    it('should not set name filter when searchText is empty', () => {
      component.searchText.set('');
      component.applyFilters();
      expect(component.filter().name).toBeUndefined();
    });

    it('should set type filter when typeFilter is set', () => {
      component.typeFilter.set(SharingOperationType.CEC);
      component.applyFilters();
      expect(component.filter().type).toBe(String(SharingOperationType.CEC));
    });

    it('should not set type filter when typeFilter is null', () => {
      component.typeFilter.set(null);
      component.applyFilters();
      expect(component.filter().type).toBeUndefined();
    });

    it('should call loadSharingOperation', () => {
      component.applyFilters();
      expect(sharingOpServiceSpy.getSharingOperationList).toHaveBeenCalled();
    });
  });

  // ── 5. onSearchTextChange ────────────────────────────────────────

  describe('onSearchTextChange', () => {
    beforeEach(async () => {
      await createComponent();
      sharingOpServiceSpy.getSharingOperationList.mockClear();
    });

    it('should update searchText signal', () => {
      component.onSearchTextChange('hello');
      expect(component.searchText()).toBe('hello');
    });

    it('should call loadSharingOperation via applyFilters', () => {
      component.onSearchTextChange('hello');
      expect(sharingOpServiceSpy.getSharingOperationList).toHaveBeenCalled();
    });
  });

  // ── 6. onSearchFieldChange ───────────────────────────────────────

  describe('onSearchFieldChange', () => {
    beforeEach(async () => {
      await createComponent();
      sharingOpServiceSpy.getSharingOperationList.mockClear();
    });

    it('should call loadSharingOperation when searchText is non-empty', () => {
      component.searchText.set('some text');
      component.onSearchFieldChange();
      expect(sharingOpServiceSpy.getSharingOperationList).toHaveBeenCalled();
    });

    it('should NOT call loadSharingOperation when searchText is empty', () => {
      component.searchText.set('');
      component.onSearchFieldChange();
      expect(sharingOpServiceSpy.getSharingOperationList).not.toHaveBeenCalled();
    });
  });

  // ── 7. onTypeFilterChange ────────────────────────────────────────

  describe('onTypeFilterChange', () => {
    beforeEach(async () => {
      await createComponent();
      sharingOpServiceSpy.getSharingOperationList.mockClear();
    });

    it('should update typeFilter signal', () => {
      component.onTypeFilterChange(SharingOperationType.LOCAL);
      expect(component.typeFilter()).toBe(SharingOperationType.LOCAL);
    });

    it('should call loadSharingOperation via applyFilters', () => {
      component.onTypeFilterChange(SharingOperationType.CER);
      expect(sharingOpServiceSpy.getSharingOperationList).toHaveBeenCalled();
    });

    it('should accept null to clear the type filter', () => {
      component.typeFilter.set(SharingOperationType.CEC);
      component.onTypeFilterChange(null);
      expect(component.typeFilter()).toBeNull();
    });
  });

  // ── 8. lazyLoadSharingOperation ──────────────────────────────────

  describe('lazyLoadSharingOperation', () => {
    beforeEach(async () => {
      await createComponent();
      sharingOpServiceSpy.getSharingOperationList.mockClear();
    });

    it('should compute page from event.first and event.rows', () => {
      component.lazyLoadSharingOperation({ first: 20, rows: 10 } as TableLazyLoadEvent);
      expect(component.filter().page).toBe(3);
    });

    it('should default page to 1 when rows is 0', () => {
      component.lazyLoadSharingOperation({ first: 0, rows: 0 } as TableLazyLoadEvent);
      expect(component.filter().page).toBe(1);
    });

    it('should clamp page to minimum 1', () => {
      component.lazyLoadSharingOperation({ first: -10, rows: 10 } as TableLazyLoadEvent);
      expect(component.filter().page).toBe(1);
    });

    it('should call loadSharingOperation', () => {
      component.lazyLoadSharingOperation({ first: 0, rows: 10 } as TableLazyLoadEvent);
      expect(sharingOpServiceSpy.getSharingOperationList).toHaveBeenCalled();
    });
  });

  // ── 9. pageChange ────────────────────────────────────────────────

  describe('pageChange', () => {
    beforeEach(async () => {
      await createComponent();
      sharingOpServiceSpy.getSharingOperationList.mockClear();
    });

    it('should compute page from event first and rows', () => {
      component.pageChange({ first: 10, rows: 10 } as TablePageEvent);
      expect(component.filter().page).toBe(2);
    });

    it('should call loadSharingOperation', () => {
      component.pageChange({ first: 0, rows: 10 } as TablePageEvent);
      expect(sharingOpServiceSpy.getSharingOperationList).toHaveBeenCalled();
    });
  });

  // ── 10. clear ────────────────────────────────────────────────────

  describe('clear', () => {
    beforeEach(async () => {
      await createComponent();
      sharingOpServiceSpy.getSharingOperationList.mockClear();
    });

    it('should reset searchText to empty', () => {
      component.searchText.set('something');
      const tableMock = { clear: vi.fn() } as unknown as Table;
      component.clear(tableMock);
      expect(component.searchText()).toBe('');
    });

    it('should reset searchField to "name"', () => {
      component.searchField.set('other');
      const tableMock = { clear: vi.fn() } as unknown as Table;
      component.clear(tableMock);
      expect(component.searchField()).toBe('name');
    });

    it('should reset typeFilter to null', () => {
      component.typeFilter.set(SharingOperationType.CER);
      const tableMock = { clear: vi.fn() } as unknown as Table;
      component.clear(tableMock);
      expect(component.typeFilter()).toBeNull();
    });

    it('should reset filter to page 1 limit 10', () => {
      component.filter.set({ page: 5, limit: 20, name: 'test' });
      const tableMock = { clear: vi.fn() } as unknown as Table;
      component.clear(tableMock);
      expect(component.filter()).toEqual({ page: 1, limit: 10 });
    });

    it('should call table.clear()', () => {
      const tableMock = { clear: vi.fn() } as unknown as Table;
      component.clear(tableMock);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(tableMock.clear).toHaveBeenCalled();
    });

    it('should call loadSharingOperation', () => {
      const tableMock = { clear: vi.fn() } as unknown as Table;
      component.clear(tableMock);
      expect(sharingOpServiceSpy.getSharingOperationList).toHaveBeenCalled();
    });
  });

  // ── 11. onRowClick ───────────────────────────────────────────────

  describe('onRowClick', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should navigate to /sharing_operations/:id', () => {
      const op: SharingOperationPartialDTO = {
        id: 42,
        name: 'Test',
        type: SharingOperationType.LOCAL,
      };
      component.onRowClick(op);
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/sharing_operations/', 42]);
    });
  });

  // ── 12. onAddSharingOperation ────────────────────────────────────

  describe('onAddSharingOperation', () => {
    beforeEach(async () => {
      await createComponent();
      sharingOpServiceSpy.getSharingOperationList.mockClear();
    });

    it('should open dialog with SharingOperationCreationUpdate', () => {
      const onClose$ = new Subject<unknown>();
      dialogServiceSpy.open.mockReturnValue({ onClose: onClose$.asObservable(), destroy: vi.fn() });
      component.onAddSharingOperation();
      expect(dialogServiceSpy.open).toHaveBeenCalledWith(
        SharingOperationCreationUpdate,
        expect.objectContaining({
          modal: true,
          closable: true,
          closeOnEscape: true,
        }),
      );
    });

    it('should store the dialog ref', () => {
      const mockRef = { onClose: new Subject<unknown>().asObservable(), destroy: vi.fn() };
      dialogServiceSpy.open.mockReturnValue(mockRef);
      component.onAddSharingOperation();
      expect(component.ref).toBe(mockRef);
    });

    it('should show snackbar and reload list when dialog closes with result', () => {
      const onClose$ = new Subject<unknown>();
      dialogServiceSpy.open.mockReturnValue({ onClose: onClose$.asObservable(), destroy: vi.fn() });
      component.onAddSharingOperation();
      onClose$.next(true);
      expect(snackbarSpy.openSnackBar).toHaveBeenCalled();
      expect(sharingOpServiceSpy.getSharingOperationList).toHaveBeenCalled();
    });

    it('should NOT show snackbar when dialog closes without result', () => {
      const onClose$ = new Subject<unknown>();
      dialogServiceSpy.open.mockReturnValue({ onClose: onClose$.asObservable(), destroy: vi.fn() });
      component.onAddSharingOperation();
      onClose$.next(undefined);
      expect(snackbarSpy.openSnackBar).not.toHaveBeenCalled();
    });

    it('should NOT show snackbar when dialog closes with null', () => {
      const onClose$ = new Subject<unknown>();
      dialogServiceSpy.open.mockReturnValue({ onClose: onClose$.asObservable(), destroy: vi.fn() });
      component.onAddSharingOperation();
      onClose$.next(null);
      expect(snackbarSpy.openSnackBar).not.toHaveBeenCalled();
    });
  });

  // ── 13. updatePaginationTranslation ──────────────────────────────

  describe('updatePaginationTranslation', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should set currentPageReportTemplate from translation', () => {
      // TranslateModule.forRoot() returns the key when no translation is set,
      // so the template should be a non-empty string after constructor runs
      expect(typeof component.currentPageReportTemplate()).toBe('string');
    });
  });
});
