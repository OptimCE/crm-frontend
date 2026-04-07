import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { SharingOperationConsumptionChart } from './sharing-operation-consumption-chart';
import { SharingOperationService } from '../../../../../shared/services/sharing_operation.service';
import { ErrorMessageHandler } from '../../../../../shared/services-ui/error.message.handler';
import { ApiResponse } from '../../../../../core/dtos/api.response';
import { SharingOpConsumptionDTO } from '../../../../../shared/dtos/sharing_operation.dtos';
import { Button } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { DatePicker } from 'primeng/datepicker';
import { ErrorHandlerComponent } from '../../../../../shared/components/error.handler/error.handler.component';

// ── Helpers ────────────────────────────────────────────────────────

function buildConsumption(
  overrides: Partial<SharingOpConsumptionDTO> = {},
): SharingOpConsumptionDTO {
  return {
    id: 1,
    timestamps: ['2025-01-01T00:00:00', '2025-01-02T00:00:00'],
    gross: [100, 200],
    net: [80, 160],
    shared: [50, 100],
    inj_gross: [10, 20],
    inj_net: [8, 16],
    inj_shared: [5, 10],
    ...overrides,
  };
}

// ── Test Suite ─────────────────────────────────────────────────────

describe('SharingOperationConsumptionChart', () => {
  let component: SharingOperationConsumptionChart;
  let fixture: ComponentFixture<SharingOperationConsumptionChart>;

  let sharingOperationServiceSpy: {
    getSharingOperationConsumptions: ReturnType<typeof vi.fn>;
    downloadSharingOperationConsumptions: ReturnType<typeof vi.fn>;
  };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };

  async function createComponent(idSharing = 1): Promise<void> {
    fixture = TestBed.createComponent(SharingOperationConsumptionChart);
    fixture.componentRef.setInput('idSharing', idSharing);
    component = fixture.componentInstance;
    component.ngOnInit();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    sharingOperationServiceSpy = {
      getSharingOperationConsumptions: vi
        .fn()
        .mockReturnValue(of(new ApiResponse<SharingOpConsumptionDTO>(buildConsumption()))),
      downloadSharingOperationConsumptions: vi
        .fn()
        .mockReturnValue(of({ blob: new Blob(), filename: 'consumptions.xlsx' })),
    };
    errorHandlerSpy = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SharingOperationConsumptionChart, TranslateModule.forRoot()],
      providers: [
        { provide: SharingOperationService, useValue: sharingOperationServiceSpy },
        { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
      ],
    })
      .overrideComponent(SharingOperationConsumptionChart, {
        remove: {
          imports: [Button, ChartModule, DatePicker, ErrorHandlerComponent],
        },
        add: {
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
      await createComponent(42);
    });

    it('should not call service when form is invalid', () => {
      component.loadChart();
      expect(sharingOperationServiceSpy.getSharingOperationConsumptions).not.toHaveBeenCalled();
    });

    it('should call getSharingOperationConsumptions with correct params', () => {
      component.formChart.setValue({ dateDeb: '2025-01-01', dateFin: '2025-12-31' });
      component.loadChart();
      expect(sharingOperationServiceSpy.getSharingOperationConsumptions).toHaveBeenCalledWith(42, {
        date_start: '2025-01-01',
        date_end: '2025-12-31',
      });
    });

    it('should set data signal after successful response', () => {
      component.formChart.setValue({ dateDeb: '2025-01-01', dateFin: '2025-12-31' });
      component.loadChart();
      expect(component.data()).toBeTruthy();
      const chartData = component.data();
      expect(chartData?.labels).toEqual(['2025-01-01T00:00:00', '2025-01-02T00:00:00']);
      expect(chartData?.datasets.length).toBe(4);
    });

    it('should set displayDownloadButton to true after success', () => {
      expect(component.displayDownloadButton()).toBe(false);
      component.formChart.setValue({ dateDeb: '2025-01-01', dateFin: '2025-12-31' });
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
      await createComponent(42);
      component.formChart.setValue({ dateDeb: '2025-01-01', dateFin: '2025-12-31' });
    });

    it('should call downloadSharingOperationConsumptions with form values', () => {
      component.downloadTotalConsumption();
      expect(sharingOperationServiceSpy.downloadSharingOperationConsumptions).toHaveBeenCalledWith(
        42,
        {
          date_start: '2025-01-01',
          date_end: '2025-12-31',
        },
      );
    });

    it('should call errorHandler when response has no blob', () => {
      sharingOperationServiceSpy.downloadSharingOperationConsumptions.mockReturnValue(
        of(new ApiResponse('error')),
      );
      component.downloadTotalConsumption();
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });

    it('should call errorHandler on error', () => {
      sharingOperationServiceSpy.downloadSharingOperationConsumptions.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      component.downloadTotalConsumption();
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });
  });
});
