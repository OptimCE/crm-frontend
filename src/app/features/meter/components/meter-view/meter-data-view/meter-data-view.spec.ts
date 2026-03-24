import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { MeterDataView } from './meter-data-view';
import { MetersDataDTO } from '../../../../../shared/dtos/meter.dtos';
import {
  ClientType,
  InjectionStatus,
  MeterDataStatus,
  MeterRate,
  ProductionChain,
} from '../../../../../shared/types/meter.types';
import { MemberType, MemberStatus } from '../../../../../shared/types/member.types';

function buildMeterData(overrides: Partial<MetersDataDTO> = {}): MetersDataDTO {
  return {
    id: 1,
    description: 'Test meter description',
    sampling_power: 100,
    status: MeterDataStatus.ACTIVE,
    amperage: 40,
    rate: 1 as MeterRate,
    client_type: 1 as ClientType,
    start_date: new Date('2024-01-15'),
    end_date: new Date('2025-12-31'),
    injection_status: 0 as InjectionStatus,
    production_chain: 0 as ProductionChain,
    totalGenerating_capacity: 500,
    grd: 'ORES',
    member: {
      id: 10,
      name: 'John Doe',
      member_type: MemberType.INDIVIDUAL,
      status: MemberStatus.ACTIVE,
    },
    sharing_operation: {
      id: 5,
      name: 'Test Operation',
      type: 1,
    },
    ...overrides,
  };
}

const DEFAULT_MAPS = {
  productionChainMap: ['Solar', 'Wind', 'Hydro'],
  injectionStatusMap: ['None', 'Partial', 'Full'],
  rateMap: ['Mono', 'Bi', 'Excl. Night'],
  clientTypeMap: ['Residential', 'Professional'],
};

function setInputs(
  fixture: ComponentFixture<MeterDataView>,
  meterData: MetersDataDTO,
  maps: Partial<typeof DEFAULT_MAPS> = {},
): void {
  const m = { ...DEFAULT_MAPS, ...maps };
  fixture.componentRef.setInput('meterData', meterData);
  fixture.componentRef.setInput('productionChainMap', m.productionChainMap);
  fixture.componentRef.setInput('injectionStatusMap', m.injectionStatusMap);
  fixture.componentRef.setInput('rateMap', m.rateMap);
  fixture.componentRef.setInput('clientTypeMap', m.clientTypeMap);
}

