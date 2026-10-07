import { HttpErrorResponse } from '@angular/common/http';
import { Component, input, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { KeyView } from './key-view';
import { HeaderWithHelper } from './header-with-helper/header-with-helper';
import { BackArrow } from '../../../../layout/back-arrow/back-arrow';
import { AgGridAngular } from 'ag-grid-angular';
import { KeyService } from '../../../../shared/services/key.service';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { ApiResponse } from '../../../../core/dtos/api.response';
import { KeyDTO } from '../../../../shared/dtos/key.dtos';
import { CellClassParams, GridReadyEvent } from 'ag-grid-community';
import { KeyTableRow } from '../../../../shared/types/key.types';

// ── Stubs ──────────────────────────────────────────────────────────

@Component({ selector: 'app-back-arrow', standalone: true, template: '' })
class BackArrowStub {
  readonly url = input.required<string>();
  readonly text = input.required<string>();
}

@Component({ selector: 'app-ag-grid-angular', standalone: true, template: '' })
class AgGridStub {}

// ── Translations map ───────────────────────────────────────────────

const TRANSLATIONS: Record<string, string> = {
  'KEY.TABLE.COLUMNS.ITERATION_NUMBER_LABEL': 'Iteration',
  'KEY.TABLE.COLUMNS.ITERATION_TOOLTIP': 'Iteration tooltip',
  'KEY.TABLE.DELETE_ITERATION_BUTTON_LABEL': 'Delete iteration',
  'KEY.TABLE.COLUMNS.VA_PERCENTAGE_LABEL': 'VA %',
  'KEY.TABLE.COLUMNS.VA_PERCENTAGE_TOOLTIP': 'VA tooltip',
  'KEY.TABLE.COLUMNS.CONSUMER_LABEL': 'Consumer',
  'KEY.TABLE.COLUMNS.CONSUMER_NAME_LABEL': 'Name',
  'KEY.TABLE.COLUMNS.CONSUMER_VAP_LABEL': 'VAP %',
  'KEY.TABLE.COLUMNS.CONSUMER_VAP_TOOLTIP': 'VAP tooltip',
  'KEY.TABLE.DELETE_CONSUMER_BUTTON_LABEL': 'Delete consumer',
  VAP_HEADER: 'VAP header',
  'KEY.CREATE.PRORATA_LABEL': 'PRO RATA',
  'KEY.SUCCESS.KEY_DELETED': 'Key deleted',
  'KEY.SUCCESS.KEY_EXPORTED': 'Key exported',
};

// ── Helpers ────────────────────────────────────────────────────────

function buildKey(overrides: Partial<KeyDTO> = {}): KeyDTO {
  return {
    id: 1,
    name: 'Test Key',
    description: 'A test description that is long enough for toggling',
    iterations: [
      {
        id: 1,
        number: 1,
        energy_allocated_percentage: 0.5,
        consumers: [{ id: 1, name: 'Consumer A', energy_allocated_percentage: 0.6 }],
      },
    ],
    ...overrides,
  };
}

function buildEmptyKey(): KeyDTO {
  return { id: -1, name: '', description: '', iterations: [] };
}

// ── Test Suite ─────────────────────────────────────────────────────

describe('KeyView', () => {
  let component: KeyView;
  let fixture: ComponentFixture<KeyView>;

  let keyServiceSpy: {
    getKey: ReturnType<typeof vi.fn>;
    deleteKey: ReturnType<typeof vi.fn>;
    downloadKey: ReturnType<typeof vi.fn>;
  };
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };
  let translateService: TranslateService;
  let snackbarSpy: { openSnackBar: ReturnType<typeof vi.fn> };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };
  let gridApiMock: {
    sizeColumnsToFit: ReturnType<typeof vi.fn>;
    refreshHeader: ReturnType<typeof vi.fn>;
    refreshCells: ReturnType<typeof vi.fn>;
  };

  /**
   * Mutable ActivatedRoute mock — mutate `snapshot.paramMap` before createComponent()
   * to simulate different route params without calling overrideProvider after compilation.
   */
  let activatedRouteMock: { snapshot: { paramMap: ReturnType<typeof convertToParamMap> } };

  /** Creates fixture, component instance and runs ngOnInit. */
  async function createComponent(preInitFn?: () => void): Promise<void> {
    fixture = TestBed.createComponent(KeyView);
    component = fixture.componentInstance;
    if (preInitFn) {
      preInitFn();
    }
    component.ngOnInit();
    await fixture.whenStable();
  }

  /** Sets up the gridApi mock on the component. */
  function setupGridApi(): void {
    component.onGridReady({ api: gridApiMock } as unknown as GridReadyEvent);
  }

  beforeEach(async () => {
    // Reset statics
    KeyView.lastNumberCellStyleNumber = 0;

    activatedRouteMock = { snapshot: { paramMap: convertToParamMap({ id: '1' }) } };

    keyServiceSpy = {
      getKey: vi.fn().mockReturnValue(of(new ApiResponse(buildKey()))),
      deleteKey: vi.fn(),
      downloadKey: vi.fn(),
    };
    routerSpy = { navigate: vi.fn().mockResolvedValue(true) };
    snackbarSpy = { openSnackBar: vi.fn() };
    errorHandlerSpy = { handleError: vi.fn() };
    gridApiMock = {
      sizeColumnsToFit: vi.fn(),
      refreshHeader: vi.fn(),
      refreshCells: vi.fn(),
    };

    await TestBed.configureTestingModule({
      // English, pinned: the percentages are written in the reader's language.
      imports: [KeyView, TranslateModule.forRoot({ lang: 'en' })],
      providers: [
        { provide: KeyService, useValue: keyServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: SnackbarNotification, useValue: snackbarSpy },
        { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
      ],
    })
      .overrideComponent(KeyView, {
        remove: { imports: [BackArrow, AgGridAngular] },
        add: {
          imports: [BackArrowStub, AgGridStub],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    translateService = TestBed.inject(TranslateService);
    vi.spyOn(translateService, 'instant').mockImplementation((key: string | string[]) => {
      if (Array.isArray(key))
        return key.reduce((acc, k) => ({ ...acc, [k]: TRANSLATIONS[k] ?? k }), {});
      return TRANSLATIONS[key] ?? key;
    });
  });

  // ── 1. ngOnInit ─────────────────────────────────────────────────────

  describe('ngOnInit', () => {
    describe('with valid route id', () => {
      beforeEach(async () => {
        await createComponent();
      });

      it('should create the component', () => {
        expect(component).toBeTruthy();
      });

      it('should reset lastNumberCellStyleNumber to 0', () => {
        expect(KeyView.lastNumberCellStyleNumber).toBe(0);
      });

      it('should call keyService.getKey with parsed route id', () => {
        expect(keyServiceSpy.getKey).toHaveBeenCalledWith(1);
      });

      it('should set key signal from API response', () => {
        expect(component.key()?.name).toBe('Test Key');
      });

      it('should set isLoaded to true after successful fetch', () => {
        expect(component.isLoaded()).toBe(true);
      });

      it('should have loaded column definitions', () => {
        expect(component.colDefs().length).toBe(4);
      });
    });

    describe('with missing route id', () => {
      beforeEach(async () => {
        activatedRouteMock.snapshot.paramMap = convertToParamMap({});
        await createComponent();
      });

      it('should navigate to /keys when id is missing', () => {
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/keys']);
      });
    });

    describe('error paths', () => {
      it('should call errorHandler and navigate when response is falsy', async () => {
        keyServiceSpy.getKey.mockReturnValue(of(null));
        await createComponent();

        expect(errorHandlerSpy.handleError).toHaveBeenCalled();
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/keys']);
      });

      // HttpClient fails with an HttpErrorResponse; the backend's message is in its body.
      it("shows the server's message when the key cannot be loaded", async () => {
        keyServiceSpy.getKey.mockReturnValue(
          throwError(
            () =>
              new HttpErrorResponse({
                status: 404,
                error: { data: 'This allocation key does not exist', error_code: 31001 },
              }),
          ),
        );
        await createComponent();

        expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(
          'This allocation key does not exist',
        );
      });

      it('should call errorHandler with null on non-ApiResponse error', async () => {
        keyServiceSpy.getKey.mockReturnValue(throwError(() => new Error('generic')));
        await createComponent();

        expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(null);
      });

      it('should set hasError to true on error', async () => {
        keyServiceSpy.getKey.mockReturnValue(throwError(() => new Error('fail')));
        await createComponent();

        expect(component.hasError()).toBe(true);
      });
    });
  });

  // ── 2. loadColumnDefinitions ────────────────────────────────────────

  describe('loadColumnDefinitions', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should set exactly 4 column defs', () => {
      expect(component.colDefs().length).toBe(4);
    });

    it('should set iteration number column with HeaderWithHelper', () => {
      expect(component.colDefs()[0].headerComponent).toBe(HeaderWithHelper);
    });

    it('should set VA percentage column with HeaderWithHelper', () => {
      expect(component.colDefs()[1].headerComponent).toBe(HeaderWithHelper);
    });

    it('should set consumer name column without HeaderWithHelper', () => {
      expect(component.colDefs()[2].headerComponent).toBeUndefined();
    });

    it('should set consumer VAP column with HeaderWithHelper', () => {
      expect(component.colDefs()[3].headerComponent).toBe(HeaderWithHelper);
    });

    // BUG: these columns also set headerTooltip, and TooltipModule is registered here, so hovering
    // a header showed the help text twice: AG Grid's tooltip on top of HeaderWithHelper's title.
    it('should leave the header help to HeaderWithHelper alone', () => {
      const helpColumns = component
        .colDefs()
        .filter((col) => col.headerComponent === HeaderWithHelper);
      expect(
        helpColumns.map((col) => [
          col.field,
          (col.headerComponentParams as { tooltip: string }).tooltip,
        ]),
      ).toEqual([
        ['number', 'KEY.TABLE.COLUMNS.ITERATION_TOOLTIP'],
        ['va_percentage', 'KEY.TABLE.COLUMNS.VA_PERCENTAGE_TOOLTIP'],
        ['vp_percentage', 'KEY.TABLE.COLUMNS.CONSUMER_VAP_TOOLTIP'],
      ]);
      expect(
        helpColumns
          .filter((col) => 'headerTooltip' in col || 'headerTooltipValueGetter' in col)
          .map((col) => col.field),
      ).toEqual([]);
    });

    it('should bind cellStyle to all columns', () => {
      component.colDefs().forEach((col) => {
        expect(col.cellStyle).toBeDefined();
      });
    });
  });

  // ── 3. formatData ──────────────────────────────────────────────────

  describe('formatData', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should return empty array when key is undefined', () => {
      component.key.set(undefined);
      expect(component.formatData()).toEqual([]);
    });

    it('should return empty array when key has no iterations', () => {
      component.key.set(buildEmptyKey());
      expect(component.formatData()).toEqual([]);
    });

    it('should return one row per consumer across all iterations', () => {
      component.key.set(
        buildKey({
          iterations: [
            {
              id: 1,
              number: 1,
              energy_allocated_percentage: 0.5,
              consumers: [
                { id: 1, name: 'A', energy_allocated_percentage: 0.6 },
                { id: 2, name: 'B', energy_allocated_percentage: 0.4 },
              ],
            },
            {
              id: 2,
              number: 2,
              energy_allocated_percentage: 0.5,
              consumers: [{ id: 3, name: 'C', energy_allocated_percentage: 1 }],
            },
          ],
        }),
      );
      const rows = component.formatData();
      expect(rows.length).toBe(3);
    });

    it('should set number and va_percentage only on first consumer of each iteration', () => {
      component.key.set(
        buildKey({
          iterations: [
            {
              id: 1,
              number: 1,
              energy_allocated_percentage: 0.5,
              consumers: [
                { id: 1, name: 'A', energy_allocated_percentage: 0.6 },
                { id: 2, name: 'B', energy_allocated_percentage: 0.4 },
              ],
            },
          ],
        }),
      );
      const rows = component.formatData();
      expect(rows[0].number).toBe(1);
      expect(rows[0].va_percentage).toBe('50.00%');
      expect(rows[1].number).toBeUndefined();
      expect(rows[1].va_percentage).toBeUndefined();
    });

    it('should format va_percentage as (energy*100).toFixed(2)+%', () => {
      component.key.set(
        buildKey({
          iterations: [
            {
              id: 1,
              number: 1,
              energy_allocated_percentage: 0.75,
              consumers: [{ id: 1, name: 'A', energy_allocated_percentage: 1 }],
            },
          ],
        }),
      );
      const rows = component.formatData();
      expect(rows[0].va_percentage).toBe('75.00%');
    });

    it('should format vp_percentage as (energy*100).toFixed(2)+%', () => {
      component.key.set(
        buildKey({
          iterations: [
            {
              id: 1,
              number: 1,
              energy_allocated_percentage: 0.5,
              consumers: [{ id: 1, name: 'A', energy_allocated_percentage: 0.333 }],
            },
          ],
        }),
      );
      const rows = component.formatData();
      expect(rows[0].vp_percentage).toBe('33.30%');
    });

    it('should use prorata label when consumer energy is -1', () => {
      component.key.set(
        buildKey({
          iterations: [
            {
              id: 1,
              number: 1,
              energy_allocated_percentage: 0.5,
              consumers: [{ id: 1, name: 'A', energy_allocated_percentage: -1 }],
            },
          ],
        }),
      );
      const rows = component.formatData();
      expect(rows[0].vp_percentage).toBe('PRO RATA');
    });

    it("should write the percentages in the reader's language", () => {
      // BUG: `toFixed(2) + '%'` wrote "33.30%" in every language - a decimal
      // point where French, Dutch and German readers expect a comma.
      translateService.use('fr');
      component.key.set(
        buildKey({
          iterations: [
            {
              id: 1,
              number: 1,
              energy_allocated_percentage: 0.5,
              consumers: [{ id: 1, name: 'A', energy_allocated_percentage: 0.333 }],
            },
          ],
        }),
      );
      const rows = component.formatData();
      const nbsp = String.fromCharCode(0xa0);
      expect(rows[0].va_percentage).toBe(`50,00${nbsp}%`);
      expect(rows[0].vp_percentage).toBe(`33,30${nbsp}%`);
    });
  });

  // ── 4. cellStyleNumber ─────────────────────────────────────────────

  describe('cellStyleNumber', () => {
    beforeEach(async () => {
      await createComponent();
      KeyView.lastNumberCellStyleNumber = 0;
    });

    function mockParams(number: number | undefined): CellClassParams<KeyTableRow> {
      return {
        node: { data: { name: 'X', vp_percentage: '50%', number } },
      } as unknown as CellClassParams<KeyTableRow>;
    }

    it('should return colorGradient[0] for iteration number 1', () => {
      const result = component.cellStyleNumber(mockParams(1));
      expect(result.backgroundColor).toBe('#e8f5e9');
    });

    it('should return colorGradient[1] for iteration number 2', () => {
      component.cellStyleNumber(mockParams(1));
      const result = component.cellStyleNumber(mockParams(2));
      expect(result.backgroundColor).toBe('#c8e6c9');
    });

    it('should return colorGradient[2] for iteration number 3', () => {
      component.cellStyleNumber(mockParams(1));
      component.cellStyleNumber(mockParams(2));
      const result = component.cellStyleNumber(mockParams(3));
      expect(result.backgroundColor).toBe('#a5d6a7');
    });

    it('should update static lastNumberCellStyleNumber when number changes', () => {
      component.cellStyleNumber(mockParams(2));
      expect(KeyView.lastNumberCellStyleNumber).toBe(2);
    });

    it('should reuse last style when data.number is undefined', () => {
      component.cellStyleNumber(mockParams(1));
      const result = component.cellStyleNumber(mockParams(undefined));
      expect(result.backgroundColor).toBe('#e8f5e9');
    });
  });

  // ── 5. onGridReady ─────────────────────────────────────────────────

  describe('onGridReady', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should set rowData from formatData()', () => {
      setupGridApi();
      expect(component.rowData().length).toBeGreaterThan(0);
    });

    it('should store gridApi', () => {
      setupGridApi();
      expect(component.gridApi).toBe(gridApiMock);
    });

    // sizeColumnsToFit() would turn flex off and freeze the widths it picked (see onGridReady).
    it('should not call sizeColumnsToFit, the flex columns already fill the grid', () => {
      vi.useFakeTimers();
      try {
        setupGridApi();
        vi.runAllTimers();
      } finally {
        vi.useRealTimers(); // before asserting: a fake clock left behind times out every later test
      }
      expect(component.defaultColDef.flex).toBe(1);
      expect(gridApiMock.sizeColumnsToFit).not.toHaveBeenCalled();
    });

    it('should call refreshHeader after timeout', () => {
      vi.useFakeTimers();
      setupGridApi();
      vi.runAllTimers();
      expect(gridApiMock.refreshHeader).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should call refreshCells with force:true after timeout', () => {
      vi.useFakeTimers();
      setupGridApi();
      vi.runAllTimers();
      expect(gridApiMock.refreshCells).toHaveBeenCalledWith({ force: true });
      vi.useRealTimers();
    });
  });

  // ── 6. deleteKey ───────────────────────────────────────────────────

  describe('deleteKey', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should call keyService.deleteKey with key id', () => {
      keyServiceSpy.deleteKey.mockReturnValue(of(new ApiResponse('ok')));
      component.deleteKey();
      expect(keyServiceSpy.deleteKey).toHaveBeenCalledWith(1);
    });

    it('should show success snackbar on successful delete', () => {
      keyServiceSpy.deleteKey.mockReturnValue(of(new ApiResponse('ok')));
      component.deleteKey();
      expect(snackbarSpy.openSnackBar).toHaveBeenCalledWith('Key deleted', VALIDATION_TYPE);
    });

    it('should navigate to /keys after successful delete', () => {
      keyServiceSpy.deleteKey.mockReturnValue(of(new ApiResponse('ok')));
      component.deleteKey();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/keys']);
    });

    it('should call errorHandler when response is falsy', () => {
      keyServiceSpy.deleteKey.mockReturnValue(of(null));
      component.deleteKey();
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });

    it('should navigate to /keys even on falsy response', () => {
      keyServiceSpy.deleteKey.mockReturnValue(of(null));
      component.deleteKey();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/keys']);
    });

    it("shows the server's message when the key cannot be deleted", () => {
      keyServiceSpy.deleteKey.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: { data: 'This key is still used by a sharing operation', error_code: 31003 },
            }),
        ),
      );
      component.deleteKey();
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(
        'This key is still used by a sharing operation',
      );
    });

    it('should navigate to /keys on error', () => {
      keyServiceSpy.deleteKey.mockReturnValue(throwError(() => new ApiResponse('err')));
      component.deleteKey();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/keys']);
    });

    it('should do nothing when key is undefined', () => {
      component.key.set(undefined);
      component.deleteKey();
      expect(keyServiceSpy.deleteKey).not.toHaveBeenCalled();
    });
  });

  // ── 7. exportExcel ─────────────────────────────────────────────────

  describe('exportExcel', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should call keyService.downloadKey with key id', () => {
      keyServiceSpy.downloadKey.mockReturnValue(
        of({ blob: new Blob(['data']), filename: 'test.xlsx' }),
      );
      component.exportExcel();
      expect(keyServiceSpy.downloadKey).toHaveBeenCalledWith(1);
    });

    it('should show success snackbar on successful download', () => {
      const mockAnchor = { href: '', download: '', click: vi.fn() } as unknown as HTMLAnchorElement;
      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
      vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
      vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
      vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:url');
      vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {
        /* noop */
      });

      keyServiceSpy.downloadKey.mockReturnValue(
        of({ blob: new Blob(['data']), filename: 'test.xlsx' }),
      );
      component.exportExcel();
      expect(snackbarSpy.openSnackBar).toHaveBeenCalledWith('Key exported', VALIDATION_TYPE);

      vi.restoreAllMocks();
    });

    it('should trigger file download via anchor element', () => {
      const mockAnchor = { href: '', download: '', click: vi.fn() } as unknown as HTMLAnchorElement;
      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
      const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
      const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
      vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:url');
      const revokeSpy = vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {
        /* noop */
      });

      keyServiceSpy.downloadKey.mockReturnValue(
        of({ blob: new Blob(['data']), filename: 'export.xlsx' }),
      );
      component.exportExcel();

      expect(mockAnchor.href).toBe('blob:url');
      expect(mockAnchor.download).toBe('export.xlsx');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(appendSpy).toHaveBeenCalledWith(mockAnchor);
      expect(removeSpy).toHaveBeenCalledWith(mockAnchor);
      expect(revokeSpy).toHaveBeenCalledWith('blob:url');

      vi.restoreAllMocks();
    });

    it('should do nothing when key is undefined', () => {
      component.key.set(undefined);
      component.exportExcel();
      expect(keyServiceSpy.downloadKey).not.toHaveBeenCalled();
    });

    it("shows the server's message when the key cannot be exported", () => {
      keyServiceSpy.downloadKey.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 500,
              error: { data: 'The Excel export could not be generated', error_code: 31005 },
            }),
        ),
      );
      component.exportExcel();
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(
        'The Excel export could not be generated',
      );
    });

    it('should call errorHandler with null on non-ApiResponse error', () => {
      keyServiceSpy.downloadKey.mockReturnValue(throwError(() => new Error('generic')));
      component.exportExcel();
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(null);
    });
  });

  // ── 8. updateKey ───────────────────────────────────────────────────

  describe('updateKey', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should navigate to /keys/add with query param id', () => {
      component.updateKey();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/keys/add'], { queryParams: { id: 1 } });
    });

    it('should do nothing when key is undefined', () => {
      component.key.set(undefined);
      routerSpy.navigate.mockClear();
      component.updateKey();
      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });
  });

  // ── 9. toggleDescription ───────────────────────────────────────────

  describe('toggleDescription', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should toggle displayAllDescription from false to true', () => {
      expect(component.displayAllDescription()).toBe(false);
      component.toggleDescription();
      expect(component.displayAllDescription()).toBe(true);
    });

    it('should toggle displayAllDescription from true back to false', () => {
      component.toggleDescription();
      component.toggleDescription();
      expect(component.displayAllDescription()).toBe(false);
    });
  });

  // ── 10. Computed signals ───────────────────────────────────────────

  describe('computed signals', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should compute iterationCount from key iterations length', () => {
      component.key.set(
        buildKey({
          iterations: [
            {
              id: 1,
              number: 1,
              energy_allocated_percentage: 0.5,
              consumers: [{ id: 1, name: 'A', energy_allocated_percentage: 1 }],
            },
            {
              id: 2,
              number: 2,
              energy_allocated_percentage: 0.5,
              consumers: [{ id: 2, name: 'B', energy_allocated_percentage: 1 }],
            },
          ],
        }),
      );
      expect(component.iterationCount()).toBe(2);
    });

    it('should return 0 for iterationCount when key is undefined', () => {
      component.key.set(undefined);
      expect(component.iterationCount()).toBe(0);
    });

    it('should compute consumerCount from first iteration consumers', () => {
      component.key.set(
        buildKey({
          iterations: [
            {
              id: 1,
              number: 1,
              energy_allocated_percentage: 0.5,
              consumers: [
                { id: 1, name: 'A', energy_allocated_percentage: 0.5 },
                { id: 2, name: 'B', energy_allocated_percentage: 0.3 },
                { id: 3, name: 'C', energy_allocated_percentage: 0.2 },
              ],
            },
          ],
        }),
      );
      expect(component.consumerCount()).toBe(3);
    });

    it('should return 0 for consumerCount when key has no iterations', () => {
      component.key.set(buildEmptyKey());
      expect(component.consumerCount()).toBe(0);
    });

    it('should return 0 for consumerCount when key is undefined', () => {
      component.key.set(undefined);
      expect(component.consumerCount()).toBe(0);
    });
  });
});
