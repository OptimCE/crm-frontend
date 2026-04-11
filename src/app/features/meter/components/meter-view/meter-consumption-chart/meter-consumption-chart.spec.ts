import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslateModule, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { MeterConsumptionChart } from './meter-consumption-chart';
import { MeterService } from '../../../../../shared/services/meter.service';
import { ApiResponse } from '../../../../../core/dtos/api.response';
import { MeterConsumptionDTO } from '../../../../../shared/dtos/meter.dtos';

// ── Helpers ────────────────────────────────────────────────────────

function buildConsumption(overrides: Partial<MeterConsumptionDTO> = {}): MeterConsumptionDTO {
  return {
    EAN: '541449000000000001',
    timestamps: ['2024-01-01T00:00:00', '2024-02-01T00:00:00'],
    gross: [100, 200],
    net: [80, 160],
    shared: [20, 40],
    inj_gross: [10, 20],
    inj_net: [8, 16],
    inj_shared: [2, 4],
    ...overrides,
  };
}

// ── Test Suite ─────────────────────────────────────────────────────

describe('MeterConsumptionChart', () => {
  let component: MeterConsumptionChart;
  let fixture: ComponentFixture<MeterConsumptionChart>;

  let meterServiceSpy: {
    getMeterConsumptions: ReturnType<typeof vi.fn>;
    downloadMeterConsumptions: ReturnType<typeof vi.fn>;
  };

  async function createComponent(ean = '541449000000000001'): Promise<void> {
    fixture = TestBed.createComponent(MeterConsumptionChart);
    fixture.componentRef.setInput('ean', ean);
    component = fixture.componentInstance;
    component.ngOnInit();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    meterServiceSpy = {
      getMeterConsumptions: vi
        .fn()
        .mockReturnValue(of(new ApiResponse<MeterConsumptionDTO>(buildConsumption()))),
      downloadMeterConsumptions: vi
        .fn()
        .mockReturnValue(of({ blob: new Blob(), filename: 'consumptions.xlsx' })),
    };

    await TestBed.configureTestingModule({
      imports: [MeterConsumptionChart, TranslateModule.forRoot()],
      providers: [{ provide: MeterService, useValue: meterServiceSpy }],
    })
      .overrideComponent(MeterConsumptionChart, {
        set: {
          imports: [ReactiveFormsModule, TranslatePipe],
          template: '',
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

  // ── 1. Creation & Init ────────────────────────────────────────────

  describe('Creation & Init', () => {
    it('should create', async () => {
      await createComponent();
      expect(component).toBeTruthy();
    });

    it('should initialize formChart with required validators', async () => {
      await createComponent();
      expect(component.formChart).toBeTruthy();
      expect(component.formChart.get('dateDeb')).toBeTruthy();
      expect(component.formChart.get('dateFin')).toBeTruthy();
      expect(component.formChart.valid).toBe(false);
    });

    it('displayDownloadButton should default to false', async () => {
      await createComponent();
      expect(component.displayDownloadButton()).toBe(false);
    });
  });

  // ── 2. loadChart ──────────────────────────────────────────────────

  describe('loadChart', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should not call service when form is invalid', () => {
      component.loadChart();
      expect(meterServiceSpy.getMeterConsumptions).not.toHaveBeenCalled();
    });

    it('should call getMeterConsumptions with correct params', () => {
      component.formChart.setValue({ dateDeb: '2024-01-01', dateFin: '2024-12-31' });
      component.loadChart();
      expect(meterServiceSpy.getMeterConsumptions).toHaveBeenCalledWith('541449000000000001', {
        date_start: '2024-01-01',
        date_end: '2024-12-31',
      });
    });

    it('should set data signal after successful response', () => {
      component.formChart.setValue({ dateDeb: '2024-01-01', dateFin: '2024-12-31' });
      component.loadChart();
      expect(component.data()).toBeTruthy();
      const chartData = component.data();
      expect(chartData?.labels).toEqual(['2024-01-01T00:00:00', '2024-02-01T00:00:00']);
      expect(chartData?.datasets.length).toBe(4);
    });

    it('should set displayDownloadButton to true after success', () => {
      expect(component.displayDownloadButton()).toBe(false);
      component.formChart.setValue({ dateDeb: '2024-01-01', dateFin: '2024-12-31' });
      component.loadChart();
      expect(component.displayDownloadButton()).toBe(true);
    });

    it('should reset displayDownloadButton before loading', () => {
      component['displayDownloadButton'].set(true);
      component.loadChart();
      expect(component.displayDownloadButton()).toBe(false);
    });
  });

  // ── 3. downloadTotalConsumption ───────────────────────────────────

  describe('downloadTotalConsumption', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should call downloadMeterConsumptions with form values', () => {
      component.formChart.setValue({ dateDeb: '2024-01-01', dateFin: '2024-12-31' });
      component.downloadTotalConsumption();
      expect(meterServiceSpy.downloadMeterConsumptions).toHaveBeenCalledWith('541449000000000001', {
        date_start: '2024-01-01',
        date_end: '2024-12-31',
      });
    });
  });
});
