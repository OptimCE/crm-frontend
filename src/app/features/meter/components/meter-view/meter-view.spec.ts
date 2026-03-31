import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { MeterView } from './meter-view';
import { MeterService } from '../../../../shared/services/meter.service';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { ApiResponse } from '../../../../core/dtos/api.response';
import { MeterConsumptionDTO, MetersDataDTO, MetersDTO } from '../../../../shared/dtos/meter.dtos';
import { AddressDTO } from '../../../../shared/dtos/address.dtos';
import {
  ClientType,
  InjectionStatus,
  MeterDataStatus,
  MeterRate,
  PhaseCategory,
  ProductionChain,
  ReadingFrequency,
  TarifGroup,
} from '../../../../shared/types/meter.types';
import { MeterUpdate } from '../meter-update/meter-update';
import { MeterDataUpdate } from '../meter-data-update/meter-data-update';
import { MeterDeactivation } from '../meter-deactivation/meter-deactivation';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { BackArrow } from '../../../../layout/back-arrow/back-arrow';
import { MeterDataView } from './meter-data-view/meter-data-view';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { ChartModule } from 'primeng/chart';

// ── Helpers ────────────────────────────────────────────────────────

function buildAddress(overrides: Partial<AddressDTO> = {}): AddressDTO {
  return {
    id: 1,
    street: 'Main St',
    number: 42,
    postcode: '1000',
    city: 'Brussels',
    ...overrides,
  };
}

function buildMeterData(overrides: Partial<MetersDataDTO> = {}): MetersDataDTO {
  return {
    id: 1,
    description: 'Current config',
    sampling_power: 10,
    status: MeterDataStatus.ACTIVE,
    amperage: 25,
    rate: MeterRate.SIMPLE,
    client_type: ClientType.RESIDENTIAL,
    start_date: new Date('2024-01-01'),
    injection_status: InjectionStatus.NONE,
    production_chain: ProductionChain.PHOTOVOLTAIC,
    totalGenerating_capacity: 5,
    grd: 'ORES',
    ...overrides,
  };
}

function buildMeter(overrides: Partial<MetersDTO> = {}): MetersDTO {
  return {
    EAN: '541449000000000001',
    meter_number: 'M001',
    address: buildAddress(),
    tarif_group: TarifGroup.LOW_TENSION,
    phases_number: PhaseCategory.SINGLE,
    reading_frequency: ReadingFrequency.MONTHLY,
    meter_data: buildMeterData(),
    meter_data_history: [
      buildMeterData({
        id: 2,
        status: MeterDataStatus.INACTIVE,
        start_date: new Date('2023-01-01'),
        end_date: new Date('2023-12-31'),
      }),
    ],
    futur_meter_data: [
      buildMeterData({
        id: 3,
        start_date: new Date('2025-01-01'),
      }),
    ],
    ...overrides,
  };
}

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

