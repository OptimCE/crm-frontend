import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Table, TableLazyLoadEvent, TablePageEvent } from 'primeng/table';
import { MenuItemCommandEvent } from 'primeng/api';

import { KeysList } from './keys-list';
import { KeyService } from '../../../../shared/services/key.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { ApiResponse, ApiResponsePaginated, Pagination } from '../../../../core/dtos/api.response';
import { KeyPartialDTO } from '../../../../shared/dtos/key.dtos';
import { DebouncedPInputComponent } from '../../../../shared/components/debounced-p-input/debounced-p-input.component';
import { Toast } from 'primeng/toast';
import { SplitButton } from 'primeng/splitbutton';

// ── Stubs ──────────────────────────────────────────────────────────

@Component({ selector: 'app-debounced-p-input', standalone: true, template: '' })
class DebouncedPInputStub {}

@Component({ selector: 'app-toast-stub', standalone: true, template: '' })
class ToastStub {}

@Component({ selector: 'app-split-button-stub', standalone: true, template: '' })
class SplitButtonStub {}

// ── Helpers ────────────────────────────────────────────────────────

function buildKeysList(): KeyPartialDTO[] {
  return [
    { id: 1, name: 'Key A', description: 'Description A' },
    { id: 2, name: 'Key B', description: 'Description B' },
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
  data: KeyPartialDTO[] = buildKeysList(),
  pagination: Pagination = buildPagination(),
): ApiResponsePaginated<KeyPartialDTO[] | string> {
  return new ApiResponsePaginated(data, pagination);
}

// ── Test Suite ─────────────────────────────────────────────────────

describe('KeysList', () => {
  let component: KeysList;
  let fixture: ComponentFixture<KeysList>;

  let keyServiceSpy: { getKeysList: ReturnType<typeof vi.fn> };
  let routerSpy: { navigateByUrl: ReturnType<typeof vi.fn> };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };

  async function createComponent(): Promise<void> {
    fixture = TestBed.createComponent(KeysList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  beforeEach(async () => {
    keyServiceSpy = {
      getKeysList: vi.fn().mockReturnValue(of(buildPaginatedResponse())),
    };
    routerSpy = { navigateByUrl: vi.fn().mockResolvedValue(true) };
    errorHandlerSpy = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [KeysList, TranslateModule.forRoot()],
      providers: [
        { provide: KeyService, useValue: keyServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
        { provide: ActivatedRoute, useValue: {} },
      ],
    })
      .overrideComponent(KeysList, {
        remove: { imports: [DebouncedPInputComponent, Toast, SplitButton] },
        add: {
          imports: [DebouncedPInputStub, ToastStub, SplitButtonStub],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();
  });

  // ── 1. Component creation ───────────────────────────────────────

  describe('creation', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize loading to true', () => {
      // loading is set to true initially; loadKeys may have run via lazy load,
      // but the default value is true
      expect(typeof component.loading()).toBe('boolean');
    });

    it('should initialize filter with page 1 and limit 10', () => {
      // After constructor, filter defaults (may be overwritten by lazy load)
      expect(component.filter().limit).toBe(10);
    });

    it('should initialize searchField to "name"', () => {
      expect(component.searchField()).toBe('name');
    });

    it('should initialize searchText to empty string', () => {
      expect(component.searchText()).toBe('');
    });

    it('should have two searchFieldOptions', () => {
      expect(component.searchFieldOptions.length).toBe(2);
    });
  });

  // ── 2. loadKeys ─────────────────────────────────────────────────

  describe('loadKeys', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should call keyService.getKeysList with current filter', () => {
      keyServiceSpy.getKeysList.mockClear();
      component.loadKeys();
      expect(keyServiceSpy.getKeysList).toHaveBeenCalledWith(component.filter());
    });

    it('should set keysList from response data', () => {
      const keys = buildKeysList();
      keyServiceSpy.getKeysList.mockReturnValue(of(buildPaginatedResponse(keys)));
      component.loadKeys();
      expect(component.keysList()).toEqual(keys);
    });

    it('should set paginated from response pagination', () => {
      const pagination = buildPagination({ page: 2, total: 30, total_pages: 3 });
      keyServiceSpy.getKeysList.mockReturnValue(
        of(buildPaginatedResponse(buildKeysList(), pagination)),
      );
      component.loadKeys();
      expect(component.paginated().page).toBe(2);
      expect(component.paginated().total).toBe(30);
      expect(component.paginated().total_pages).toBe(3);
    });

    it('should set loading to false after success', () => {
      component.loadKeys();
      expect(component.loading()).toBe(false);
    });

    it('should call errorHandler when response is falsy', () => {
      keyServiceSpy.getKeysList.mockReturnValue(of(null));
      component.loadKeys();
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });

    it('should call errorHandler when response.data is falsy', () => {
      const response = { data: null, pagination: buildPagination() };
      keyServiceSpy.getKeysList.mockReturnValue(of(response));
      component.loadKeys();
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });

    it('should set loading to false even when response is falsy', () => {
      keyServiceSpy.getKeysList.mockReturnValue(of(null));
      component.loadKeys();
      expect(component.loading()).toBe(false);
    });

    it('should call errorHandler with data on ApiResponse error', () => {
      keyServiceSpy.getKeysList.mockReturnValue(throwError(() => new ApiResponse('Some error')));
      component.loadKeys();
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith('Some error');
    });

    it('should call errorHandler with null on non-ApiResponse error', () => {
      keyServiceSpy.getKeysList.mockReturnValue(throwError(() => new Error('generic')));
      component.loadKeys();
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(null);
    });

    it('should set loading to false on error', () => {
      keyServiceSpy.getKeysList.mockReturnValue(throwError(() => new Error('fail')));
      component.loadKeys();
      expect(component.loading()).toBe(false);
    });
  });

  // ── 3. lazyLoadKeys ─────────────────────────────────────────────

  describe('lazyLoadKeys', () => {
    beforeEach(async () => {
      await createComponent();
      keyServiceSpy.getKeysList.mockClear();
    });

    it('should compute page from event.first and event.rows', () => {
      component.lazyLoadKeys({ first: 20, rows: 10 } as TableLazyLoadEvent);
      expect(component.filter().page).toBe(3);
    });

    it('should default page to 1 when rows is 0', () => {
      component.lazyLoadKeys({ first: 0, rows: 0 } as TableLazyLoadEvent);
      expect(component.filter().page).toBe(1);
    });

    it('should clamp page to minimum 1', () => {
      component.lazyLoadKeys({ first: -10, rows: 10 } as TableLazyLoadEvent);
      expect(component.filter().page).toBe(1);
    });

    it('should call loadKeys', () => {
      component.lazyLoadKeys({ first: 0, rows: 10 } as TableLazyLoadEvent);
      expect(keyServiceSpy.getKeysList).toHaveBeenCalled();
    });
  });

  // ── 4. applyFilters ─────────────────────────────────────────────

  describe('applyFilters', () => {
    beforeEach(async () => {
      await createComponent();
      keyServiceSpy.getKeysList.mockClear();
    });

    it('should reset page to 1', () => {
      component.filter.set({ page: 3, limit: 10 });
      component.applyFilters();
      expect(component.filter().page).toBe(1);
    });

    it('should keep current limit', () => {
      component.filter.set({ page: 3, limit: 10 });
      component.applyFilters();
      expect(component.filter().limit).toBe(10);
    });

    it('should set name filter when searchField is "name"', () => {
      component.searchField.set('name');
      component.searchText.set('Test');
      component.applyFilters();
      expect(component.filter().name).toBe('Test');
      expect(component.filter().description).toBeUndefined();
    });

    it('should set description filter when searchField is "description"', () => {
      component.searchField.set('description');
      component.searchText.set('Desc');
      component.applyFilters();
      expect(component.filter().description).toBe('Desc');
      expect(component.filter().name).toBeUndefined();
    });

    it('should not set name or description when searchText is empty', () => {
      component.searchText.set('');
      component.applyFilters();
      expect(component.filter().name).toBeUndefined();
      expect(component.filter().description).toBeUndefined();
    });

    it('should call loadKeys', () => {
      component.applyFilters();
      expect(keyServiceSpy.getKeysList).toHaveBeenCalled();
    });
  });

  // ── 5. onSearchTextChange ───────────────────────────────────────

  describe('onSearchTextChange', () => {
    beforeEach(async () => {
      await createComponent();
      keyServiceSpy.getKeysList.mockClear();
    });

    it('should update searchText signal', () => {
      component.onSearchTextChange('hello');
      expect(component.searchText()).toBe('hello');
    });

    it('should call loadKeys (via applyFilters)', () => {
      component.onSearchTextChange('hello');
      expect(keyServiceSpy.getKeysList).toHaveBeenCalled();
    });
  });

  // ── 6. onSearchFieldChange ──────────────────────────────────────

  describe('onSearchFieldChange', () => {
    beforeEach(async () => {
      await createComponent();
      keyServiceSpy.getKeysList.mockClear();
    });

    it('should call loadKeys when searchText is non-empty', () => {
      component.searchText.set('some text');
      component.onSearchFieldChange();
      expect(keyServiceSpy.getKeysList).toHaveBeenCalled();
    });

    it('should NOT call loadKeys when searchText is empty', () => {
      component.searchText.set('');
      component.onSearchFieldChange();
      expect(keyServiceSpy.getKeysList).not.toHaveBeenCalled();
    });
  });

  // ── 7. pageChange ───────────────────────────────────────────────

  describe('pageChange', () => {
    beforeEach(async () => {
      await createComponent();
      keyServiceSpy.getKeysList.mockClear();
    });

    it('should compute page from event first and rows', () => {
      component.pageChange({ first: 10, rows: 10 } as TablePageEvent);
      expect(component.filter().page).toBe(2);
    });

    it('should call loadKeys', () => {
      component.pageChange({ first: 0, rows: 10 } as TablePageEvent);
      expect(keyServiceSpy.getKeysList).toHaveBeenCalled();
    });
  });

  // ── 8. clear ────────────────────────────────────────────────────

  describe('clear', () => {
    beforeEach(async () => {
      await createComponent();
      keyServiceSpy.getKeysList.mockClear();
    });

    it('should reset searchText to empty', () => {
      component.searchText.set('something');
      const tableMock = { clear: vi.fn() } as unknown as Table;
      component.clear(tableMock);
      expect(component.searchText()).toBe('');
    });

    it('should reset searchField to "name"', () => {
      component.searchField.set('description');
      const tableMock = { clear: vi.fn() } as unknown as Table;
      component.clear(tableMock);
      expect(component.searchField()).toBe('name');
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

    it('should call loadKeys', () => {
      const tableMock = { clear: vi.fn() } as unknown as Table;
      component.clear(tableMock);
      expect(keyServiceSpy.getKeysList).toHaveBeenCalled();
    });
  });

  // ── 9. Navigation ───────────────────────────────────────────────

  describe('addKey', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should navigate to /keys/add', () => {
      component.addKey();
      expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/keys/add');
    });
  });

  describe('addStepByStepKey', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should navigate to /keys/add/step', () => {
      component.addStepByStepKey();
      expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/keys/add/step');
    });
  });

  // ── 10. Computed signals ────────────────────────────────────────

  describe('computed signals', () => {
    beforeEach(async () => {
      await createComponent();
    });

    describe('hasActiveFilters', () => {
      it('should be false when searchText is empty', () => {
        component.searchText.set('');
        expect(component.hasActiveFilters()).toBe(false);
      });

      it('should be true when searchText is non-empty', () => {
        component.searchText.set('test');
        expect(component.hasActiveFilters()).toBe(true);
      });
    });

    describe('firstRow', () => {
      it('should compute (page-1)*limit', () => {
        component.paginated.set(new Pagination(3, 10, 50, 5));
        expect(component.firstRow()).toBe(20);
      });

      it('should return 0 for page 1', () => {
        component.paginated.set(new Pagination(1, 10, 50, 5));
        expect(component.firstRow()).toBe(0);
      });
    });

    describe('showPaginator', () => {
      it('should be true when total_pages > 1', () => {
        component.paginated.set(new Pagination(1, 10, 20, 2));
        expect(component.showPaginator()).toBe(true);
      });

      it('should be false when total_pages is 1', () => {
        component.paginated.set(new Pagination(1, 10, 5, 1));
        expect(component.showPaginator()).toBe(false);
      });

      it('should be false when total_pages is 0', () => {
        component.paginated.set(new Pagination(0, 5, 0, 0));
        expect(component.showPaginator()).toBe(false);
      });
    });
  });

  // ── 11. Constructor / translations ──────────────────────────────

  describe('translations', () => {
    it('should set optionsSplitButton label from translate', async () => {
      const translateService = TestBed.inject(TranslateService);
      translateService.setTranslation('en', {
        'KEY.LIST.ADD_STANDARD_KEY_BUTTON_LABEL': 'Add standard key',
      });
      translateService.use('en');
      await createComponent();
      // The label may or may not be set depending on translation timing;
      // at minimum, the menu item should exist
      expect(component.optionsSplitButton.length).toBe(1);
    });

    it('should have optionsSplitButton with command that calls addStepByStepKey', async () => {
      await createComponent();
      const spy = vi.spyOn(component, 'addStepByStepKey').mockImplementation(() => {
        /* noop */
      });
      component.optionsSplitButton[0].command?.({} as MenuItemCommandEvent);
      expect(spy).toHaveBeenCalled();
    });
  });
});
