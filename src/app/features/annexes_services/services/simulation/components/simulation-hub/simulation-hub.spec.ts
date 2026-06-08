import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import {
  ApiResponse,
  ApiResponsePaginated,
  Pagination,
} from '../../../../../../core/dtos/api.response';
import { VALIDATION_TYPE } from '../../../../../../core/dtos/notification';
import {
  SimulationDetailDTO,
  SimulationPartialDTO,
  SimulationStatus,
} from '../../../../../../shared/dtos/simulation.dtos';
import { SimulationService } from '../../../../../../shared/services/simulation.service';
import { ErrorMessageHandler } from '../../../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../../../shared/services-ui/snackbar.notifcation.service';
import { SimulationHub } from './simulation-hub';

// ── Helpers ──────────────────────────────────────────────────────────

function buildRun(overrides: Partial<SimulationPartialDTO> = {}): SimulationPartialDTO {
  return {
    id: 1,
    name: 'run-1',
    status: SimulationStatus.SUCCESS,
    id_key: 10,
    key_name: 'key-10',
    ...overrides,
  };
}

function buildDetail(overrides: Partial<SimulationDetailDTO> = {}): SimulationDetailDTO {
  return {
    ...buildRun(),
    error_message: null,
    has_timeseries: false,
    key_result: null,
    ...overrides,
  };
}

function listResponse(
  runs: SimulationPartialDTO[],
  pagination = new Pagination(1, 20, runs.length, 1),
): ApiResponsePaginated<SimulationPartialDTO[]> {
  return new ApiResponsePaginated(runs, pagination);
}

// ── Test Suite ───────────────────────────────────────────────────────