function getEl(fixture: ComponentFixture<MeterDataView>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function getCards(fixture: ComponentFixture<MeterDataView>): NodeListOf<HTMLElement> {
  return getEl(fixture).querySelectorAll('p-card');
}

describe('MeterDataView', () => {
  let component: MeterDataView;
  let fixture: ComponentFixture<MeterDataView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeterDataView, TranslateModule.forRoot()],
    }).compileComponents();

    fixture = TestBed.createComponent(MeterDataView);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    setInputs(fixture, buildMeterData());
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('Status tag rendering', () => {
    it('should render a success tag for ACTIVE status', () => {
      setInputs(fixture, buildMeterData({ status: MeterDataStatus.ACTIVE }));
      fixture.detectChanges();
      const tag = getEl(fixture).querySelector('p-tag');
      expect(tag).toBeTruthy();
      expect(tag?.getAttribute('severity')).toBe('success');
    });

    it('should render a danger tag for INACTIVE status', () => {
      setInputs(fixture, buildMeterData({ status: MeterDataStatus.INACTIVE }));
      fixture.detectChanges();
      const tag = getEl(fixture).querySelector('p-tag');
      expect(tag).toBeTruthy();
      expect(tag?.getAttribute('severity')).toBe('danger');
    });

    it('should render an info tag for WAITING_GRD status', () => {
      setInputs(fixture, buildMeterData({ status: MeterDataStatus.WAITING_GRD }));
      fixture.detectChanges();
      const tag = getEl(fixture).querySelector('p-tag');
      expect(tag).toBeTruthy();
      expect(tag?.getAttribute('severity')).toBe('info');
    });

    it('should render an info tag for WAITING_MANAGER status', () => {
      setInputs(fixture, buildMeterData({ status: MeterDataStatus.WAITING_MANAGER }));
      fixture.detectChanges();
      const tag = getEl(fixture).querySelector('p-tag');
      expect(tag).toBeTruthy();
      expect(tag?.getAttribute('severity')).toBe('info');
    });
  });

  describe('Description card — conditional fields', () => {
    it('should display the description text when provided', () => {
      setInputs(fixture, buildMeterData({ description: 'My meter description' }));
      fixture.detectChanges();
      const descriptionEl = getEl(fixture).querySelector('.whitespace-pre-line');
      expect(descriptionEl).toBeTruthy();
      expect(descriptionEl?.textContent?.trim()).toBe('My meter description');
    });

    it('should display "--" when description is empty', () => {
      setInputs(fixture, buildMeterData({ description: '' }));
      fixture.detectChanges();
      const firstCard = getCards(fixture)[0];
      const emptyFields = firstCard.querySelectorAll('.field-empty');
      const hasPlaceholder = Array.from(emptyFields).some((el) => el.textContent?.trim() === '--');
      expect(hasPlaceholder).toBe(true);
    });

    it('should display formatted start_date when provided', () => {
      setInputs(fixture, buildMeterData({ start_date: new Date('2024-03-15') }));
      fixture.detectChanges();
      const firstCard = getCards(fixture)[0];
      const fieldValues = firstCard.querySelectorAll('.field-value');
      const hasDate = Array.from(fieldValues).some((el) =>
        el.textContent?.trim().includes('15/03/2024'),
      );
      expect(hasDate).toBe(true);
    });

    it('should display "--" when start_date is missing', () => {
      setInputs(fixture, buildMeterData({ start_date: undefined as unknown as Date }));
      fixture.detectChanges();
      const firstCard = getCards(fixture)[0];
      const emptyFields = firstCard.querySelectorAll('.field-empty');
      expect(emptyFields.length).toBeGreaterThanOrEqual(1);
    });

    it('should display formatted end_date when provided', () => {
      setInputs(fixture, buildMeterData({ end_date: new Date('2025-06-30') }));
      fixture.detectChanges();
      const firstCard = getCards(fixture)[0];
      const fieldValues = firstCard.querySelectorAll('.field-value');
      const hasDate = Array.from(fieldValues).some((el) =>
        el.textContent?.trim().includes('30/06/2025'),
      );
      expect(hasDate).toBe(true);
    });

    it('should display "--" when end_date is missing', () => {
      setInputs(fixture, buildMeterData({ end_date: undefined }));
      fixture.detectChanges();
      const firstCard = getCards(fixture)[0];
      const emptyFields = firstCard.querySelectorAll('.field-empty');
      const hasPlaceholder = Array.from(emptyFields).some((el) => el.textContent?.trim() === '--');
      expect(hasPlaceholder).toBe(true);
    });
  });

  describe('Energy characteristics card — conditional fields', () => {
    it('should display sampling_power value when not null', () => {
      setInputs(fixture, buildMeterData({ sampling_power: 250 }));
      fixture.detectChanges();
      const secondCard = getCards(fixture)[1];
      const fieldValues = secondCard.querySelectorAll('.field-value');
      const hasPower = Array.from(fieldValues).some((el) => el.textContent?.trim().includes('250'));
      expect(hasPower).toBe(true);
    });

    it('should display "--" when sampling_power is null', () => {
      setInputs(fixture, buildMeterData({ sampling_power: null as unknown as number }));
      fixture.detectChanges();
      const secondCard = getCards(fixture)[1];
      const emptyFields = secondCard.querySelectorAll('.field-empty');
      const hasPlaceholder = Array.from(emptyFields).some((el) => el.textContent?.trim() === '--');
      expect(hasPlaceholder).toBe(true);
    });

    it('should display totalGenerating_capacity value when not null', () => {
      setInputs(fixture, buildMeterData({ totalGenerating_capacity: 750 }));
      fixture.detectChanges();
      const secondCard = getCards(fixture)[1];
      const fieldValues = secondCard.querySelectorAll('.field-value');
      const hasCapacity = Array.from(fieldValues).some((el) =>
        el.textContent?.trim().includes('750'),
      );
      expect(hasCapacity).toBe(true);
    });

    it('should display "--" when totalGenerating_capacity is null', () => {
      setInputs(fixture, buildMeterData({ totalGenerating_capacity: null as unknown as number }));
      fixture.detectChanges();
      const secondCard = getCards(fixture)[1];
      const emptyFields = secondCard.querySelectorAll('.field-empty');
      const hasPlaceholder = Array.from(emptyFields).some((el) => el.textContent?.trim() === '--');
      expect(hasPlaceholder).toBe(true);
    });

    it('should display amperage value when not null', () => {
      setInputs(fixture, buildMeterData({ amperage: 32 }));
      fixture.detectChanges();
      const secondCard = getCards(fixture)[1];
      const fieldValues = secondCard.querySelectorAll('.field-value');
      const hasAmperage = Array.from(fieldValues).some((el) =>
        el.textContent?.trim().includes('32'),
      );
      expect(hasAmperage).toBe(true);
    });

    it('should display "--" when amperage is null', () => {
      setInputs(fixture, buildMeterData({ amperage: null as unknown as number }));
      fixture.detectChanges();
      const secondCard = getCards(fixture)[1];
      const emptyFields = secondCard.querySelectorAll('.field-empty');
      const hasPlaceholder = Array.from(emptyFields).some((el) => el.textContent?.trim() === '--');
      expect(hasPlaceholder).toBe(true);
    });

    it('should display production_chain mapped value', () => {
      setInputs(fixture, buildMeterData({ production_chain: 1 as ProductionChain }));
      fixture.detectChanges();
      const secondCard = getCards(fixture)[1];
      const fieldValues = secondCard.querySelectorAll('.field-value');
      const hasMapped = Array.from(fieldValues).some((el) =>
        el.textContent?.trim().includes('Wind'),
      );
      expect(hasMapped).toBe(true);
    });

    it('should display injection_status mapped value', () => {
      setInputs(fixture, buildMeterData({ injection_status: 2 as InjectionStatus }));
      fixture.detectChanges();
      const secondCard = getCards(fixture)[1];
      const fieldValues = secondCard.querySelectorAll('.field-value');
      const hasMapped = Array.from(fieldValues).some((el) =>
        el.textContent?.trim().includes('Full'),
      );
      expect(hasMapped).toBe(true);
    });
  });

  describe('Financial characteristics card', () => {
    it('should display rate mapped value', () => {
      setInputs(fixture, buildMeterData({ rate: 1 as MeterRate }));
      fixture.detectChanges();
      const thirdCard = getCards(fixture)[2];
      const fieldValues = thirdCard.querySelectorAll('.field-value');
      const hasMapped = Array.from(fieldValues).some((el) => el.textContent?.trim().includes('Bi'));
      expect(hasMapped).toBe(true);
    });

    it('should display client_type (usage) mapped value', () => {
      setInputs(fixture, buildMeterData({ client_type: 1 as ClientType }));
      fixture.detectChanges();
      const thirdCard = getCards(fixture)[2];
      const fieldValues = thirdCard.querySelectorAll('.field-value');
      const hasMapped = Array.from(fieldValues).some((el) =>
        el.textContent?.trim().includes('Professional'),
      );
      expect(hasMapped).toBe(true);
    });

    it('should display grd value when provided', () => {
      setInputs(fixture, buildMeterData({ grd: 'ORES' }));
      fixture.detectChanges();
      const thirdCard = getCards(fixture)[2];
      const fieldValues = thirdCard.querySelectorAll('.field-value');
      const hasGrd = Array.from(fieldValues).some((el) => el.textContent?.trim().includes('ORES'));
      expect(hasGrd).toBe(true);
    });

    it('should display "--" when grd is empty', () => {
      setInputs(fixture, buildMeterData({ grd: '' }));
      fixture.detectChanges();
      const thirdCard = getCards(fixture)[2];
      const emptyFields = thirdCard.querySelectorAll('.field-empty');
      const hasPlaceholder = Array.from(emptyFields).some((el) => el.textContent?.trim() === '--');
      expect(hasPlaceholder).toBe(true);
    });

    it('should display sharing_operation link with correct href and name', () => {
      setInputs(
        fixture,
        buildMeterData({
          sharing_operation: { id: 42, name: 'My Operation', type: 1 },
        }),
      );
      fixture.detectChanges();
      const thirdCard = getCards(fixture)[2];
      const link = thirdCard.querySelector('a[href="/sharing_operations/42"]');
      expect(link).toBeTruthy();
      expect(link?.textContent?.trim()).toBe('My Operation');
    });

    it('should display no sharing operation text when sharing_operation is missing', () => {
      setInputs(fixture, buildMeterData({ sharing_operation: undefined }));
      fixture.detectChanges();
      const thirdCard = getCards(fixture)[2];
      const emptyFields = thirdCard.querySelectorAll('.field-empty');
      const hasNoOp = Array.from(emptyFields).some((el) =>
        el.textContent?.trim().includes('METER.DATA.NO_SHARING_OPERATION_FOUND'),
      );
      expect(hasNoOp).toBe(true);
    });

    it('should display member link with correct href and name', () => {
      setInputs(
        fixture,
        buildMeterData({
          member: {
            id: 99,
            name: 'Jane Smith',
            member_type: MemberType.INDIVIDUAL,
            status: MemberStatus.ACTIVE,
          },
        }),
      );
      fixture.detectChanges();
      const thirdCard = getCards(fixture)[2];
      const link = thirdCard.querySelector('a[href="/members/99"]');
      expect(link).toBeTruthy();
      expect(link?.textContent?.trim()).toBe('Jane Smith');
    });

    it('should display pi-user icon for INDIVIDUAL member type', () => {
      setInputs(
        fixture,
        buildMeterData({
          member: {
            id: 10,
            name: 'John Doe',
            member_type: MemberType.INDIVIDUAL,
            status: MemberStatus.ACTIVE,
          },
        }),
      );
      fixture.detectChanges();
      const thirdCard = getCards(fixture)[2];
      const icon = thirdCard.querySelector('i.pi-user');
      expect(icon).toBeTruthy();
    });

    it('should display pi-building icon for COMPANY member type', () => {
      setInputs(
        fixture,
        buildMeterData({
          member: {
            id: 20,
            name: 'Acme Corp',
            member_type: MemberType.COMPANY,
            status: MemberStatus.ACTIVE,
          },
        }),
      );
      fixture.detectChanges();
      const thirdCard = getCards(fixture)[2];
      const icon = thirdCard.querySelector('i.pi-building');
      expect(icon).toBeTruthy();
    });

    it('should display no owner found text when member is missing', () => {
      setInputs(fixture, buildMeterData({ member: undefined }));
      fixture.detectChanges();
      const thirdCard = getCards(fixture)[2];
      const emptyFields = thirdCard.querySelectorAll('.field-empty');
      const hasNoOwner = Array.from(emptyFields).some((el) =>
        el.textContent?.trim().includes('METER.DATA.NO_OWNER_FOUND_LABEL'),
      );
      expect(hasNoOwner).toBe(true);
    });
  });
});
