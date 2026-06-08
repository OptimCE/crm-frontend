import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ApiResponse } from '../../../../../../core/dtos/api.response';
import {
  SimulationConsumerResultDTO,
  SimulationDetailDTO,
  SimulationIterationResultDTO,
  SimulationKeyResultDTO,
  SimulationStatus,
  SimulationTimeseriesDTO,
} from '../../../../../../shared/dtos/simulation.dtos';
import { SimulationService } from '../../../../../../shared/services/simulation.service';
import { ErrorMessageHandler } from '../../../../../../shared/services-ui/error.message.handler';
import { SimulationResults } from './simulation-results';

// ── Helpers ──────────────────────────────────────────────────────────

function buildConsumer(
  overrides: Partial<SimulationConsumerResultDTO> = {},
): SimulationConsumerResultDTO {
  return {
    name: 'consumer-1',
    energy_allocated_percentage: 50,
    consumption_total: 100,
    energy_allocated_total: 60,
    energy_allocated_consumed_total: 40,
    residual_volume_total: 60,
    surplus_total: 20,
    ...overrides,
  };
}

function buildIterationResult(
  overrides: Partial<SimulationIterationResultDTO> = {},
): SimulationIterationResultDTO {
  return {
    number: 1,
    energy_allocated_percentage: 100,
    consumption_total: 100,
    energy_allocated_total: 60,
    energy_allocated_consumed_total: 40,
    residual_volume_total: 60,
    surplus_total: 20,
    sharing_rate_total: 0.5,
    self_sufficiency_rate_total: 0.4,
    consumers: [buildConsumer()],
    ...overrides,
  };
}

function buildKeyResult(overrides: Partial<SimulationKeyResultDTO> = {}): SimulationKeyResultDTO {
  return {
    name: 'key-1',
    description: 'a key',
    consumption_total: 100,
    energy_allocated_total: 60,
    energy_allocated_consumed_total: 40,
    residual_volume_total: 60,
    surplus_total: 20,
    self_sufficiency_rate_total: 0.4,
    sharing_rate_total: 0.5,
    iterations: [buildIterationResult()],
    ...overrides,
  };
}

function buildDetail(overrides: Partial<SimulationDetailDTO> = {}): SimulationDetailDTO {
  return {
    id: 1,
    name: 'run-1',
    status: SimulationStatus.SUCCESS,
    id_key: 10,
    key_name: 'key-10',
    error_message: null,
    has_timeseries: true,
    key_result: buildKeyResult(),
    ...overrides,
  };
}

function timeseries(): SimulationTimeseriesDTO {
  return { iterations: [] };
}

// ── Test Suite ───────────────────────────────────────────────────────

