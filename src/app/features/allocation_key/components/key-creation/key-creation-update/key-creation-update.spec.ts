import { Component, input, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DialogService } from 'primeng/dynamicdialog';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { KeyCreationUpdate } from './key-creation-update';
import { BackArrow } from '../../../../../layout/back-arrow/back-arrow';
import { AgGridAngular } from 'ag-grid-angular';
import { KeyService } from '../../../../../shared/services/key.service';
import { SnackbarNotification } from '../../../../../shared/services-ui/snackbar.notifcation.service';
import { ErrorMessageHandler } from '../../../../../shared/services-ui/error.message.handler';
import { VALIDATION_TYPE } from '../../../../../core/dtos/notification';
import { ApiResponse } from '../../../../../core/dtos/api.response';
import { KeyDTO } from '../../../../../shared/dtos/key.dtos';
import { GridApi, GridReadyEvent, NewValueParams } from 'ag-grid-community';
import { KeyTableRow } from '../../../../../shared/types/key.types';

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
  'KEY.CREATE.ERROR.NO_ITERATION': 'No iteration',
  'KEY.CREATE.ERROR.NO_CONSUMERS': 'No consumers',
  'KEY.CREATE.ERROR.SUM_ITERATIONS_ERROR': 'Sum iterations error',
  'KEY.CREATE.ERROR.SUM_CONSUMERS': 'Sum consumers error',
  'KEY.CREATE.ERROR.CONSUMER_NAME_REQUIRED': 'Consumer name required',
  'KEY.CREATE.ERROR.NO_CHANGE': 'No change',
  CREATE_ALLOCATION_KEY_NO_CHANGE: 'No change',
  'KEY.CREATE.PRORATA_LABEL': 'Prorata',
  'KEY.SUCCESS.KEY_ADDED': 'Key added',
  'KEY.SUCCESS.KEY_UPDATED': 'Key updated',
};

// ── Helpers ────────────────────────────────────────────────────────

function buildKey(overrides: Partial<KeyDTO> = {}): KeyDTO {
  return {
    id: 1,
    name: 'Test Key',
    description: 'Test Description',
    iterations: [
      {
        id: 1,
        number: 1,
        energy_allocated_percentage: 1,
        consumers: [{ id: 1, name: 'Consumer A', energy_allocated_percentage: 1 }],
      },
    ],
    ...overrides,
  };
}

function buildEmptyKey(): KeyDTO {
  return { id: -1, name: '', description: '', iterations: [] };
}

// ── Test Suite ─────────────────────────────────────────────────────

