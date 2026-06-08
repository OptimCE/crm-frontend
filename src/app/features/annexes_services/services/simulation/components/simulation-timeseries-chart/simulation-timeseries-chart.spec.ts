import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { SimulationIterationTimeseriesDTO } from '../../../../../../shared/dtos/simulation.dtos';
import { SimulationTimeseriesChart } from './simulation-timeseries-chart';

// ── Helpers ──────────────────────────────────────────────────────────

function series(length: number, value = 1): number[] {
  return Array.from({ length }, () => value);
}

function buildIteration(
  overrides: Partial<SimulationIterationTimeseriesDTO> = {},
): SimulationIterationTimeseriesDTO {
  const length = 3;
  return {
    number: 1,
    consumption: series(length),
    energy_allocated: series(length),
    energy_allocated_consumed: series(length),
    residual_volume: series(length),
    surplus: series(length),
    sharing_rate: series(length),
    self_sufficiency_rate: series(length),
    consumers: [],
    ...overrides,
  };
}

// ── Test Suite ───────────────────────────────────────────────────────

describe('SimulationTimeseriesChart', () => {
  let component: SimulationTimeseriesChart;
  let fixture: ComponentFixture<SimulationTimeseriesChart>;

  async function createWith(iterations: SimulationIterationTimeseriesDTO[]): Promise<void> {
    fixture = TestBed.createComponent(SimulationTimeseriesChart);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('iterations', iterations);
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SimulationTimeseriesChart, TranslateModule.forRoot()],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(SimulationTimeseriesChart, { set: { template: '' } })
      .compileComponents();
  });

  // ── 1. Creation ────────────────────────────────────────────────────

  describe('creation', () => {
    it('should create the component', async () => {
      await createWith([buildIteration()]);
      expect(component).toBeTruthy();
      expect(component.selectedIndex()).toBe(0);
    });
  });

  // ── 2. hasMultipleIterations ───────────────────────────────────────

  describe('hasMultipleIterations', () => {
    it('should be false for a single iteration', async () => {
      await createWith([buildIteration()]);
      expect(component.hasMultipleIterations()).toBe(false);
    });

    it('should be true for two or more iterations', async () => {
      await createWith([buildIteration({ number: 1 }), buildIteration({ number: 2 })]);
      expect(component.hasMultipleIterations()).toBe(true);
    });
  });

  // ── 3. iterationOptions ────────────────────────────────────────────

  describe('iterationOptions', () => {
    it('should expose one option per iteration with the index as value', async () => {
      await createWith([buildIteration({ number: 1 }), buildIteration({ number: 2 })]);
      const options = component.iterationOptions();
      expect(options.length).toBe(2);
      expect(options.map((o) => o.value)).toEqual([0, 1]);
      // instant() returns the translation key when no messages are loaded.
      expect(options[0].label).toBe('SIMULATION_HUB.RESULTS.ITERATION_LABEL');
    });
  });

  // ── 4. chartData ───────────────────────────────────────────────────

  describe('chartData', () => {
    it('should return null when there are no iterations', async () => {
      await createWith([]);
      expect(component.chartData()).toBeNull();
    });

    it('should build four datasets and preserve short series unchanged', async () => {
      await createWith([buildIteration()]);
      const data = component.chartData();
      expect(data).not.toBeNull();
      expect(data?.datasets.length).toBe(4);
      // 3 points → stride 1 → no decimation.
      expect(data?.labels).toEqual(['1', '2', '3']);
      data?.datasets.forEach((d) => expect(d.data.length).toBe(3));
    });

    it('should decimate large series to at most 1500 points', async () => {
      // Real iterations carry equal-length arrays; the stride derives from the
      // consumption length and is applied to every series.
      await createWith([
        buildIteration({
          consumption: series(3000),
          energy_allocated_consumed: series(3000),
          surplus: series(3000),
          residual_volume: series(3000),
        }),
      ]);
      const data = component.chartData();
      expect(data).not.toBeNull();
      expect(data?.labels.length).toBeLessThanOrEqual(1500);
      // every dataset is decimated with the same stride as the labels.
      data?.datasets.forEach((d) => expect(d.data.length).toBe(data?.labels.length));
    });

    it('should follow the selected iteration', async () => {
      await createWith([
        buildIteration({ number: 1, consumption: series(3) }),
        buildIteration({ number: 2, consumption: series(5) }),
      ]);
      expect(component.chartData()?.labels.length).toBe(3);
      component.onIterationChange(1);
      expect(component.selectedIndex()).toBe(1);
      expect(component.chartData()?.labels.length).toBe(5);
    });

    it('should fall back to the first iteration when the selected index is out of range', async () => {
      await createWith([buildIteration({ consumption: series(3) })]);
      component.onIterationChange(99);
      expect(component.chartData()?.labels.length).toBe(3);
    });
  });

  // ── 5. onIterationChange ───────────────────────────────────────────

  describe('onIterationChange', () => {
    it('should update the selected index', async () => {
      await createWith([buildIteration({ number: 1 }), buildIteration({ number: 2 })]);
      component.onIterationChange(1);
      expect(component.selectedIndex()).toBe(1);
    });
  });
});
