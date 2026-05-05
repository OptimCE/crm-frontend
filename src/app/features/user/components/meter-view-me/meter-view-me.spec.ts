import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { MeterViewMe } from './meter-view-me';
import { MeService } from '../../../../shared/services/me.service';
import { ApiResponse } from '../../../../core/dtos/api.response';
import { MeMeterDTO } from '../../../../shared/dtos/me.dtos';
import { MetersDataDTO } from '../../../../shared/dtos/meter.dtos';
import { AddressDTO } from '../../../../shared/dtos/address.dtos';
import { CommunityDTO } from '../../../../shared/dtos/community.dtos';
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
import { BackArrow } from '../../../../layout/back-arrow/back-arrow';
import { MeterDataView } from '../../../meter/components/meter-view/meter-data-view/meter-data-view';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';

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

function buildCommunity(): CommunityDTO {
  return { id: 1, name: 'Test community', logo_url: null };
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
    start_date: '2024-01-01',
    injection_status: InjectionStatus.NONE,
    production_chain: ProductionChain.PHOTOVOLTAIC,
    totalGenerating_capacity: 5,
    grd: 'ORES',
    ...overrides,
  };
}

function buildMeMeter(overrides: Partial<MeMeterDTO> = {}): MeMeterDTO {
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
        start_date: '2023-01-01',
        end_date: '2023-12-31',
      }),
    ],
    futur_meter_data: [buildMeterData({ id: 3, start_date: '2025-01-01' })],
    community: buildCommunity(),
    ...overrides,
  } as MeMeterDTO;
}

describe('MeterViewMe', () => {
  let component: MeterViewMe;
  let fixture: ComponentFixture<MeterViewMe>;

  let meServiceSpy: { getMetersById: ReturnType<typeof vi.fn> };
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };
  let activatedRouteMock: { snapshot: { paramMap: ReturnType<typeof convertToParamMap> } };

  async function createComponent(preInit?: () => void): Promise<void> {
    fixture = TestBed.createComponent(MeterViewMe);
    component = fixture.componentInstance;
    if (preInit) preInit();
    component.ngOnInit();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    activatedRouteMock = {
      snapshot: { paramMap: convertToParamMap({ id: '541449000000000001' }) },
    };
    meServiceSpy = {
      getMetersById: vi.fn().mockReturnValue(of(new ApiResponse<MeMeterDTO>(buildMeMeter()))),
    };
    routerSpy = { navigate: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [MeterViewMe, TranslateModule.forRoot()],
      providers: [
        { provide: MeService, useValue: meServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
      ],
    })
      .overrideComponent(MeterViewMe, {
        remove: {
          imports: [BackArrow, MeterDataView, Tabs, TabList, Tab, TabPanels, TabPanel],
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

  describe('Creation & Init', () => {
    it('should create', async () => {
      await createComponent();
      expect(component).toBeTruthy();
    });

    it('should call getMetersById on init with route id', async () => {
      await createComponent();
      expect(meServiceSpy.getMetersById).toHaveBeenCalledWith('541449000000000001');
    });

    it('should navigate to /users when no id provided', async () => {
      activatedRouteMock.snapshot.paramMap = convertToParamMap({});
      await createComponent();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/users']);
    });

    it('should set hasError on getMetersById error', async () => {
      meServiceSpy.getMetersById.mockReturnValue(throwError(() => new Error('boom')));
      await createComponent();
      expect(component.hasError()).toBe(true);
      expect(component.isLoading()).toBe(false);
    });

    it('should set hasError when response is falsy', async () => {
      meServiceSpy.getMetersById.mockReturnValue(of(null));
      await createComponent();
      expect(component.hasError()).toBe(true);
    });
  });

  describe('Computed signals', () => {
    it('hasMeterData true when meter has data', async () => {
      await createComponent();
      expect(component.hasMeterData()).toBe(true);
    });

    it('hasMeterData false when meter has no data', async () => {
      meServiceSpy.getMetersById.mockReturnValue(
        of(new ApiResponse<MeMeterDTO>(buildMeMeter({ meter_data: undefined }))),
      );
      await createComponent();
      expect(component.hasMeterData()).toBe(false);
    });

    it('hasHistory reflects history length', async () => {
      await createComponent();
      expect(component.hasHistory()).toBe(true);
    });

    it('hasFutureData reflects future data length', async () => {
      await createComponent();
      expect(component.hasFutureData()).toBe(true);
    });

    it('currentStatus returns the meter_data status', async () => {
      await createComponent();
      expect(component.currentStatus()).toBe(MeterDataStatus.ACTIVE);
    });
  });

  describe('Translation categories', () => {
    it('populates all translation map signals', async () => {
      await createComponent();
      expect(component.productionChainMap().length).toBeGreaterThan(0);
      expect(component.rateMap().length).toBeGreaterThan(0);
      expect(component.clientTypeMap().length).toBeGreaterThan(0);
      expect(component.injectionStatusMap().length).toBeGreaterThan(0);
      expect(component.readingFrequencyMap().length).toBeGreaterThan(0);
      expect(component.phasesNumberMap().length).toBeGreaterThan(0);
      expect(component.tarifGroupMap().length).toBeGreaterThan(0);
    });
  });

  describe('Read-only — no edit affordances rendered', () => {
    it('does not render modify/update/deactivate buttons', async () => {
      await createComponent();
      fixture.detectChanges();
      const html = (fixture.nativeElement as HTMLElement).innerHTML;
      expect(html).not.toContain('meter-view-me__btn--modify');
      expect(html).not.toContain('meter-view-me__btn--update');
      expect(html).not.toContain('meter-view-me__btn--deactivate');
    });
  });
});