describe('SimulationResults', () => {
  let component: SimulationResults;
  let fixture: ComponentFixture<SimulationResults>;

  let serviceSpy: { getTimeseries: ReturnType<typeof vi.fn> };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };

  function setDetail(detail: SimulationDetailDTO): void {
    fixture.componentRef.setInput('detail', detail);
    fixture.detectChanges(); // flush the constructor effect
  }

  async function createWith(detail: SimulationDetailDTO = buildDetail()): Promise<void> {
    fixture = TestBed.createComponent(SimulationResults);
    component = fixture.componentInstance;
    setDetail(detail);
    await fixture.whenStable();
  }

  beforeEach(async () => {
    serviceSpy = { getTimeseries: vi.fn().mockReturnValue(of(new ApiResponse(timeseries()))) };
    errorHandlerSpy = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SimulationResults, TranslateModule.forRoot()],
      providers: [
        { provide: SimulationService, useValue: serviceSpy },
        { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(SimulationResults, { set: { template: '' } })
      .compileComponents();
  });

  // ── 1. Creation ────────────────────────────────────────────────────

  describe('creation', () => {
    it('should create the component and expose key_result', async () => {
      await createWith();
      expect(component).toBeTruthy();
      expect(component.keyResult()).toEqual(buildKeyResult());
    });
  });

  // ── 2. Auto-expand first iteration ─────────────────────────────────

  describe('auto-expand first iteration', () => {
    it('should open the first iteration once a detail with results is shown', async () => {
      await createWith(
        buildDetail({
          key_result: buildKeyResult({
            iterations: [buildIterationResult({ number: 1 }), buildIterationResult({ number: 2 })],
          }),
        }),
      );
      expect(component.isIterationExpanded(1)).toBe(true);
      expect(component.isIterationExpanded(2)).toBe(false);
    });

    it('should not re-initialise expansion for the same detail id', async () => {
      await createWith();
      component.toggleIteration(1); // manually collapse the auto-opened iteration
      expect(component.isIterationExpanded(1)).toBe(false);
      setDetail(buildDetail()); // same id → guard prevents re-opening
      expect(component.isIterationExpanded(1)).toBe(false);
    });
  });

  // ── 3. Lazy timeseries loading ─────────────────────────────────────

  describe('timeseries loading', () => {
    it('should fetch the timeseries for a successful run with data', async () => {
      await createWith();
      expect(serviceSpy.getTimeseries).toHaveBeenCalledWith(1);
      expect(component.timeseries()).toEqual(timeseries());
      expect(component.timeseriesLoading()).toBe(false);
      expect(component.timeseriesError()).toBe(false);
    });

    it('should not refetch when the same detail id is re-shown', async () => {
      await createWith();
      expect(serviceSpy.getTimeseries).toHaveBeenCalledTimes(1);
      setDetail(buildDetail()); // same id
      expect(serviceSpy.getTimeseries).toHaveBeenCalledTimes(1);
    });

    it('should not fetch when the run has no timeseries', async () => {
      await createWith(buildDetail({ has_timeseries: false }));
      expect(serviceSpy.getTimeseries).not.toHaveBeenCalled();
    });

    it('should not fetch when the run is not successful', async () => {
      await createWith(buildDetail({ status: SimulationStatus.PENDING }));
      expect(serviceSpy.getTimeseries).not.toHaveBeenCalled();
    });

    it('should flag an error when the response carries no usable data', async () => {
      serviceSpy.getTimeseries.mockReturnValue(of(new ApiResponse('')));
      await createWith();
      expect(component.timeseries()).toBeNull();
      expect(component.timeseriesError()).toBe(true);
    });

    it('should handle a request failure and allow a retry', async () => {
      serviceSpy.getTimeseries.mockReturnValue(throwError(() => new ApiResponse('boom')));
      await createWith();
      expect(component.timeseriesError()).toBe(true);
      expect(component.timeseriesLoading()).toBe(false);
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith('boom');

      // loadedForId reset → re-showing the same row refetches.
      serviceSpy.getTimeseries.mockReturnValue(of(new ApiResponse(timeseries())));
      setDetail(buildDetail());
      expect(serviceSpy.getTimeseries).toHaveBeenCalledTimes(2);
      expect(component.timeseriesError()).toBe(false);
    });
  });

  // ── 4. Iteration toggling ──────────────────────────────────────────

  describe('toggleIteration', () => {
    it('should add and remove an iteration from the expanded set', async () => {
      await createWith();
      component.toggleIteration(5);
      expect(component.isIterationExpanded(5)).toBe(true);
      component.toggleIteration(5);
      expect(component.isIterationExpanded(5)).toBe(false);
    });
  });

  // ── 5. Pure formatting helpers ─────────────────────────────────────

  describe('helpers', () => {
    beforeEach(async () => {
      await createWith();
    });

    it('consumerCoverage should return 0 when consumption is not positive', () => {
      expect(component.consumerCoverage(buildConsumer({ consumption_total: 0 }))).toBe(0);
    });

    it('consumerCoverage should return the clamped consumed/consumption ratio', () => {
      expect(
        component.consumerCoverage(
          buildConsumer({ consumption_total: 100, energy_allocated_consumed_total: 40 }),
        ),
      ).toBe(40);
    });

    it('consumerCoverage should clamp above 100', () => {
      expect(
        component.consumerCoverage(
          buildConsumer({ consumption_total: 100, energy_allocated_consumed_total: 250 }),
        ),
      ).toBe(100);
    });

    it('formatEnergy should round to whole units', () => {
      expect(component.formatEnergy(1234.7)).toBe((1235).toLocaleString());
    });

    it('formatPercent should scale a 0–1 rate to a percentage with one decimal', () => {
      expect(component.formatPercent(0.4567)).toBe('45.7');
    });

    it('percentValue should clamp a 0–1 rate to 0–100', () => {
      expect(component.percentValue(0.5)).toBe(50);
      expect(component.percentValue(1.5)).toBe(100);
      expect(component.percentValue(-0.2)).toBe(0);
    });
  });
});
