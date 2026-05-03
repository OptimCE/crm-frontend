import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormControl } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { MeterCreation } from './meter-creation';
import { eanValidator } from './ean.validator';
import { MemberService } from '../../../../shared/services/member.service';
import { MeterService } from '../../../../shared/services/meter.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { MembersPartialDTO } from '../../../../shared/dtos/member.dtos';
import { CreateMeterDTO } from '../../../../shared/dtos/meter.dtos';
import { ApiResponse, ApiResponsePaginated, Pagination } from '../../../../core/dtos/api.response';
import {
  ProductionChain,
  InjectionStatus,
  MeterDataStatus,
} from '../../../../shared/types/meter.types';

// ── Helpers ──────────────────────────────────────────────────────────

const fakeMembersList: MembersPartialDTO[] = [
  { id: 1, name: 'Alice', member_type: 1, status: 1 },
  { id: 2, name: 'Bob', member_type: 2, status: 1 },
];

function membersResponse(): ApiResponsePaginated<MembersPartialDTO[] | string> {
  return new ApiResponsePaginated(fakeMembersList, new Pagination(1, 100, 2, 1));
}

/** Fill the form with valid values for all required controls. */
function fillFormCompletely(component: MeterCreation): void {
  component.metersForm.patchValue({
    address_street: 'Rue de la Loi',
    address_number: '16',
    address_postcode: '1000',
    address_city: 'Brussels',
    EAN: '5414489196362',
    grd: 'RESA',
    meterNumber: 'MTR-001',
    tarifGroup: { id: 1, name: 'Low Voltage' },
    phasesNumber: { id: 1, name: 'Single Phase' },
    readingFrequency: { id: 1, name: 'Monthly' },
    description: 'Test meter',
    samplingPower: 10,
    totalGeneratingCapacity: 5,
    amperage: 25,
    rate: { id: 1, name: 'Simple' },
    productionChain: { id: ProductionChain.PHOTOVOLTAIC, name: 'Photovoltaic' },
    clientType: { id: 1, name: 'Residential' },
    member: fakeMembersList[0],
    dateStart: new Date('2026-04-01'),
  });
  // injectionStatus is disabled, so use setValue through the control
  component.metersForm.get('injectionStatus')?.setValue({
    id: InjectionStatus.AUTOPROD_OWNER,
    name: 'Autoproducer Owner',
  });
}

// ── Test Suite ───────────────────────────────────────────────────────

