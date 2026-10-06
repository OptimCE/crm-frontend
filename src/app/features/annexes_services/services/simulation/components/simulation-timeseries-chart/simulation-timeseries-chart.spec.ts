import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

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

    // The labels are the select's aria-label too; they used to keep the language
    // the results were opened in.
    it('should label the options in the current language, and again after a switch', async () => {
      const translate = TestBed.inject(TranslateService);
      translate.setTranslation('fr', {
        SIMULATION_HUB: { RESULTS: { ITERATION_LABEL: 'Itération {{number}}' } },
      });
      translate.setTranslation('en', {
        SIMULATION_HUB: { RESULTS: { ITERATION_LABEL: 'Iteration {{number}}' } },
      });
      translate.use('fr');
      await createWith([buildIteration({ number: 1 }), buildIteration({ number: 2 })]);
      expect(component.iterationOptions().map((o) => o.label)).toEqual([
        'Itération 1',
        'Itération 2',
      ]);

      translate.use('en');

      expect(component.iterationOptions()).toEqual([
        { label: 'Iteration 1', value: 0 },
        { label: 'Iteration 2', value: 1 },
      ]);
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

  // ── 6. Figures in the reader's language ────────────────────────────

  describe("figures in the reader's language", () => {
    it('hands the language to chart.js, which formats the axis in it', async () => {
      // BUG: with no `locale`, chart.js formats ticks in the BROWSER's locale.
      TestBed.inject(TranslateService).use('de');
      await createWith([buildIteration()]);
      expect(component.options.locale).toBe('de');
    });

    it('writes the tooltip value in that language', async () => {
      // BUG: `toFixed(2)` wrote "1234.50 kWh" in every language.
      TestBed.inject(TranslateService).use('fr');
      await createWith([buildIteration()]);
      const label = component.options.plugins.tooltip.callbacks.label({
        dataset: { label: 'Surplus' },
        raw: 1234.5,
      });
      expect(label).toBe(`Surplus: 1${String.fromCharCode(0x202f)}234,50 kWh`);
    });
  });
});