describe('KeyCreationUpdate', () => {
  let component: KeyCreationUpdate;
  let fixture: ComponentFixture<KeyCreationUpdate>;

  let keyServiceSpy: {
    getKey: ReturnType<typeof vi.fn>;
    addKey: ReturnType<typeof vi.fn>;
    updateKey: ReturnType<typeof vi.fn>;
  };
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };
  let translateService: TranslateService;
  let snackbarSpy: { openSnackBar: ReturnType<typeof vi.fn> };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };
  let dialogServiceSpy: { open: ReturnType<typeof vi.fn> };
  let queryParamSubject: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let gridApiMock: { refreshCells: ReturnType<typeof vi.fn> };

  /** Sets history.state portably (works in both browser and node envs). */
  function setHistoryState(state: Record<string, unknown>): void {
    if (typeof history !== 'undefined' && typeof history.replaceState === 'function') {
      history.replaceState(state, '');
    } else {
      (globalThis as Record<string, unknown>)['history'] = { state, replaceState: vi.fn() };
    }
  }

  /** Sets up the gridApi mock on the component so refreshGrid() works. */
  function setupGridApi(): void {
    component.onGridReady({ api: gridApiMock } as unknown as GridReadyEvent);
  }

  /** Creates fixture, component instance and runs ngOnInit (default: no route id).
   *  If preInitFn is provided, it runs before ngOnInit (useful for setting gridApi early). */
  async function createComponent(preInitFn?: () => void): Promise<void> {
    fixture = TestBed.createComponent(KeyCreationUpdate);
    component = fixture.componentInstance;
    if (preInitFn) {
      preInitFn();
    }
    component.ngOnInit();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    // Reset statics
    KeyCreationUpdate.displayedNumbers.clear();
    KeyCreationUpdate.lastNumberCellStyleNumber = 0;

    queryParamSubject = new BehaviorSubject(convertToParamMap({}));
    keyServiceSpy = {
      getKey: vi.fn(),
      addKey: vi.fn(),
      updateKey: vi.fn(),
    };
    routerSpy = { navigate: vi.fn().mockResolvedValue(true) };
    snackbarSpy = { openSnackBar: vi.fn() };
    errorHandlerSpy = { handleError: vi.fn() };
    dialogServiceSpy = { open: vi.fn() };
    gridApiMock = { refreshCells: vi.fn() };

    // Ensure history.state is never null (test environment default)
    if (typeof history !== 'undefined') {
      history.replaceState({}, '');
    } else {
      // Node environment: provide a minimal history mock
      (globalThis as Record<string, unknown>)['history'] = { state: {}, replaceState: vi.fn() };
    }

    await TestBed.configureTestingModule({
      imports: [KeyCreationUpdate, TranslateModule.forRoot()],
      providers: [
        { provide: KeyService, useValue: keyServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: SnackbarNotification, useValue: snackbarSpy },
        { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParamSubject.asObservable() } },
      ],
    })
      .overrideComponent(KeyCreationUpdate, {
        remove: { imports: [BackArrow, AgGridAngular], providers: [DialogService] },
        add: {
          imports: [BackArrowStub, AgGridStub],
          providers: [{ provide: DialogService, useValue: dialogServiceSpy }],
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

  // ── 1. Initialization ────────────────────────────────────────────

  describe('ngOnInit', () => {
    describe('fallback path (no id, no state)', () => {
      beforeEach(async () => {
        await createComponent();
        setupGridApi();
      });

      it('should create the component', () => {
        expect(component).toBeTruthy();
      });

      it('should have loaded column definitions and error messages', () => {
        // loadColumnDefinitions and loadErrorMessages both call translate.get in ngOnInit
        expect(component.colDefs().length).toBeGreaterThan(0);
      });

      it('should reset keyInput to null', () => {
        expect(component.keyInput).toBeNull();
      });

      it('should create formGroup with name, description, and key_data controls', () => {
        expect(component.formGroup.get('name')).toBeTruthy();
        expect(component.formGroup.get('description')).toBeTruthy();
        expect(component.formGroup.get('key_data')).toBeTruthy();
      });

      it('should create an empty key with no iterations', () => {
        expect(component.key).toEqual({
          id: -1,
          name: '',
          description: '',
          iterations: [],
        });
      });

      it('should set isLoaded to true', () => {
        expect(component.isLoaded()).toBe(true);
      });
    });

    describe('with route id param', () => {
      it('should fetch key from service and initialize', async () => {
        const key = buildKey();
        keyServiceSpy.getKey.mockReturnValue(of(new ApiResponse(key)));
        queryParamSubject.next(convertToParamMap({ id: '1' }));

        await createComponent();

        expect(keyServiceSpy.getKey).toHaveBeenCalledWith(1);
        expect(component.key.name).toBe('Test Key');
        expect(component.keyInput).toBeTruthy();
        expect(component.isLoaded()).toBe(true);
        expect(component.formGroup.get('name')?.value).toBe('Test Key');
        expect(component.formGroup.get('description')?.value).toBe('Test Description');
      });

      it('should deep clone keyInput so mutations do not affect it', async () => {
        const key = buildKey();
        keyServiceSpy.getKey.mockReturnValue(of(new ApiResponse(key)));
        queryParamSubject.next(convertToParamMap({ id: '1' }));

        await createComponent();

        component.key.name = 'MODIFIED';
        expect(component.keyInput?.name).toBe('Test Key');
      });

      it('should call errorHandler when API returns null response', async () => {
        keyServiceSpy.getKey.mockReturnValue(of(null));
        queryParamSubject.next(convertToParamMap({ id: '1' }));

        await createComponent();

        expect(errorHandlerSpy.handleError).toHaveBeenCalled();
      });

      it('should call errorHandler with data on ApiResponse error', async () => {
        const apiError = new ApiResponse('Some error');
        keyServiceSpy.getKey.mockReturnValue(throwError(() => apiError));
        queryParamSubject.next(convertToParamMap({ id: '1' }));

        await createComponent();

        expect(errorHandlerSpy.handleError).toHaveBeenCalledWith('Some error');
      });

      it('should call errorHandler with null on non-ApiResponse error', async () => {
        keyServiceSpy.getKey.mockReturnValue(throwError(() => new Error('generic')));
        queryParamSubject.next(convertToParamMap({ id: '1' }));

        await createComponent();

        expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(null);
      });
    });

    describe('with history.state.keyData', () => {
      it('should initialize with transferred key data', async () => {
        const key = buildKey();
        setHistoryState({ keyData: key });

        await createComponent();

        expect(component.key.name).toBe('Test Key');
        expect(component.keyInput).toBeTruthy();
        expect(component.isLoaded()).toBe(true);

        setHistoryState({});
      });
    });

    describe('with history.state.consumers', () => {
      it('should create key with pre-populated consumer names', async () => {
        setHistoryState({ consumers: ['EAN1', 'EAN2', 'EAN3'] });

        await createComponent(() => {
          // gridApi must be set before ngOnInit because the consumers path calls refreshGrid()
          component.gridApi = gridApiMock as unknown as GridApi;
        });

        expect(component.key.iterations.length).toBe(1);
        expect(component.key.iterations[0].consumers.length).toBe(3);
        expect(component.key.iterations[0].consumers[0].name).toBe('EAN1');
        expect(component.key.iterations[0].consumers[1].name).toBe('EAN2');
        expect(component.key.iterations[0].consumers[2].name).toBe('EAN3');
        expect(component.isLoaded()).toBe(true);

        setHistoryState({});
      });
    });
  });

  // ── 2. initializeWithData ────────────────────────────────────────

  describe('initializeWithData', () => {
    beforeEach(async () => {
      await createComponent();
      setupGridApi();
    });

    it('should set key, form values, rowData, and isLoaded', () => {
      const key = buildKey();
      component.initializeWithData(key);

      expect(component.key).toBe(key);
      expect(component.formGroup.get('name')?.value).toBe('Test Key');
      expect(component.formGroup.get('description')?.value).toBe('Test Description');
      expect(component.isLoaded()).toBe(true);
      expect(component.rowData().length).toBeGreaterThan(0);
    });
  });

  // ── 3. formatData ────────────────────────────────────────────────

  describe('formatData', () => {
    beforeEach(async () => {
      await createComponent();
      setupGridApi();
    });

    it('should return empty array when key has no iterations', () => {
      component.key = buildEmptyKey();
      expect(component.formatData()).toEqual([]);
    });

    it('should return one row per consumer', () => {
      component.key = buildKey({
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
            consumers: [{ id: 3, name: 'A', energy_allocated_percentage: 1 }],
          },
        ],
      });

      const rows = component.formatData();
      expect(rows.length).toBe(3);
    });

    it('should format va_percentage as (energy*100)+%', () => {
      component.key = buildKey({
        iterations: [
          {
            id: 1,
            number: 1,
            energy_allocated_percentage: 0.5,
            consumers: [{ id: 1, name: 'A', energy_allocated_percentage: 1 }],
          },
        ],
      });

      const rows = component.formatData();
      expect(rows[0].va_percentage).toBe('50%');
    });

    it('should format vp_percentage as (energy*100)+% for normal consumers', () => {
      component.key = buildKey({
        iterations: [
          {
            id: 1,
            number: 1,
            energy_allocated_percentage: 1,
            consumers: [{ id: 1, name: 'A', energy_allocated_percentage: 0.75 }],
          },
        ],
      });

      const rows = component.formatData();
      expect(rows[0].vp_percentage).toBe('75%');
    });

    it('should format vp_percentage as prorata label when energy is -1', () => {
      component.key = buildKey({
        iterations: [
          {
            id: 1,
            number: 1,
            energy_allocated_percentage: 1,
            consumers: [{ id: 1, name: 'A', energy_allocated_percentage: -1 }],
          },
        ],
      });

      const rows = component.formatData();
      expect(rows[0].vp_percentage).toBe('Prorata');
    });

    it('should set number field from iteration.number', () => {
      component.key = buildKey();
      const rows = component.formatData();
      expect(rows[0].number).toBe(1);
    });
  });

  // ── 4. newConsumer ───────────────────────────────────────────────

  describe('newConsumer', () => {
    beforeEach(async () => {
      await createComponent();
      setupGridApi();
    });

    it('should add a consumer with percentage 0 to every iteration', () => {
      component.key = buildKey({
        iterations: [
          {
            id: 1,
            number: 1,
            energy_allocated_percentage: 0.5,
            consumers: [{ id: 1, name: 'A', energy_allocated_percentage: 0.5 }],
          },
          {
            id: 2,
            number: 2,
            energy_allocated_percentage: 0.5,
            consumers: [{ id: 2, name: 'A', energy_allocated_percentage: 0.5 }],
          },
        ],
      });

      component.newConsumer();

      expect(component.key.iterations[0].consumers.length).toBe(2);
      expect(component.key.iterations[1].consumers.length).toBe(2);
      expect(component.key.iterations[0].consumers[1].energy_allocated_percentage).toBe(0);
    });

    it('should add a consumer with percentage -1 when iteration is prorata', () => {
      component.key = buildKey({
        iterations: [
          {
            id: 1,
            number: 1,
            energy_allocated_percentage: 1,
            consumers: [{ id: 1, name: 'A', energy_allocated_percentage: -1 }],
          },
        ],
      });

      component.newConsumer();

      expect(component.key.iterations[0].consumers[1].energy_allocated_percentage).toBe(-1);
    });

    it('should call refreshGrid', () => {
      component.key = buildKey();
      component.newConsumer();
      expect(gridApiMock.refreshCells).toHaveBeenCalled();
    });
  });

  // ── 5. newIterationCheck ─────────────────────────────────────────

  describe('newIterationCheck', () => {
    beforeEach(async () => {
      await createComponent();
      setupGridApi();
    });

    it('should return [1, [default consumer]] when no iterations', () => {
      component.key = buildEmptyKey();
      const [number, consumers] = component.newIterationCheck();
      expect(number).toBe(1);
      expect(consumers).toBeDefined();
      expect(consumers?.length).toBe(1);
      expect(consumers?.[0].energy_allocated_percentage).toBe(0);
    });

    it('should return [lastNumber+1, consumers] when iterations exist', () => {
      component.key = buildKey();
      const [number] = component.newIterationCheck();
      expect(number).toBe(2);
    });

    it('should return [-1, undefined] when already at 3 iterations', () => {
      component.key = buildKey({
        iterations: [
          {
            id: 1,
            number: 1,
            energy_allocated_percentage: 0.34,
            consumers: [{ id: 1, name: 'A', energy_allocated_percentage: 1 }],
          },
          {
            id: 2,
            number: 2,
            energy_allocated_percentage: 0.33,
            consumers: [{ id: 2, name: 'A', energy_allocated_percentage: 1 }],
          },
          {
            id: 3,
            number: 3,
            energy_allocated_percentage: 0.33,
            consumers: [{ id: 3, name: 'A', energy_allocated_percentage: 1 }],
          },
        ],
      });
      const [number, consumers] = component.newIterationCheck();
      expect(number).toBe(-1);
      expect(consumers).toBeUndefined();
    });
  });

  // ── 6. newIteration ──────────────────────────────────────────────

  describe('newIteration', () => {
    beforeEach(async () => {
      await createComponent();
      setupGridApi();
    });

    it('should add first iteration with one empty consumer and energy=1', () => {
      component.key = buildEmptyKey();
      component.newIteration();

      expect(component.key.iterations.length).toBe(1);
      expect(component.key.iterations[0].energy_allocated_percentage).toBe(1);
      expect(component.key.iterations[0].consumers.length).toBe(1);
      expect(component.key.iterations[0].consumers[0].name).toBe('');
    });

    it('should copy consumer names from previous iteration', () => {
      component.key = buildKey({
        iterations: [
          {
            id: 1,
            number: 1,
            energy_allocated_percentage: 1,
            consumers: [
              { id: 1, name: 'Consumer A', energy_allocated_percentage: 0.5 },
              { id: 2, name: 'Consumer B', energy_allocated_percentage: 0.5 },
            ],
          },
        ],
      });

      component.newIteration();

      expect(component.key.iterations.length).toBe(2);
      expect(component.key.iterations[1].consumers[0].name).toBe('Consumer A');
      expect(component.key.iterations[1].consumers[1].name).toBe('Consumer B');
    });

    it('should set new consumer percentages to 0 (not copied)', () => {
      component.key = buildKey({
        iterations: [
          {
            id: 1,
            number: 1,
            energy_allocated_percentage: 1,
            consumers: [{ id: 1, name: 'A', energy_allocated_percentage: 0.7 }],
          },
        ],
      });

      component.newIteration();

      expect(component.key.iterations[1].consumers[0].energy_allocated_percentage).toBe(0);
    });

    it('should do nothing when already at 3 iterations', () => {
      component.key = buildKey({
        iterations: [
          {
            id: 1,
            number: 1,
            energy_allocated_percentage: 0.34,
            consumers: [{ id: 1, name: 'A', energy_allocated_percentage: 1 }],
          },
          {
            id: 2,
            number: 2,
            energy_allocated_percentage: 0.33,
            consumers: [{ id: 2, name: 'A', energy_allocated_percentage: 1 }],
          },
          {
            id: 3,
            number: 3,
            energy_allocated_percentage: 0.33,
            consumers: [{ id: 3, name: 'A', energy_allocated_percentage: 1 }],
          },
        ],
      });

      component.newIteration();

      expect(component.key.iterations.length).toBe(3);
    });
  });

  // ── 7. newIterationProrata ───────────────────────────────────────

  describe('newIterationProrata', () => {
    beforeEach(async () => {
      await createComponent();
      setupGridApi();
    });

    it('should add iteration with all consumer percentages set to -1', () => {
      component.key = buildEmptyKey();
      component.newIterationProrata();

      expect(component.key.iterations.length).toBe(1);
      component.key.iterations[0].consumers.forEach((c) => {
        expect(c.energy_allocated_percentage).toBe(-1);
      });
    });

    it('should copy consumer names from previous iteration', () => {
      component.key = buildKey({
        iterations: [
          {
            id: 1,
            number: 1,
            energy_allocated_percentage: 1,
            consumers: [
              { id: 1, name: 'X', energy_allocated_percentage: 0.5 },
              { id: 2, name: 'Y', energy_allocated_percentage: 0.5 },
            ],
          },
        ],
      });

      component.newIterationProrata();

      expect(component.key.iterations[1].consumers[0].name).toBe('X');
      expect(component.key.iterations[1].consumers[1].name).toBe('Y');
      expect(component.key.iterations[1].consumers[0].energy_allocated_percentage).toBe(-1);
      expect(component.key.iterations[1].consumers[1].energy_allocated_percentage).toBe(-1);
    });

    it('should set energy_allocated_percentage to 1 on the iteration itself', () => {
      component.key = buildEmptyKey();
      component.newIterationProrata();
      expect(component.key.iterations[0].energy_allocated_percentage).toBe(1);
    });

    it('should do nothing when already at 3 iterations', () => {
      component.key = buildKey({
        iterations: [
          {
            id: 1,
            number: 1,
            energy_allocated_percentage: 0.34,
            consumers: [{ id: 1, name: 'A', energy_allocated_percentage: 1 }],
          },
          {
            id: 2,
            number: 2,
            energy_allocated_percentage: 0.33,
            consumers: [{ id: 2, name: 'A', energy_allocated_percentage: 1 }],
          },
          {
            id: 3,
            number: 3,
            energy_allocated_percentage: 0.33,
            consumers: [{ id: 3, name: 'A', energy_allocated_percentage: 1 }],
          },
        ],
      });

      component.newIterationProrata();

      expect(component.key.iterations.length).toBe(3);
    });
  });

  // ── 8. deleteIteration ───────────────────────────────────────────

  describe('deleteIteration', () => {
    beforeEach(async () => {
      await createComponent();
      setupGridApi();
    });

    it('should remove the iteration matching params.rowData.number', () => {
      component.key = buildKey({
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
            consumers: [{ id: 2, name: 'A', energy_allocated_percentage: 1 }],
          },
        ],
      });

      component.deleteIteration({
        event: new MouseEvent('click'),
        rowData: { number: 1, name: 'A', vp_percentage: '100%' },
      });

      expect(component.key.iterations.length).toBe(1);
    });

    it('should renumber subsequent iterations after deletion', () => {
      component.key = buildKey({
        iterations: [
          {
            id: 1,
            number: 1,
            energy_allocated_percentage: 0.34,
            consumers: [{ id: 1, name: 'A', energy_allocated_percentage: 1 }],
          },
          {
            id: 2,
            number: 2,
            energy_allocated_percentage: 0.33,
            consumers: [{ id: 2, name: 'A', energy_allocated_percentage: 1 }],
          },
          {
            id: 3,
            number: 3,
            energy_allocated_percentage: 0.33,
            consumers: [{ id: 3, name: 'A', energy_allocated_percentage: 1 }],
          },
        ],
      });

      component.deleteIteration({
        event: new MouseEvent('click'),
        rowData: { number: 1, name: 'A', vp_percentage: '100%' },
      });

      expect(component.key.iterations.length).toBe(2);
      expect(component.key.iterations[0].number).toBe(1);
      expect(component.key.iterations[1].number).toBe(2);
    });

    it('should handle deleting the only iteration', () => {
      component.key = buildKey();

      component.deleteIteration({
        event: new MouseEvent('click'),
        rowData: { number: 1, name: 'A', vp_percentage: '100%' },
      });

      expect(component.key.iterations.length).toBe(0);
    });

    it('should call refreshGrid', () => {
      component.key = buildKey();
      component.deleteIteration({
        event: new MouseEvent('click'),
        rowData: { number: 1, name: 'A', vp_percentage: '100%' },
      });
      expect(gridApiMock.refreshCells).toHaveBeenCalled();
    });
  });

  // ── 9. deleteConsumer ────────────────────────────────────────────

  describe('deleteConsumer', () => {
    beforeEach(async () => {
      await createComponent();
      setupGridApi();
    });

    it('should remove consumer by name from all iterations', () => {
      component.key = buildKey({
        iterations: [
          {
            id: 1,
            number: 1,
            energy_allocated_percentage: 0.5,
            consumers: [
              { id: 1, name: 'A', energy_allocated_percentage: 0.5 },
              { id: 2, name: 'B', energy_allocated_percentage: 0.5 },
            ],
          },
          {
            id: 2,
            number: 2,
            energy_allocated_percentage: 0.5,
            consumers: [
              { id: 3, name: 'A', energy_allocated_percentage: 0.5 },
              { id: 4, name: 'B', energy_allocated_percentage: 0.5 },
            ],
          },
        ],
      });

      component.deleteConsumer({
        event: new MouseEvent('click'),
        rowData: { number: 1, name: 'A', vp_percentage: '50%' },
      });

      expect(component.key.iterations[0].consumers.length).toBe(1);
      expect(component.key.iterations[0].consumers[0].name).toBe('B');
      expect(component.key.iterations[1].consumers.length).toBe(1);
      expect(component.key.iterations[1].consumers[0].name).toBe('B');
    });

    it('should clear all iterations if last consumer is deleted', () => {
      component.key = buildKey();

      component.deleteConsumer({
        event: new MouseEvent('click'),
        rowData: { number: 1, name: 'Consumer A', vp_percentage: '100%' },
      });

      expect(component.key.iterations.length).toBe(0);
    });

    it('should call refreshGrid', () => {
      component.key = buildKey();
      component.deleteConsumer({
        event: new MouseEvent('click'),
        rowData: { number: 1, name: 'Consumer A', vp_percentage: '100%' },
      });
      expect(gridApiMock.refreshCells).toHaveBeenCalled();
    });
  });

  // ── 10. keyValidator ─────────────────────────────────────────────

  describe('keyValidator', () => {
    beforeEach(async () => {
      await createComponent();
      setupGridApi();
    });

    /** Triggers the key_data custom validator and returns its errors. */
    function revalidate(): Record<string, unknown> | null {
      component.formGroup.get('key_data')?.updateValueAndValidity();
      return component.formGroup.get('key_data')?.errors ?? null;
    }

    it('should return NoIteration when iterations is empty', () => {
      component.key = buildEmptyKey();
      const errors = revalidate();
      expect(errors?.['NoIteration']).toBe(true);
    });

    it('should return NoConsumers when first iteration has no consumers', () => {
      component.key = buildKey({
        iterations: [{ id: 1, number: 1, energy_allocated_percentage: 1, consumers: [] }],
      });
      const errors = revalidate();
      expect(errors?.['NoConsumers']).toBe(true);
    });

    it('should return SumIterations when iteration energy sum is not 1', () => {
      component.key = buildKey({
        iterations: [
          {
            id: 1,
            number: 1,
            energy_allocated_percentage: 0.3,
            consumers: [{ id: 1, name: 'A', energy_allocated_percentage: 1 }],
          },
          {
            id: 2,
            number: 2,
            energy_allocated_percentage: 0.3,
            consumers: [{ id: 2, name: 'A', energy_allocated_percentage: 1 }],
          },
        ],
      });
      const errors = revalidate();
      expect(errors?.['SumIterations']).toBe(true);
    });

    it('should pass when iteration energy sum equals 1', () => {
      component.key = buildKey();
      const errors = revalidate();
      expect(errors?.['SumIterations']).toBeFalsy();
    });

    it('should return SumConsumers when consumer percentages do not sum to 1', () => {
      component.key = buildKey({
        iterations: [
          {
            id: 1,
            number: 1,
            energy_allocated_percentage: 1,
            consumers: [
              { id: 1, name: 'A', energy_allocated_percentage: 0.3 },
              { id: 2, name: 'B', energy_allocated_percentage: 0.3 },
            ],
          },
        ],
      });
      const errors = revalidate();
      expect(errors?.['SumConsumers']).toBe(true);
    });

    it('should accept consumer sums between 0.999 and 1.001 (tolerance)', () => {
      component.key = buildKey({
        iterations: [
          {
            id: 1,
            number: 1,
            energy_allocated_percentage: 1,
            consumers: [
              { id: 1, name: 'A', energy_allocated_percentage: 0.3333 },
              { id: 2, name: 'B', energy_allocated_percentage: 0.3333 },
              { id: 3, name: 'C', energy_allocated_percentage: 0.3334 },
            ],
          },
        ],
      });
      const errors = revalidate();
      expect(errors?.['SumConsumers']).toBeFalsy();
    });

    it('should pass prorata iterations (all consumers at -1)', () => {
      component.key = buildKey({
        iterations: [
          {
            id: 1,
            number: 1,
            energy_allocated_percentage: 1,
            consumers: [
              { id: 1, name: 'A', energy_allocated_percentage: -1 },
              { id: 2, name: 'B', energy_allocated_percentage: -1 },
            ],
          },
        ],
      });
      const errors = revalidate();
      expect(errors?.['SumConsumers']).toBeFalsy();
    });

    it('should return ConsumerName when any consumer has empty name', () => {
      component.key = buildKey({
        iterations: [
          {
            id: 1,
            number: 1,
            energy_allocated_percentage: 1,
            consumers: [{ id: 1, name: '', energy_allocated_percentage: 1 }],
          },
        ],
      });
      const errors = revalidate();
      expect(errors?.['ConsumerName']).toBe(true);
    });

    it('should not return NoChange when keyInput is null (create mode)', () => {
      component.key = buildKey();
      component.keyInput = null;
      const errors = revalidate();
      expect(errors?.['NoChange']).toBeFalsy();
    });

    it('should return empty errors for a fully valid key', () => {
      component.key = buildKey();
      component.keyInput = null;
      const errors = revalidate();
      expect(errors).toEqual(null);
    });
  });

  // ── 11. onSubmit ─────────────────────────────────────────────────

  describe('onSubmit', () => {
    beforeEach(async () => {
      await createComponent();
      setupGridApi();
    });

    it('should set isSubmitted to true', () => {
      component.key = buildKey();
      component.onSubmit();
      expect(component.isSubmitted()).toBe(true);
    });

    it('should return early if form is invalid', () => {
      component.key = buildEmptyKey();
      component.formGroup.get('name')?.setValue('');
      component.onSubmit();
      expect(keyServiceSpy.addKey).not.toHaveBeenCalled();
      expect(keyServiceSpy.updateKey).not.toHaveBeenCalled();
    });

    it('should call addKey when keyInput is falsy (create mode)', () => {
      component.key = buildKey();
      component.keyInput = null;
      component.formGroup.get('name')?.setValue('New Key');
      component.formGroup.get('description')?.setValue('New Desc');
      keyServiceSpy.addKey.mockReturnValue(of(new ApiResponse('ok')));

      component.onSubmit();

      expect(keyServiceSpy.addKey).toHaveBeenCalled();
      expect(component.key.name).toBe('New Key');
      expect(component.key.description).toBe('New Desc');
    });

    it('should call updateKey when keyInput is truthy (update mode)', () => {
      const key = buildKey();
      component.key = key;
      component.keyInput = structuredClone(key);
      // Change the name so NoChange validator doesn't fire
      component.formGroup.get('name')?.setValue('Updated Name');
      component.formGroup.get('description')?.setValue('Test Description');
      keyServiceSpy.updateKey.mockReturnValue(of(new ApiResponse('ok')));

      component.onSubmit();

      expect(keyServiceSpy.updateKey).toHaveBeenCalled();
    });

    it('should show success snackbar and navigate on successful add', () => {
      component.key = buildKey();
      component.keyInput = null;
      component.formGroup.get('name')?.setValue('New Key');
      component.formGroup.get('description')?.setValue('New Desc');
      keyServiceSpy.addKey.mockReturnValue(of(new ApiResponse('ok')));

      component.onSubmit();

      expect(snackbarSpy.openSnackBar).toHaveBeenCalledWith('Key added', VALIDATION_TYPE);
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/keys']);
    });

    it('should show success snackbar and navigate on successful update', () => {
      const key = buildKey();
      component.key = key;
      component.keyInput = structuredClone(key);
      component.formGroup.get('name')?.setValue('Updated');
      component.formGroup.get('description')?.setValue('Test Description');
      keyServiceSpy.updateKey.mockReturnValue(of(new ApiResponse('ok')));

      component.onSubmit();

      expect(snackbarSpy.openSnackBar).toHaveBeenCalledWith('Key updated', VALIDATION_TYPE);
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/keys']);
    });

    it('should call errorHandler when add returns null', () => {
      component.key = buildKey();
      component.keyInput = null;
      component.formGroup.get('name')?.setValue('New Key');
      component.formGroup.get('description')?.setValue('New Desc');
      keyServiceSpy.addKey.mockReturnValue(of(null));

      component.onSubmit();

      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });

    it('should call errorHandler with data on add ApiResponse error', () => {
      component.key = buildKey();
      component.keyInput = null;
      component.formGroup.get('name')?.setValue('New Key');
      component.formGroup.get('description')?.setValue('New Desc');
      const apiError = new ApiResponse('Add failed');
      keyServiceSpy.addKey.mockReturnValue(throwError(() => apiError));

      component.onSubmit();

      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith('Add failed');
    });

    it('should call errorHandler with null on add non-ApiResponse error', () => {
      component.key = buildKey();
      component.keyInput = null;
      component.formGroup.get('name')?.setValue('New Key');
      component.formGroup.get('description')?.setValue('New Desc');
      keyServiceSpy.addKey.mockReturnValue(throwError(() => new Error('generic')));

      component.onSubmit();

      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(null);
    });
  });

  // ── 12. onCellValueChanged ───────────────────────────────────────

  describe('onCellValueChanged', () => {
    beforeEach(async () => {
      await createComponent();
      setupGridApi();
      component.key = buildKey({
        iterations: [
          {
            id: 1,
            number: 1,
            energy_allocated_percentage: 0.5,
            consumers: [
              { id: 1, name: 'A', energy_allocated_percentage: 0.5 },
              { id: 2, name: 'B', energy_allocated_percentage: 0.5 },
            ],
          },
          {
            id: 2,
            number: 2,
            energy_allocated_percentage: 0.5,
            consumers: [
              { id: 3, name: 'A', energy_allocated_percentage: 0.5 },
              { id: 4, name: 'B', energy_allocated_percentage: 0.5 },
            ],
          },
        ],
      });
      component.rowData.set(component.formatData());
    });

    it('should return early if data is undefined', () => {
      const event = { colDef: { field: 'name' }, data: undefined } as unknown as NewValueParams<
        KeyTableRow,
        string
      >;
      component.onCellValueChanged(event);
      // No error thrown
    });

    it('should return early if colId is undefined', () => {
      const event = { colDef: {}, data: { number: 1, name: 'A' } } as unknown as NewValueParams<
        KeyTableRow,
        string
      >;
      component.onCellValueChanged(event);
      // No error thrown
    });

    it('should parse va_percentage, divide by 100, and update iteration energy', () => {
      const data: KeyTableRow = { number: 1, name: 'A', vp_percentage: '50%', va_percentage: '60' };
      const event = {
        colDef: { field: 'va_percentage' },
        data,
        node: { rowIndex: 0 },
      } as unknown as NewValueParams<KeyTableRow, string>;

      component.onCellValueChanged(event);

      expect(component.key.iterations[0].energy_allocated_percentage).toBeCloseTo(0.6);
    });

    it('should strip % and re-append it for va_percentage', () => {
      const data: KeyTableRow = {
        number: 1,
        name: 'A',
        vp_percentage: '50%',
        va_percentage: '60%',
      };
      const event = {
        colDef: { field: 'va_percentage' },
        data,
        node: { rowIndex: 0 },
      } as unknown as NewValueParams<KeyTableRow, string>;

      component.onCellValueChanged(event);

      expect(data.va_percentage).toBe('60');
    });

    it('should set va_percentage to empty string if non-numeric', () => {
      const data: KeyTableRow = {
        number: 1,
        name: 'A',
        vp_percentage: '50%',
        va_percentage: 'abc',
      };
      const event = {
        colDef: { field: 'va_percentage' },
        data,
        node: { rowIndex: 0 },
      } as unknown as NewValueParams<KeyTableRow, string>;

      component.onCellValueChanged(event);

      expect(data.va_percentage).toBe('');
    });

    it('should leave iteration energy unchanged when va_percentage is non-numeric', () => {
      const data: KeyTableRow = {
        number: 1,
        name: 'A',
        vp_percentage: '50%',
        va_percentage: 'abc',
      };
      const event = {
        colDef: { field: 'va_percentage' },
        data,
        node: { rowIndex: 0 },
      } as unknown as NewValueParams<KeyTableRow, string>;

      component.onCellValueChanged(event);

      expect(component.key.iterations[0].energy_allocated_percentage).toBeCloseTo(0.5);
    });

    it('should propagate va_percentage to all rows of the same iteration', () => {
      const data: KeyTableRow = { number: 1, name: 'B', vp_percentage: '50%', va_percentage: '70' };
      const event = {
        colDef: { field: 'va_percentage' },
        data,
        node: { rowIndex: 1 },
      } as unknown as NewValueParams<KeyTableRow, string>;

      component.onCellValueChanged(event);

      const iterationOneRows = component.rowData().filter((r) => r.number === 1);
      const iterationTwoRows = component.rowData().filter((r) => r.number === 2);
      expect(iterationOneRows.length).toBeGreaterThan(1);
      for (const row of iterationOneRows) {
        expect(row.va_percentage).toBe('70%');
      }
      for (const row of iterationTwoRows) {
        expect(row.va_percentage).toBe('50%');
      }
    });

    it('should parse vp_percentage and update consumer energy', () => {
      const data: KeyTableRow = { number: 1, name: 'A', vp_percentage: '80', va_percentage: '50%' };
      const event = {
        colDef: { field: 'vp_percentage' },
        data,
        node: { rowIndex: 0 },
      } as unknown as NewValueParams<KeyTableRow, string>;

      component.onCellValueChanged(event);

      expect(component.key.iterations[0].consumers[0].energy_allocated_percentage).toBeCloseTo(0.8);
    });

    it('should update consumer name across all iterations at same index', () => {
      const data: KeyTableRow = {
        number: 1,
        name: 'NewName',
        vp_percentage: '50%',
        va_percentage: '50%',
      };
      const event = {
        colDef: { field: 'name' },
        data,
        node: { rowIndex: 0 },
      } as unknown as NewValueParams<KeyTableRow, string>;

      component.onCellValueChanged(event);

      expect(component.key.iterations[0].consumers[0].name).toBe('NewName');
      expect(component.key.iterations[1].consumers[0].name).toBe('NewName');
    });
  });

  // ── 13. onGridReady ──────────────────────────────────────────────

  describe('onGridReady', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should store event.api as gridApi', () => {
      const api = { refreshCells: vi.fn() } as unknown as GridApi;
      component.onGridReady({ api } as unknown as GridReadyEvent);
      expect(component.gridApi).toBe(api);
    });

    it('should clear displayedNumbers static set', () => {
      KeyCreationUpdate.displayedNumbers.add(1);
      KeyCreationUpdate.displayedNumbers.add(2);

      component.onGridReady({ api: gridApiMock } as unknown as GridReadyEvent);

      expect(KeyCreationUpdate.displayedNumbers.size).toBe(0);
    });

    it('should re-set rowData when keyInput is set', () => {
      component.key = buildKey();
      component.keyInput = buildKey();
      const spy = vi.spyOn(component.rowData, 'set');

      component.onGridReady({ api: gridApiMock } as unknown as GridReadyEvent);

      expect(spy).toHaveBeenCalled();
    });
  });

  // ── 14. openHelper & ngOnDestroy ─────────────────────────────────

  describe('openHelper', () => {
    beforeEach(async () => {
      await createComponent();
      setupGridApi();
    });

    it('should call dialogService.open with display text', () => {
      component.openHelper('Some tooltip text');

      expect(dialogServiceSpy.open).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          modal: true,
          closable: true,
          closeOnEscape: true,
          data: { displayText: 'Some tooltip text' },
        }),
      );
    });
  });

  describe('ngOnDestroy', () => {
    beforeEach(async () => {
      await createComponent();
      setupGridApi();
    });

    it('should destroy ref when it exists', () => {
      const destroyFn = vi.fn();
      component.ref = { destroy: destroyFn } as unknown as typeof component.ref;

      component.ngOnDestroy();

      expect(destroyFn).toHaveBeenCalled();
    });

    it('should not throw when ref is null', () => {
      component.ref = null;
      expect(() => component.ngOnDestroy()).not.toThrow();
    });

    it('should not throw when ref is undefined', () => {
      component.ref = undefined;
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  // ── 15. cellStyleNumber ──────────────────────────────────────────

  describe('cellStyleNumber', () => {
    beforeEach(async () => {
      await createComponent();
      setupGridApi();
    });

    it('should return first color gradient for iteration number 1', () => {
      const params = { node: { data: { number: 1 } } } as unknown as Parameters<
        typeof component.cellStyleNumber
      >[0];
      const result = component.cellStyleNumber(params);
      expect(result.backgroundColor).toBe('#e8f5e9');
    });

    it('should return second color gradient for iteration number 2', () => {
      const params = { node: { data: { number: 2 } } } as unknown as Parameters<
        typeof component.cellStyleNumber
      >[0];
      const result = component.cellStyleNumber(params);
      expect(result.backgroundColor).toBe('#c8e6c9');
    });

    it('should return third color gradient for iteration number 3', () => {
      const params = { node: { data: { number: 3 } } } as unknown as Parameters<
        typeof component.cellStyleNumber
      >[0];
      const result = component.cellStyleNumber(params);
      expect(result.backgroundColor).toBe('#a5d6a7');
    });

    it('should update static lastNumberCellStyleNumber', () => {
      const params = { node: { data: { number: 2 } } } as unknown as Parameters<
        typeof component.cellStyleNumber
      >[0];
      component.cellStyleNumber(params);
      expect(KeyCreationUpdate.lastNumberCellStyleNumber).toBe(2);
    });
  });
});
