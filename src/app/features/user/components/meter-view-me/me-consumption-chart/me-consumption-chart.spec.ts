import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslateModule, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { MeConsumptionChart } from './me-consumption-chart';
import { MeService } from '../../../../../shared/services/me.service';
import { ApiResponse } from '../../../../../core/dtos/api.response';
import { MeterConsumptionDTO } from '../../../../../shared/dtos/meter.dtos';

// ── Helpers ────────────────────────────────────────────────────────

function buildConsumption(overrides: Partial<MeterConsumptionDTO> = {}): MeterConsumptionDTO {
  return {
    EAN: '541449000000000001',
    timestamps: ['2026-06-05T10:00:00', '2026-06-10T10:00:00'],
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

describe('MeConsumptionChart', () => {
  let component: MeConsumptionChart;
  let fixture: ComponentFixture<MeConsumptionChart>;

  let meServiceSpy: {
    getMeterConsumptions: ReturnType<typeof vi.fn>;
  };

  async function createComponent(ean = '541449000000000001'): Promise<void> {
    fixture = TestBed.createComponent(MeConsumptionChart);
    fixture.componentRef.setInput('ean', ean);
    component = fixture.componentInstance;
    component.ngOnInit();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    meServiceSpy = {
      getMeterConsumptions: vi
        .fn()
        .mockReturnValue(of(new ApiResponse<MeterConsumptionDTO>(buildConsumption()))),
    };

    await TestBed.configureTestingModule({
      imports: [MeConsumptionChart, TranslateModule.forRoot()],
      providers: [{ provide: MeService, useValue: meServiceSpy }],
    })
      .overrideComponent(MeConsumptionChart, {
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
  });

  // ── 2. loadChart ──────────────────────────────────────────────────

  describe('loadChart', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should not call service when form is invalid', () => {
      component.loadChart();
      expect(meServiceSpy.getMeterConsumptions).not.toHaveBeenCalled();
    });

    it('should call MeService.getMeterConsumptions with correct params', () => {
      component.formChart.setValue({
        dateDeb: new Date(2026, 5, 1),
        dateFin: new Date(2026, 5, 30),
      });
      component.loadChart();
      expect(meServiceSpy.getMeterConsumptions).toHaveBeenCalledWith('541449000000000001', {
        date_start: '2026-06-01',
        date_end: '2026-06-30',
      });
    });

    it('should set data signal after successful response', () => {
      component.formChart.setValue({
        dateDeb: new Date(2026, 5, 1),
        dateFin: new Date(2026, 5, 30),
      });
      component.loadChart();
      expect(component.data()).toBeTruthy();
      const chartData = component.data();
      expect(chartData?.labels).toEqual(['2026-06-05T10:00:00', '2026-06-10T10:00:00']);
      expect(chartData?.datasets.length).toBe(4);
    });
  });
});