describe('SimulationHub', () => {
  let component: SimulationHub;
  let fixture: ComponentFixture<SimulationHub>;

  let serviceSpy: {
    listSimulations: ReturnType<typeof vi.fn>;
    getSimulation: ReturnType<typeof vi.fn>;
    deleteSimulation: ReturnType<typeof vi.fn>;
    invalidate: ReturnType<typeof vi.fn>;
  };
  let snackbarSpy: { openSnackBar: ReturnType<typeof vi.fn> };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };
  let confirmationSpy: { confirm: ReturnType<typeof vi.fn> };
  let translateSpy: {
    instant: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    onLangChange: { subscribe: ReturnType<typeof vi.fn> };
    onTranslationChange: { subscribe: ReturnType<typeof vi.fn> };
    onDefaultLangChange: { subscribe: ReturnType<typeof vi.fn> };
  };

  async function createComponent(initialize = true): Promise<void> {
    fixture = TestBed.createComponent(SimulationHub);
    component = fixture.componentInstance;
    if (initialize) {
      component.ngOnInit();
    }
    await fixture.whenStable();
  }

  function fireAccept(): void {
    const calls = confirmationSpy.confirm.mock.calls;
    const args = calls[calls.length - 1][0] as Confirmation;
    (args.accept as () => void)();
  }

  beforeEach(async () => {
    serviceSpy = {
      listSimulations: vi.fn().mockReturnValue(of(listResponse([buildRun()]))),
      getSimulation: vi.fn().mockReturnValue(of(new ApiResponse(buildDetail()))),
      deleteSimulation: vi.fn().mockReturnValue(of(new ApiResponse('ok'))),
      invalidate: vi.fn(),
    };
    snackbarSpy = { openSnackBar: vi.fn() };
    errorHandlerSpy = { handleError: vi.fn() };
    confirmationSpy = { confirm: vi.fn() };
    translateSpy = {
      instant: vi.fn((k: string) => k),
      get: vi.fn(() => of({})),
      onLangChange: { subscribe: vi.fn() },
      onTranslationChange: { subscribe: vi.fn() },
      onDefaultLangChange: { subscribe: vi.fn() },
    };

    await TestBed.configureTestingModule({
      imports: [SimulationHub],
      providers: [
        { provide: SimulationService, useValue: serviceSpy },
        { provide: SnackbarNotification, useValue: snackbarSpy },
        { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
        { provide: TranslateService, useValue: translateSpy },
      ],
    })
      .overrideComponent(SimulationHub, {
        set: {
          template: '',
          providers: [
            { provide: ConfirmationService, useValue: confirmationSpy },
            { provide: MessageService, useValue: { add: vi.fn() } },
          ],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();
  });

  // ── 1. Creation & initialization ───────────────────────────────────

  describe('initialization', () => {
    it('should create the component', async () => {
      await createComponent(false);
      expect(component).toBeTruthy();
    });

    it('should load runs on ngOnInit', async () => {
      await createComponent();
      expect(serviceSpy.listSimulations).toHaveBeenCalled();
    });

    it('should expose default signal values before loading', async () => {
      serviceSpy.listSimulations.mockReturnValue(new Subject());
      await createComponent(false);
      expect(component.runs()).toEqual([]);
      expect(component.runsLoading()).toBe(true);
      expect(component.expandedId()).toBeNull();
      expect(component.detailById().size).toBe(0);
      expect(component.detailLoadingId()).toBeNull();
      expect(component.lastRefreshedAt()).toBeNull();
    });
  });

  // ── 2. loadRuns ────────────────────────────────────────────────────

  describe('loadRuns', () => {
    it('should populate runs, pagination and refresh time on success', async () => {
      const runs = [buildRun({ id: 1 }), buildRun({ id: 2 })];
      serviceSpy.listSimulations.mockReturnValue(
        of(listResponse(runs, new Pagination(1, 20, 2, 1))),
      );
      await createComponent();
      expect(component.runs()).toEqual(runs);
      expect(component.pagination().total).toBe(2);
      expect(component.runsLoading()).toBe(false);
      expect(component.lastRefreshedAt()).not.toBeNull();
    });

    it('should fall back to an empty list when the payload is not an array', async () => {
      serviceSpy.listSimulations.mockReturnValue(
        of(new ApiResponsePaginated('error', new Pagination())),
      );
      await createComponent();
      expect(component.runs()).toEqual([]);
      expect(component.runsLoading()).toBe(false);
    });

    it('should clear loading and report errors on failure', async () => {
      serviceSpy.listSimulations.mockReturnValue(throwError(() => new ApiResponse('boom')));
      await createComponent();
      expect(component.runsLoading()).toBe(false);
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith('boom');
    });

    it('should request the page passed to loadRuns', async () => {
      await createComponent();
      serviceSpy.listSimulations.mockClear();
      component.loadRuns(3);
      expect(serviceSpy.listSimulations).toHaveBeenCalledWith(expect.objectContaining({ page: 3 }));
      expect(component.filter().page).toBe(3);
    });
  });

  // ── 3. Computed signals ────────────────────────────────────────────

  describe('computed signals', () => {
    it('hasMorePages should reflect total_pages > 1', async () => {
      serviceSpy.listSimulations.mockReturnValue(
        of(listResponse([buildRun()], new Pagination(1, 20, 60, 3))),
      );
      await createComponent();
      expect(component.hasMorePages()).toBe(true);
    });

    it('hasPending should be true when any run is pending', async () => {
      await createComponent();
      component.runs.set([buildRun({ status: SimulationStatus.SUCCESS })]);
      expect(component.hasPending()).toBe(false);
      component.runs.set([buildRun({ status: SimulationStatus.PENDING })]);
      expect(component.hasPending()).toBe(true);
    });
  });

  // ── 4. Navigation & refresh ────────────────────────────────────────

  describe('navigation & refresh', () => {
    it('refresh should invalidate the cache and reload the current page', async () => {
      await createComponent();
      serviceSpy.listSimulations.mockClear();
      component.refresh();
      expect(serviceSpy.invalidate).toHaveBeenCalled();
      expect(serviceSpy.listSimulations).toHaveBeenCalled();
    });

    it('onLaunched should trigger a refresh', async () => {
      await createComponent();
      serviceSpy.invalidate.mockClear();
      component.onLaunched();
      expect(serviceSpy.invalidate).toHaveBeenCalled();
    });

    it('goToPage should ignore out-of-range pages', async () => {
      serviceSpy.listSimulations.mockReturnValue(
        of(listResponse([buildRun()], new Pagination(1, 20, 40, 2))),
      );
      await createComponent();
      serviceSpy.listSimulations.mockClear();
      component.goToPage(0);
      component.goToPage(3);
      expect(serviceSpy.listSimulations).not.toHaveBeenCalled();
    });

    it('goToPage should load a valid page', async () => {
      serviceSpy.listSimulations.mockReturnValue(
        of(listResponse([buildRun()], new Pagination(1, 20, 40, 2))),
      );
      await createComponent();
      serviceSpy.listSimulations.mockClear();
      component.goToPage(2);
      expect(serviceSpy.listSimulations).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
    });
  });

  // ── 5. Expansion & detail loading ──────────────────────────────────

  describe('toggleRun & loadDetail', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should expand a run and load its detail on first open', () => {
      component.toggleRun(1);
      expect(component.expandedId()).toBe(1);
      expect(serviceSpy.getSimulation).toHaveBeenCalledWith(1);
      expect(component.detailFor(1)).toEqual(buildDetail());
      expect(component.detailLoadingId()).toBeNull();
    });

    it('should collapse without refetching when toggled again', () => {
      component.toggleRun(1);
      serviceSpy.getSimulation.mockClear();
      component.toggleRun(1);
      expect(component.expandedId()).toBeNull();
      expect(serviceSpy.getSimulation).not.toHaveBeenCalled();
    });

    it('should not refetch a cached non-pending detail when reopened', () => {
      component.toggleRun(1); // load (SUCCESS)
      component.toggleRun(1); // collapse
      serviceSpy.getSimulation.mockClear();
      component.toggleRun(1); // reopen
      expect(serviceSpy.getSimulation).not.toHaveBeenCalled();
    });

    it('should refetch a cached pending detail when reopened', () => {
      serviceSpy.getSimulation.mockReturnValue(
        of(new ApiResponse(buildDetail({ status: SimulationStatus.PENDING }))),
      );
      component.toggleRun(1); // load (PENDING)
      component.toggleRun(1); // collapse
      serviceSpy.getSimulation.mockClear();
      component.toggleRun(1); // reopen → pending cache is stale
      expect(serviceSpy.getSimulation).toHaveBeenCalledWith(1);
    });

    it('should ignore a string detail payload', () => {
      serviceSpy.getSimulation.mockReturnValue(of(new ApiResponse('error')));
      component.toggleRun(1);
      expect(component.detailFor(1)).toBeUndefined();
      expect(component.detailLoadingId()).toBeNull();
    });

    it('should clear loading and report errors when detail loading fails', () => {
      serviceSpy.getSimulation.mockReturnValue(throwError(() => new ApiResponse('boom')));
      component.toggleRun(1);
      expect(component.detailLoadingId()).toBeNull();
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith('boom');
    });
  });

  // ── 6. Delete with confirmation ────────────────────────────────────

  describe('deleteRun', () => {
    beforeEach(async () => {
      await createComponent(); // runs() now holds run id 1
    });

    it('should confirm, delete, notify and remove the run on accept', () => {
      component.toggleRun(1); // cache its detail + mark it expanded
      expect(component.detailFor(1)).toBeDefined();

      component.deleteRun(1);
      expect(confirmationSpy.confirm).toHaveBeenCalled();
      fireAccept();

      expect(serviceSpy.deleteSimulation).toHaveBeenCalledWith(1);
      expect(snackbarSpy.openSnackBar).toHaveBeenCalledWith(
        'SIMULATION_HUB.SUCCESS.RUN_DELETED',
        VALIDATION_TYPE,
      );
      expect(component.runs().find((r) => r.id === 1)).toBeUndefined();
      expect(component.detailFor(1)).toBeUndefined();
      expect(component.expandedId()).toBeNull();
    });

    it('should report errors when the delete fails', () => {
      serviceSpy.deleteSimulation.mockReturnValue(throwError(() => new ApiResponse('nope')));
      component.deleteRun(1);
      fireAccept();
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith('nope');
    });
  });

  // ── 7. Template helpers ────────────────────────────────────────────

  describe('template helpers', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('isExpanded should reflect the expanded id', () => {
      expect(component.isExpanded(1)).toBe(false);
      component.toggleRun(1);
      expect(component.isExpanded(1)).toBe(true);
    });

    it('isDetailLoading should be true only while the matching detail loads', () => {
      serviceSpy.getSimulation.mockReturnValue(new Subject()); // never completes
      component.toggleRun(1);
      expect(component.isDetailLoading(1)).toBe(true);
      expect(component.isDetailLoading(2)).toBe(false);
    });

    it('detailFor should return the cached detail or undefined', () => {
      expect(component.detailFor(1)).toBeUndefined();
      component.toggleRun(1);
      expect(component.detailFor(1)).toEqual(buildDetail());
    });
  });
});