describe('MeterCreation', () => {
  let component: MeterCreation;
  let fixture: ComponentFixture<MeterCreation>;
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };
  let dialogConfigStub: { data: { holder_id?: number } };
  let memberServiceSpy: { getMembersList: ReturnType<typeof vi.fn> };
  let meterServiceSpy: { addMeter: ReturnType<typeof vi.fn> };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    dialogRefSpy = { close: vi.fn() };
    dialogConfigStub = { data: {} };
    memberServiceSpy = { getMembersList: vi.fn().mockReturnValue(of(membersResponse())) };
    meterServiceSpy = { addMeter: vi.fn().mockReturnValue(of(new ApiResponse('ok'))) };
    errorHandlerSpy = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [MeterCreation, TranslateModule.forRoot()],
      providers: [
        { provide: DynamicDialogRef, useValue: dialogRefSpy },
        { provide: DynamicDialogConfig, useValue: dialogConfigStub },
        { provide: MemberService, useValue: memberServiceSpy },
        { provide: MeterService, useValue: meterServiceSpy },
        { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(MeterCreation, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(MeterCreation);
    component = fixture.componentInstance;
    component.ngOnInit();
  });

  // ── 1. Component creation & initialization ─────────────────────────

  describe('initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize the form with all expected controls', () => {
      const expectedControls = [
        'address_street',
        'address_number',
        'address_postcode',
        'address_supplement',
        'address_city',
        'EAN',
        'grd',
        'meterNumber',
        'tarifGroup',
        'phasesNumber',
        'readingFrequency',
        'description',
        'samplingPower',
        'totalGeneratingCapacity',
        'amperage',
        'rate',
        'productionChain',
        'clientType',
        'member',
        'dateStart',
        'injectionStatus',
      ];
      for (const name of expectedControls) {
        expect(component.metersForm.get(name)).toBeTruthy();
      }
    });

    it('should call getMembersList on init', () => {
      expect(memberServiceSpy.getMembersList).toHaveBeenCalledWith({ page: 1, limit: 100 });
    });

    it('should populate membersList signal from service response', () => {
      expect(component.membersList()).toEqual(fakeMembersList);
    });

    it('should call errorHandler when getMembersList returns falsy data', () => {
      const emptyResponse = new ApiResponsePaginated(
        null as unknown as MembersPartialDTO[] | string,
        new Pagination(),
      );
      memberServiceSpy.getMembersList.mockReturnValue(of(emptyResponse));
      component.ngOnInit();
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });

    it('should call errorHandler when getMembersList throws an error', () => {
      memberServiceSpy.getMembersList.mockReturnValue(throwError(() => new Error('Network error')));
      component.ngOnInit();
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });

    it('should have injectionStatus disabled by default', () => {
      expect(component.metersForm.get('injectionStatus')?.disabled).toBe(true);
    });
  });

  // ── 1b. holder_id pre-selection ────────────────────────────────────

  describe('initialization with holder_id', () => {
    it('should pre-select member when holder_id is provided via DynamicDialogConfig', () => {
      dialogConfigStub.data = { holder_id: 2 };

      const fixture2 = TestBed.createComponent(MeterCreation);
      const comp2 = fixture2.componentInstance;
      comp2.ngOnInit();

      expect(comp2.metersForm.get('member')?.value).toEqual(fakeMembersList[1]);
    });
  });

  // ── 2. Translation category setup ─────────────────────────────────

  describe('translation category setup', () => {
    it('should populate productionChainCategory signal', () => {
      expect(component.productionChainCategory().length).toBe(8);
      expect(component.productionChainCategory()[0].id).toBe(ProductionChain.PHOTOVOLTAIC);
    });

    it('should populate rateCategory signal', () => {
      expect(component.rateCategory().length).toBe(3);
    });

    it('should populate clientCategory signal', () => {
      expect(component.clientCategory().length).toBe(3);
    });

    it('should populate injectionStatusCategory signal', () => {
      expect(component.injectionStatusCategory().length).toBe(5);
    });

    it('should populate tarifGroupCategory signal', () => {
      expect(component.tarifGroupCategory().length).toBe(2);
    });

    it('should populate phaseCategory signal', () => {
      expect(component.phaseCategory().length).toBe(2);
    });

    it('should populate readingFrequencyCategory signal', () => {
      expect(component.readingFrequencyCategory().length).toBe(2);
    });
  });

  // ── 3. Form validation ────────────────────────────────────────────

  describe('form validation', () => {
    it('should be invalid when empty', () => {
      expect(component.metersForm.valid).toBe(false);
    });

    it('should be valid when all required fields are filled', () => {
      fillFormCompletely(component);
      expect(component.metersForm.valid).toBe(true);
    });

    it('should be invalid if a required field is missing', () => {
      fillFormCompletely(component);
      component.metersForm.get('EAN')?.setValue('');
      expect(component.metersForm.valid).toBe(false);
    });
  });

  // ── 4. validateStep1 ──────────────────────────────────────────────

  describe('validateStep1', () => {
    it('should mark step1 controls as touched', () => {
      const callback = vi.fn();
      component.validateStep1(callback);
      const step1Controls = [
        'address_street',
        'address_number',
        'address_postcode',
        'address_city',
        'EAN',
        'meterNumber',
        'tarifGroup',
        'phasesNumber',
        'readingFrequency',
      ];
      for (const name of step1Controls) {
        expect(component.metersForm.get(name)?.touched).toBe(true);
      }
    });

    it('should NOT call activateCallback when step1 controls are invalid', () => {
      const callback = vi.fn();
      component.validateStep1(callback);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should call activateCallback(1) when step1 controls are valid', () => {
      const callback = vi.fn();
      component.metersForm.patchValue({
        address_street: 'Rue Test',
        address_number: '1',
        address_postcode: '1000',
        address_city: 'Brussels',
        EAN: '5414489196362',
        meterNumber: 'MTR-001',
        tarifGroup: { id: 1, name: 'Low Voltage' },
        phasesNumber: { id: 1, name: 'Single Phase' },
        readingFrequency: { id: 1, name: 'Monthly' },
      });
      component.validateStep1(callback);
      expect(callback).toHaveBeenCalledWith(1);
    });
  });

  // ── 5. onSubmit ───────────────────────────────────────────────────

  describe('onSubmit', () => {
    it('should not call addMeter when form is invalid', () => {
      component.onSubmit();
      expect(meterServiceSpy.addMeter).not.toHaveBeenCalled();
    });

    it('should call addMeter with correct DTO when form is valid', () => {
      fillFormCompletely(component);
      component.onSubmit();
      expect(meterServiceSpy.addMeter).toHaveBeenCalledTimes(1);

      const dto = meterServiceSpy.addMeter.mock.calls[0][0] as CreateMeterDTO;
      expect(dto.EAN).toBe('5414489196362');
      expect(dto.meter_number).toBe('MTR-001');
      expect(dto.address.street).toBe('Rue de la Loi');
      expect(dto.address.number).toBe(16);
      expect(dto.address.postcode).toBe('1000');
      expect(dto.address.city).toBe('Brussels');
      expect(dto.initial_data.status).toBe(MeterDataStatus.INACTIVE);
      expect(dto.initial_data.member_id).toBe(1);
      // Calendar dates must travel as YYYY-MM-DD using the user's local components,
      // not as a UTC-shifted Date — guards against the timezone off-by-one bug.
      expect(dto.initial_data.start_date).toBe('2026-04-01');
    });

    it('should close dialog on successful response', () => {
      fillFormCompletely(component);
      component.onSubmit();
      expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
    });

    it('should call errorHandler when addMeter returns falsy response', () => {
      meterServiceSpy.addMeter.mockReturnValue(of(null));
      fillFormCompletely(component);
      component.onSubmit();
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });

    it('should call errorHandler with data on ApiResponse error', () => {
      const apiError = new ApiResponse('EAN_ALREADY_EXISTS', 400);
      meterServiceSpy.addMeter.mockReturnValue(throwError(() => apiError));
      fillFormCompletely(component);
      component.onSubmit();
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith('EAN_ALREADY_EXISTS');
    });

    it('should call errorHandler with null on non-ApiResponse error', () => {
      meterServiceSpy.addMeter.mockReturnValue(throwError(() => new Error('network')));
      fillFormCompletely(component);
      component.onSubmit();
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(null);
    });
  });

  // ── 6. onChangeProductionChain ────────────────────────────────────

  describe('onChangeProductionChain', () => {
    it('should disable injectionStatus and set NONE when productionChain is NONE', () => {
      // Setup the injectionStatusCategory with a NONE option
      component.injectionStatusCategory.set([
        { id: InjectionStatus.AUTOPROD_OWNER, name: 'Autoproducer Owner' },
        { id: InjectionStatus.NONE, name: 'None' },
      ]);

      component.metersForm.patchValue({
        productionChain: { id: ProductionChain.NONE, name: 'None' },
      });
      component.onChangeProductionChain();

      expect(component.metersForm.get('injectionStatus')?.disabled).toBe(true);
      expect(component.metersForm.get('injectionStatus')?.value).toEqual({
        id: InjectionStatus.NONE,
        name: 'None',
      });
    });

    it('should enable injectionStatus when productionChain is not NONE', () => {
      component.metersForm.patchValue({
        productionChain: { id: ProductionChain.PHOTOVOLTAIC, name: 'Photovoltaic' },
      });
      component.onChangeProductionChain();

      expect(component.metersForm.get('injectionStatus')?.disabled).toBe(false);
    });
  });

  // ── 7. validMemberValidator ───────────────────────────────────────

  describe('validMemberValidator', () => {
    it('should return null when value is null', () => {
      const validator = component.validMemberValidator();
      const ctrl = new FormControl(null);
      expect(validator(ctrl)).toBeNull();
    });

    it('should return null for a valid member in the list', () => {
      const validator = component.validMemberValidator();
      const ctrl = new FormControl(fakeMembersList[0]);
      expect(validator(ctrl)).toBeNull();
    });

    it('should return invalidMember error for an unknown member', () => {
      const validator = component.validMemberValidator();
      const ctrl = new FormControl({ id: 999, name: 'Unknown', member_type: 1, status: 1 });
      expect(validator(ctrl)).toEqual({ invalidMember: true });
    });
  });
});