describe('MeterView', () => {
  let component: MeterView;
  let fixture: ComponentFixture<MeterView>;

  let meterServiceSpy: {
    getMeter: ReturnType<typeof vi.fn>;
    getMeterConsumptions: ReturnType<typeof vi.fn>;
    downloadMeterConsumptions: ReturnType<typeof vi.fn>;
  };
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };
  let snackbarSpy: { openSnackBar: ReturnType<typeof vi.fn> };
  let dialogServiceSpy: { open: ReturnType<typeof vi.fn> };
  let activatedRouteMock: { snapshot: { paramMap: ReturnType<typeof convertToParamMap> } };

  async function createComponent(preInitFn?: () => void): Promise<void> {
    fixture = TestBed.createComponent(MeterView);
    component = fixture.componentInstance;
    if (preInitFn) {
      preInitFn();
    }
    component.ngOnInit();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    activatedRouteMock = { snapshot: { paramMap: convertToParamMap({ id: '42' }) } };

    meterServiceSpy = {
      getMeter: vi.fn().mockReturnValue(of(new ApiResponse<MetersDTO>(buildMeter()))),
      getMeterConsumptions: vi
        .fn()
        .mockReturnValue(of(new ApiResponse<MeterConsumptionDTO>(buildConsumption()))),
      downloadMeterConsumptions: vi
        .fn()
        .mockReturnValue(of({ blob: new Blob(), filename: 'consumptions.xlsx' })),
    };

    routerSpy = { navigate: vi.fn().mockResolvedValue(true) };
    snackbarSpy = { openSnackBar: vi.fn() };
    dialogServiceSpy = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [MeterView, TranslateModule.forRoot()],
      providers: [
        { provide: MeterService, useValue: meterServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: SnackbarNotification, useValue: snackbarSpy },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
      ],
    })
      .overrideComponent(MeterView, {
        remove: {
          imports: [BackArrow, MeterDataView, Tabs, TabList, Tab, TabPanels, TabPanel, ChartModule],
          providers: [DialogService],
        },
        add: {
          providers: [{ provide: DialogService, useValue: dialogServiceSpy }],
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

    it('should call getMeter on init with route id', async () => {
      await createComponent();
      expect(meterServiceSpy.getMeter).toHaveBeenCalledWith('42');
    });

    it('should navigate away when route has no id', async () => {
      activatedRouteMock.snapshot.paramMap = convertToParamMap({});
      await createComponent();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/members/meter']);
    });

    it('should set isLoading then clear after getMeter response', async () => {
      await createComponent();
      expect(component.isLoading()).toBe(false);
      expect(component.meter()).toBeTruthy();
    });

    it('should set hasError on getMeter error', async () => {
      meterServiceSpy.getMeter.mockReturnValue(throwError(() => new Error('fail')));
      await createComponent();
      expect(component.hasError()).toBe(true);
      expect(component.isLoading()).toBe(false);
    });

    it('should set hasError when response is falsy', async () => {
      meterServiceSpy.getMeter.mockReturnValue(of(null));
      await createComponent();
      expect(component.hasError()).toBe(true);
    });

    it('should initialize formChart with required validators', async () => {
      await createComponent();
      expect(component.formChart).toBeTruthy();
      expect(component.formChart.get('dateDeb')).toBeTruthy();
      expect(component.formChart.get('dateFin')).toBeTruthy();
      expect(component.formChart.valid).toBe(false);
    });
  });

  // ── 2. Computed Signals ───────────────────────────────────────────

  describe('Computed signals', () => {
    it('hasMeterData returns true when meter has meter_data', async () => {
      await createComponent();
      expect(component.hasMeterData()).toBe(true);
    });

    it('hasMeterData returns false when meter has no meter_data', async () => {
      meterServiceSpy.getMeter.mockReturnValue(
        of(new ApiResponse<MetersDTO>(buildMeter({ meter_data: undefined }))),
      );
      await createComponent();
      expect(component.hasMeterData()).toBe(false);
    });

    it('hasHistory returns true when meter has history', async () => {
      await createComponent();
      expect(component.hasHistory()).toBe(true);
    });

    it('hasHistory returns false when meter has no history', async () => {
      meterServiceSpy.getMeter.mockReturnValue(
        of(new ApiResponse<MetersDTO>(buildMeter({ meter_data_history: [] }))),
      );
      await createComponent();
      expect(component.hasHistory()).toBe(false);
    });

    it('hasFutureData returns true when meter has future data', async () => {
      await createComponent();
      expect(component.hasFutureData()).toBe(true);
    });

    it('hasFutureData returns false when meter has no future data', async () => {
      meterServiceSpy.getMeter.mockReturnValue(
        of(new ApiResponse<MetersDTO>(buildMeter({ futur_meter_data: [] }))),
      );
      await createComponent();
      expect(component.hasFutureData()).toBe(false);
    });

    it('currentStatus returns the status of meter_data', async () => {
      await createComponent();
      expect(component.currentStatus()).toBe(MeterDataStatus.ACTIVE);
    });

    it('currentStatus returns undefined when no meter_data', async () => {
      meterServiceSpy.getMeter.mockReturnValue(
        of(new ApiResponse<MetersDTO>(buildMeter({ meter_data: undefined }))),
      );
      await createComponent();
      expect(component.currentStatus()).toBeUndefined();
    });
  });

  // ── 3. Translation Categories ────────────────────────────────────

  describe('Translation categories', () => {
    it('should populate all translation map signals', async () => {
      await createComponent();
      expect(component.productionChainMap().length).toBeGreaterThan(0);
      expect(component.rateMap().length).toBeGreaterThan(0);
      expect(component.clientTypeMap().length).toBeGreaterThan(0);
      expect(component.injectionStatusMap().length).toBeGreaterThan(0);
      expect(component.readingFrequencyMap().length).toBeGreaterThan(0);
      expect(component.phasesNumberMap().length).toBeGreaterThan(0);
      expect(component.tarifGroupMap().length).toBeGreaterThan(0);
    });

    it('productionChainMap has correct length', async () => {
      await createComponent();
      // empty string + 8 production chain values
      expect(component.productionChainMap().length).toBe(9);
    });

    it('rateMap has correct length', async () => {
      await createComponent();
      // empty string + 3 rate values
      expect(component.rateMap().length).toBe(4);
    });

    it('clientTypeMap has correct length', async () => {
      await createComponent();
      // empty string + 3 client type values
      expect(component.clientTypeMap().length).toBe(4);
    });

    it('injectionStatusMap has correct length', async () => {
      await createComponent();
      // empty string + 5 injection status values
      expect(component.injectionStatusMap().length).toBe(6);
    });

    it('readingFrequencyMap has correct length', async () => {
      await createComponent();
      // empty string + 2 reading frequency values
      expect(component.readingFrequencyMap().length).toBe(3);
    });

    it('phasesNumberMap has correct length', async () => {
      await createComponent();
      // empty string + 2 phase values
      expect(component.phasesNumberMap().length).toBe(3);
    });

    it('tarifGroupMap has correct length', async () => {
      await createComponent();
      // empty string + 2 tarif group values
      expect(component.tarifGroupMap().length).toBe(3);
    });
  });

  // ── 4. Dialog Operations ─────────────────────────────────────────

  describe('Dialog operations', () => {
    let dialogCloseSubject: Subject<unknown>;

    beforeEach(async () => {
      dialogCloseSubject = new Subject();
      dialogServiceSpy.open.mockReturnValue({
        onClose: dialogCloseSubject.asObservable(),
        destroy: vi.fn(),
      } as unknown as DynamicDialogRef);

      await createComponent();
    });

    describe('toModify', () => {
      it('should open MeterUpdate dialog', () => {
        component.toModify();
        expect(dialogServiceSpy.open).toHaveBeenCalledWith(
          MeterUpdate,
          expect.objectContaining({
            modal: true,
            data: { meter: component.meter() },
          }),
        );
      });

      it('should show snackbar and refresh on dialog close with response', () => {
        component.toModify();
        meterServiceSpy.getMeter.mockClear();
        dialogCloseSubject.next(true);
        expect(snackbarSpy.openSnackBar).toHaveBeenCalledWith(
          'METER.FULL.METER_MODIFIED_SUCCESS_LABEL',
          VALIDATION_TYPE,
        );
        expect(meterServiceSpy.getMeter).toHaveBeenCalled();
      });

      it('should not show snackbar when dialog is dismissed', () => {
        component.toModify();
        dialogCloseSubject.next(undefined);
        expect(snackbarSpy.openSnackBar).not.toHaveBeenCalled();
      });
    });

    describe('toUpdate', () => {
      it('should open MeterDataUpdate dialog', () => {
        component.toUpdate();
        expect(dialogServiceSpy.open).toHaveBeenCalledWith(
          MeterDataUpdate,
          expect.objectContaining({
            modal: true,
            data: {
              id: buildMeter().EAN,
              meterData: component.meter()?.meter_data,
            },
          }),
        );
      });

      it('should no-op if meter is undefined', () => {
        component['meter'].set(undefined);
        component.toUpdate();
        expect(dialogServiceSpy.open).not.toHaveBeenCalled();
      });

      it('should show snackbar and refresh on dialog close with response', () => {
        component.toUpdate();
        meterServiceSpy.getMeter.mockClear();
        dialogCloseSubject.next(true);
        expect(snackbarSpy.openSnackBar).toHaveBeenCalledWith(
          'METER.FULL.METER_DATA_UPDATE_SUCCESS_LABEL',
          VALIDATION_TYPE,
        );
        expect(meterServiceSpy.getMeter).toHaveBeenCalled();
      });

      it('should not show snackbar when dialog is dismissed', () => {
        component.toUpdate();
        dialogCloseSubject.next(undefined);
        expect(snackbarSpy.openSnackBar).not.toHaveBeenCalled();
      });
    });

    describe('toDeactivate', () => {
      it('should open MeterDeactivation dialog', () => {
        component.toDeactivate();
        expect(dialogServiceSpy.open).toHaveBeenCalledWith(
          MeterDeactivation,
          expect.objectContaining({
            modal: true,
            data: { ean: buildMeter().EAN },
          }),
        );
      });

      it('should no-op if meter is undefined', () => {
        component['meter'].set(undefined);
        component.toDeactivate();
        expect(dialogServiceSpy.open).not.toHaveBeenCalled();
      });

      it('should show snackbar and refresh on dialog close with response', () => {
        component.toDeactivate();
        meterServiceSpy.getMeter.mockClear();
        dialogCloseSubject.next(true);
        expect(snackbarSpy.openSnackBar).toHaveBeenCalledWith(
          'METER.FULL.METER_DEACTIVATED_SUCCESS_LABEL',
          VALIDATION_TYPE,
        );
        expect(meterServiceSpy.getMeter).toHaveBeenCalled();
      });

      it('should not show snackbar when dialog is dismissed', () => {
        component.toDeactivate();
        dialogCloseSubject.next(undefined);
        expect(snackbarSpy.openSnackBar).not.toHaveBeenCalled();
      });
    });
  });

  // ── 5. Chart & Consumption ───────────────────────────────────────

  describe('Chart & Consumption', () => {
    beforeEach(async () => {
      await createComponent();
    });

    describe('loadChart', () => {
      it('should not call service when form is invalid', () => {
        component.loadChart();
        expect(meterServiceSpy.getMeterConsumptions).not.toHaveBeenCalled();
      });

      it('should not call service when meter is undefined', () => {
        component.formChart.setValue({ dateDeb: '2024-01-01', dateFin: '2024-12-31' });
        component['meter'].set(undefined);
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

    describe('downloadTotalConsumption', () => {
      it('should no-op if meter is undefined', () => {
        component['meter'].set(undefined);
        component.downloadTotalConsumption();
        expect(meterServiceSpy.downloadMeterConsumptions).not.toHaveBeenCalled();
      });

      it('should call downloadMeterConsumptions with form values', () => {
        component.formChart.setValue({ dateDeb: '2024-01-01', dateFin: '2024-12-31' });
        component.downloadTotalConsumption();
        expect(meterServiceSpy.downloadMeterConsumptions).toHaveBeenCalledWith(
          '541449000000000001',
          {
            date_start: '2024-01-01',
            date_end: '2024-12-31',
          },
        );
      });
    });
  });

  // ── 6. getFullMeter ──────────────────────────────────────────────

  describe('getFullMeter', () => {
    it('should not set isLoading when showLoading is false', async () => {
      await createComponent();
      component['isLoading'].set(false);
      meterServiceSpy.getMeter.mockReturnValue(of(new ApiResponse<MetersDTO>(buildMeter())));
      component.getFullMeter(false);
      // isLoading should remain false throughout since showLoading=false
      expect(component.isLoading()).toBe(false);
    });

    it('should update meter signal on success', async () => {
      await createComponent();
      const newMeter = buildMeter({ meter_number: 'M999' });
      meterServiceSpy.getMeter.mockReturnValue(of(new ApiResponse<MetersDTO>(newMeter)));
      component.getFullMeter();
      expect(component.meter()?.meter_number).toBe('M999');
    });
  });
});