// ── EAN Validator ───────────────────────────────────────────────────

describe('eanValidator', () => {
  const validator = eanValidator();

  it('should return null for empty value', () => {
    const ctrl = new FormControl('');
    expect(validator(ctrl)).toBeNull();
  });

  it('should return null for null value', () => {
    const ctrl = new FormControl(null);
    expect(validator(ctrl)).toBeNull();
  });

  it('should return null for a valid 13-digit EAN', () => {
    const ctrl = new FormControl('5414489196362');
    expect(validator(ctrl)).toBeNull();
  });

  it('should return invalidEan error for non-numeric EAN', () => {
    const ctrl = new FormControl('541448919636A');
    expect(validator(ctrl)).toEqual({ invalidEan: true });
  });

  it('should return invalidEan error for EAN with wrong length', () => {
    const ctrl = new FormControl('12345');
    expect(validator(ctrl)).toEqual({ invalidEan: true });
  });

  it('should return invalidEan error for EAN with 14 digits', () => {
    const ctrl = new FormControl('54144891963621');
    expect(validator(ctrl)).toEqual({ invalidEan: true });
  });

  it('should trim whitespace and validate', () => {
    const ctrl = new FormControl('  5414489196362  ');
    expect(validator(ctrl)).toBeNull();
  });
});
