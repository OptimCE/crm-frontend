import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { FormControl } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Observable, of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { MeterCreation } from './meter-creation';
import { MemberService } from '../../../../shared/services/member.service';
import { MeterService } from '../../../../shared/services/meter.service';
import { DsoService } from '../../../../shared/services/dso.service';
import {
  DsoNames,
  DsoOperatorDTO,
  DsoResolutionDTO,
  DsoResolveQuery,
  DsoResultDTO,
  DsoSectionDTO,
} from '../../../../shared/dtos/dso.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { MembersPartialDTO } from '../../../../shared/dtos/member.dtos';
import { CreateMeterDTO } from '../../../../shared/dtos/meter.dtos';
import { ApiResponse, ApiResponsePaginated, Pagination } from '../../../../core/dtos/api.response';
import {
  ProductionChain,
  InjectionStatus,
  MeterDataStatus,
  PhaseCategory,
  ReadingFrequency,
  TarifGroup,
  MeterRate,
  ClientType,
} from '../../../../shared/types/meter.types';
import { AddressGeoPrecision, AddressSuggestionDTO } from '../../../../shared/dtos/geocoding.dtos';
import { AddressPicked } from '../../../../shared/components/address-autocomplete/address-autocomplete';
import { addressFingerprint } from '../../../../shared/components/address-autocomplete/address-field-source';

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
    EAN: '541448200000000001',
    grd: 'resa',
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

// ── GRD lookup fixtures ──────────────────────────────────────────────

type DsoAnswer = Observable<ApiResponse<DsoResolutionDTO | string>>;

function placeNames(fr: string, nl = fr, de = fr): DsoNames {
  return { fr, nl, de };
}

function dsoResult(operator: string, over: Partial<DsoResultDTO> = {}): DsoResultDTO {
  return {
    ins: '62063',
    commune: placeNames('Liège', 'Luik', 'Lüttich'),
    section: null,
    region: 'WAL',
    regulator: 'BE-WAL-CWAPE',
    elec: { operator, designated: operator },
    gas: { status: 'designated', operator },
    flags: [],
    note: null,
    source_ids: ['cwape-2026'],
    valid_from: null,
    data_version: '2026.10.0',
    ...over,
  };
}

function dsoResolution(over: Partial<DsoResolutionDTO> = {}): DsoResolutionDTO {
  return { available: true, status: 'ok', warnings: [], data_version: '2026.10.0', ...over };
}

function answer(resolution: DsoResolutionDTO): DsoAnswer {
  return of(new ApiResponse<DsoResolutionDTO | string>(resolution));
}

function dsoSection(key: string, fr: string, operator: string, postcodes: string[]): DsoSectionDTO {
  return { section_key: key, names: placeNames(fr), postcodes, elec_operator: operator };
}

function dsoOperator(id: string, name: string, over: Partial<DsoOperatorDTO> = {}): DsoOperatorDTO {
  return {
    id,
    kind: 'grd',
    name,
    legal_name: name,
    region: 'WAL',
    elec: true,
    gas: false,
    website: '',
    regulator: 'BE-WAL-CWAPE',
    tariffs_url: '',
    lookup: true,
    replaced_by: null,
    ...over,
  };
}

/** Step 1 as a user leaves it: a typed (not picked) Liège address, and the identity. */
function fillStep1(component: MeterCreation): void {
  component.metersForm.patchValue({
    address_street: 'Rue Léopold',
    address_number: '1',
    address_postcode: '4000',
    address_city: 'Liège',
    EAN: ' 541448200000000001 ',
    meterNumber: 'MTR-001',
    tarifGroup: { id: 1, name: 'Low Voltage' },
    phasesNumber: { id: 1, name: 'Single Phase' },
    readingFrequency: { id: 1, name: 'Monthly' },
  });
}

/** Fill step 2 too, keeping whatever the lookup put in the GRD select. */
function fillStep2(component: MeterCreation): void {
  const grd = component.metersForm.get('grd')?.value as string;
  fillFormCompletely(component);
  component.metersForm.patchValue({
    address_street: 'Rue Léopold',
    address_number: '1',
    address_postcode: '4000',
    address_city: 'Liège',
    grd,
  });
}

// ── Test Suite ───────────────────────────────────────────────────────

/**
 * Drive the picker's output the way the template does.
 *
 * `onAddressPicked` and the pick store are `protected` because only the
 * template touches them in production — but "the six forms are wired
 * identically" is an assumption, and a @ViewChild that never resolved has
 * already proved that assumption can be wrong.
 */
function pickAddress(
  component: object,
  handler: string,
  fields: { street: string; number: string; postcode: string; city: string },
  extra: Partial<AddressSuggestionDTO> = {},
): void {
  const suggestion: AddressSuggestionDTO = {
    id: 'best:42',
    kind: 'address',
    label: `${fields.street} ${fields.number}, ${fields.postcode} ${fields.city}`,
    street: fields.street,
    number: fields.number,
    postcode: fields.postcode,
    city: fields.city,
    country: 'BE',
    latitude: 50.846169,
    longitude: 4.366538,
    precision: AddressGeoPrecision.ROOFTOP,
    best_address_id: 'best:42',
    ...extra,
  };
  const full = { ...fields, supplement: '' };
  (component as Record<string, (e: AddressPicked) => void>)[handler]({
    suggestion,
    fields: full,
    fingerprint: addressFingerprint(full),
  });
}

/**
 * `addressDetailsOpen` and `openAddressDetails` are `protected` for the same
 * reason `onAddressPicked` is: only the template touches them in production.
 */
function detailsOpen(component: object): boolean {
  return (component as { addressDetailsOpen: () => boolean }).addressDetailsOpen();
}

function openDetails(component: object): void {
  (component as { openAddressDetails: () => void }).openAddressDetails();
}

describe('MeterCreation', () => {
  let component: MeterCreation;
  let fixture: ComponentFixture<MeterCreation>;
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };
  let dialogConfigStub: { data: { holder_id?: number } };
  let memberServiceSpy: { getMembersList: ReturnType<typeof vi.fn> };
  let meterServiceSpy: { addMeter: ReturnType<typeof vi.fn> };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };
  let dsoServiceSpy: {
    getOperators: ReturnType<typeof vi.fn>;
    resolve: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    dialogRefSpy = { close: vi.fn() };
    dialogConfigStub = { data: {} };
    memberServiceSpy = { getMembersList: vi.fn().mockReturnValue(of(membersResponse())) };
    meterServiceSpy = { addMeter: vi.fn().mockReturnValue(of(new ApiResponse('ok'))) };
    errorHandlerSpy = { handleError: vi.fn() };
    // dso-lookup off, as crm-backend answers it: an empty catalogue, `unavailable`.
    dsoServiceSpy = {
      getOperators: vi.fn().mockReturnValue(of(new ApiResponse<DsoOperatorDTO[]>([]))),
      resolve: vi
        .fn()
        .mockReturnValue(answer({ available: false, status: 'unavailable', warnings: [] })),
    };

    await TestBed.configureTestingModule({
      imports: [MeterCreation, TranslateModule.forRoot()],
      providers: [
        { provide: DynamicDialogRef, useValue: dialogRefSpy },
        { provide: DynamicDialogConfig, useValue: dialogConfigStub },
        { provide: MemberService, useValue: memberServiceSpy },
        { provide: MeterService, useValue: meterServiceSpy },
        { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
        { provide: DsoService, useValue: dsoServiceSpy },
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

    it("shows the server's message when the members cannot be loaded", () => {
      const message = 'The members could not be retrieved';
      memberServiceSpy.getMembersList.mockReturnValue(
        throwError(
          () => new HttpErrorResponse({ status: 500, error: { data: message, error_code: 1 } }),
        ),
      );
      component.ngOnInit();
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(message);
    });

    it('should have injectionStatus disabled by default', () => {
      expect(component.metersForm.get('injectionStatus')?.disabled).toBe(true);
    });

    it('offers the GRDs of every region, then Elia apart and last', () => {
      const options = component.grdAvailable();
      expect(options[0].id).toBe('ores');
      expect(options.map((g) => g.name)).toEqual(
        expect.arrayContaining(['ORES', 'Sibelga', 'Fluvius Antwerpen']),
      );
      // No translations are loaded, so Elia's label reads as its key.
      expect(options.at(-1)).toEqual({
        id: 'elia',
        name: 'METER.INFORMATIONS.GRD_ELIA_OPTION',
        kind: 'grtl',
      });
      expect(options.filter((g) => g.kind === 'grtl')).toHaveLength(1);
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

    it('should reject a malformed EAN through the EAN control', () => {
      fillFormCompletely(component);
      component.metersForm.get('EAN')?.setValue('12345');
      expect(component.metersForm.get('EAN')?.hasError('invalidEan')).toBe(true);
      expect(component.metersForm.valid).toBe(false);
    });

    it('should accept a valid 18-digit EAN through the EAN control', () => {
      fillFormCompletely(component);
      component.metersForm.get('EAN')?.setValue('541448200000000001');
      expect(component.metersForm.get('EAN')?.hasError('invalidEan')).toBe(false);
      expect(component.metersForm.get('EAN')?.valid).toBe(true);
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
        EAN: '541448200000000001',
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
      expect(dto.EAN).toBe('541448200000000001');
      expect(dto.meter_number).toBe('MTR-001');
      expect(dto.address.street).toBe('Rue de la Loi');
      expect(dto.address.number).toBe('16');
      expect(dto.address.postcode).toBe('1000');
      expect(dto.address.city).toBe('Brussels');
      expect(dto.initial_data.status).toBe(MeterDataStatus.INACTIVE);
      expect(dto.initial_data.member_id).toBe(1);
      // Calendar dates must travel as YYYY-MM-DD using the user's local components,
      // not as a UTC-shifted Date — guards against the timezone off-by-one bug.
      expect(dto.initial_data.start_date).toBe('2026-04-01');
    });

    // Regression: the box number was collected by the form and then silently
    // dropped from the payload, while meter-UPDATE kept it — so a box typed at
    // creation only appeared after the first edit.
    it('should carry the box number (supplement) into the DTO', () => {
      fillFormCompletely(component);
      component.metersForm.patchValue({ address_supplement: 'B12' });
      component.onSubmit();

      const dto = meterServiceSpy.addMeter.mock.calls[0][0] as CreateMeterDTO;
      expect(dto.address.supplement).toBe('B12');
    });

    it('sends the chosen production chain and injection status', () => {
      fillFormCompletely(component);
      component.onSubmit();

      const dto = meterServiceSpy.addMeter.mock.calls[0][0] as CreateMeterDTO;
      expect(dto.initial_data.production_chain).toBe(ProductionChain.PHOTOVOLTAIC);
      expect(dto.initial_data.injection_status).toBe(InjectionStatus.AUTOPROD_OWNER);
    });

    // Regression: "Aucun" sent 8 / 5, which the backend enums (and the CHECKs on
    // meter_data) do not have, so every meter without production answered 422
    // "Le champ 'injection_status' doit être de type 'InjectionStatus'".
    it('leaves both out when the production chain is "Aucun"', () => {
      component.injectionStatusCategory.set([
        { id: InjectionStatus.AUTOPROD_OWNER, name: 'Autoproducer Owner' },
        { id: InjectionStatus.NONE, name: 'None' },
      ]);
      fillFormCompletely(component);
      component.metersForm.patchValue({
        productionChain: { id: ProductionChain.NONE, name: 'None' },
      });
      component.onChangeProductionChain();
      component.onSubmit();

      // What travels: JSON drops the undefined keys, and the columns stay NULL.
      const dto = meterServiceSpy.addMeter.mock.calls[0][0] as CreateMeterDTO;
      const sent = JSON.parse(JSON.stringify(dto.initial_data)) as Record<string, unknown>;
      expect(sent).not.toHaveProperty('injection_status');
      expect(sent).not.toHaveProperty('production_chain');
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

    it("shows the server's message when the meter cannot be created", () => {
      // HttpClient fails with an HttpErrorResponse; the backend's message is in its body.
      const message = 'A meter with this EAN already exists';
      meterServiceSpy.addMeter.mockReturnValue(
        throwError(
          () => new HttpErrorResponse({ status: 409, error: { data: message, error_code: 2003 } }),
        ),
      );
      fillFormCompletely(component);
      component.onSubmit();
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(message);
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

  describe('address picker', () => {
    it('fills the five controls from a picked suggestion', () => {
      pickAddress(component, 'onAddressPicked', {
        street: 'Place de la Station',
        number: '20A',
        postcode: '5000',
        city: 'Namur',
      });

      const value = component.metersForm.getRawValue() as Record<string, unknown>;
      expect(value['address_street']).toBe('Place de la Station');
      expect(value['address_number']).toBe('20A');
      expect(value['address_postcode']).toBe('5000');
      expect(value['address_city']).toBe('Namur');
    });

    it('carries the picked coordinate into the DTO', () => {
      fillFormCompletely(component);
      pickAddress(component, 'onAddressPicked', {
        street: 'Rue de la Loi',
        number: '16',
        postcode: '1000',
        city: 'Brussels',
      });

      component.onSubmit();

      const dto = meterServiceSpy.addMeter.mock.calls[0][0] as CreateMeterDTO;
      expect(dto.address).toMatchObject({
        latitude: 50.846169,
        longitude: 4.366538,
        best_address_id: 'best:42',
      });
    });

    it('DROPS it once the address is edited afterwards', () => {
      fillFormCompletely(component);
      pickAddress(component, 'onAddressPicked', {
        street: 'Rue de la Loi',
        number: '16',
        postcode: '1000',
        city: 'Brussels',
      });
      component.metersForm.get('address_number')?.setValue('18');

      component.onSubmit();

      const dto = meterServiceSpy.addMeter.mock.calls[0][0] as CreateMeterDTO;
      expect(dto.address).not.toHaveProperty('latitude');
    });
  });

  // ── 8b. GRD lookup ──────────────────────────────────────────────────

  describe('GRD lookup', () => {
    /** Validate step 1 as "next" does; the callback opens step 2. */
    function next(): ReturnType<typeof vi.fn> {
      const activate = vi.fn();
      component.validateStep1(activate);
      return activate;
    }

    function lastQuery(): DsoResolveQuery {
      return dsoServiceSpy.resolve.mock.calls.at(-1)?.[0] as DsoResolveQuery;
    }

    function grd(): unknown {
      return component.metersForm.get('grd')?.value;
    }

    function submitted(): Record<string, unknown> {
      return (meterServiceSpy.addMeter.mock.calls.at(-1)?.[0] as CreateMeterDTO)
        .initial_data as unknown as Record<string, unknown>;
    }

    describe('the operator catalogue', () => {
      function withCatalogue(response: unknown): MeterCreation {
        dsoServiceSpy.getOperators.mockReturnValue(response);
        const created = TestBed.createComponent(MeterCreation).componentInstance;
        created.ngOnInit();
        return created;
      }

      it('replaces the static list, sorted back to ORES first, Elia last', () => {
        // A catalogue may list AIEG first (dso-lookup pins only kind and region
        // order); the e2e scenarios pick the first option, which must stay ORES.
        const created = withCatalogue(
          of(
            new ApiResponse([
              dsoOperator('aieg', 'AIEG'),
              dsoOperator('ores', 'ORES'),
              dsoOperator('fluvius-new', 'Fluvius New', { region: 'VLA' }),
              dsoOperator('sibelga', 'Sibelga', { region: 'BRU' }),
              dsoOperator('enexis', 'Enexis', { kind: 'gas_foreign', elec: false }),
              dsoOperator('elia', 'Elia', { kind: 'grtl', lookup: false }),
            ]),
          ),
        );

        expect(created.grdAvailable().map((option) => option.id)).toEqual([
          'ores',
          'aieg',
          'sibelga',
          'fluvius-new',
          'elia',
        ]);
      });

      it('keeps the static list when the catalogue is empty or fails', () => {
        const empty = withCatalogue(of(new ApiResponse<DsoOperatorDTO[]>([])));
        const failed = withCatalogue(throwError(() => new Error('404')));

        for (const created of [empty, failed]) {
          expect(created.grdAvailable()).toHaveLength(15);
          expect(created.grdAvailable()[0].id).toBe('ores');
        }
      });
    });

    describe('the query', () => {
      it('asks once step 1 is valid, AFTER opening step 2, with the typed address and EAN', () => {
        fillStep1(component);

        const activate = next();

        expect(activate).toHaveBeenCalledWith(1);
        expect(dsoServiceSpy.resolve).toHaveBeenCalledTimes(1);
        expect(activate.mock.invocationCallOrder[0]).toBeLessThan(
          dsoServiceSpy.resolve.mock.invocationCallOrder[0],
        );
        expect(lastQuery()).toEqual({
          postcode: '4000',
          city: 'Liège',
          ean: '541448200000000001',
        });
      });

      it('does not ask while step 1 is invalid', () => {
        next();

        expect(dsoServiceSpy.resolve).not.toHaveBeenCalled();
      });

      it("adds the pick's commune code and locality while the address still matches it", () => {
        fillStep1(component);
        const fields = { street: 'Rue Léopold', number: '1', postcode: '4000', city: 'Liège' };
        pickAddress(component, 'onAddressPicked', fields, {
          nis_code: 62063,
          post_name: 'Liège',
        });

        next();

        expect(lastQuery()).toEqual({
          nis_code: 62063,
          post_name: 'Liège',
          postcode: '4000',
          city: 'Liège',
          ean: '541448200000000001',
        });
      });

      it('drops them once the address was edited away from the pick', () => {
        fillStep1(component);
        const fields = { street: 'Rue Léopold', number: '1', postcode: '4000', city: 'Liège' };
        pickAddress(component, 'onAddressPicked', fields, { nis_code: 62063, post_name: 'Liège' });
        component.metersForm.patchValue({ address_postcode: '4020' });

        next();

        expect(lastQuery()).not.toHaveProperty('nis_code');
        expect(lastQuery()).not.toHaveProperty('post_name');
        expect(lastQuery()).toMatchObject({ postcode: '4020' });
      });

      it('does not ask again for the same address (back, then next)', () => {
        dsoServiceSpy.resolve.mockReturnValue(answer(dsoResolution({ result: dsoResult('ores') })));
        fillStep1(component);
        next();
        next();

        expect(dsoServiceSpy.resolve).toHaveBeenCalledTimes(1);
      });

      it('asks again for the same address when the lookup was unavailable', () => {
        fillStep1(component);
        next();
        next();

        expect(dsoServiceSpy.resolve).toHaveBeenCalledTimes(2);
      });

      it('asks again once the address changed, and drops the late answer to the first', () => {
        const first = new Subject<ApiResponse<DsoResolutionDTO | string>>();
        const second = new Subject<ApiResponse<DsoResolutionDTO | string>>();
        dsoServiceSpy.resolve.mockReturnValueOnce(first).mockReturnValueOnce(second);
        fillStep1(component);
        next();
        component.metersForm.patchValue({ address_postcode: '4020' });
        next();

        first.next(new ApiResponse(dsoResolution({ result: dsoResult('ores') })));
        expect(grd()).toBe('');
        second.next(new ApiResponse(dsoResolution({ result: dsoResult('resa') })));

        expect(grd()).toBe('resa');
        expect(dsoServiceSpy.resolve).toHaveBeenCalledTimes(2);
      });
    });

    describe('an "ok" answer', () => {
      it('prefills the operator and submits it as auto, with the data version', () => {
        dsoServiceSpy.resolve.mockReturnValue(
          answer(dsoResolution({ result: dsoResult('resa'), data_version: '2026.10.0' })),
        );
        fillStep1(component);
        next();

        expect(grd()).toBe('resa');
        expect(component.grdSource()).toBe('auto');
        expect(component.grdPrefilledName()).toBe('RESA');
        expect(component.grdDataVersionShown()).toBe('2026.10.0');

        fillStep2(component);
        component.onSubmit();

        expect(submitted()).toMatchObject({
          grd: 'resa',
          grd_source: 'auto',
          grd_data_version: '2026.10.0',
        });
      });

      it("prefills the network's OPERATOR, never the designated GRD", () => {
        // Namur's four sections run by AIEG while ORES is the designated GRD.
        dsoServiceSpy.resolve.mockReturnValue(
          answer(
            dsoResolution({
              result: dsoResult('aieg', {
                elec: { operator: 'aieg', designated: 'ores' },
                gas: { status: 'designated', operator: 'ores' },
                flags: ['operator_differs'],
              }),
            }),
          ),
        );
        fillStep1(component);
        next();

        expect(grd()).toBe('aieg');
      });

      it('keeps a draft data version as is', () => {
        dsoServiceSpy.resolve.mockReturnValue(
          answer(
            dsoResolution({
              result: dsoResult('ores', { data_version: '2026.10.0-draft' }),
              data_version: '2026.10.0-draft',
            }),
          ),
        );
        fillStep1(component);
        next();
        fillStep2(component);
        component.onSubmit();

        expect(submitted()).toMatchObject({ grd_data_version: '2026.10.0-draft' });
      });

      it('never overwrites a GRD the user picked', () => {
        dsoServiceSpy.resolve.mockReturnValue(answer(dsoResolution({ result: dsoResult('ores') })));
        fillStep1(component);
        component.metersForm.patchValue({ grd: 'resa' });
        component.onGrdChange();

        next();

        expect(grd()).toBe('resa');
        expect(component.grdSource()).toBe('manual');
        expect(component.grdPrefilledName()).toBeNull();
      });

      it('never overwrites a GRD picked while the answer was on its way', () => {
        const pending = new Subject<ApiResponse<DsoResolutionDTO | string>>();
        dsoServiceSpy.resolve.mockReturnValue(pending);
        fillStep1(component);
        next();
        component.metersForm.patchValue({ grd: 'aiesh' });
        component.onGrdChange();

        pending.next(new ApiResponse(dsoResolution({ result: dsoResult('ores') })));

        expect(grd()).toBe('aiesh');
        expect(component.grdSource()).toBe('manual');
      });

      it('turns a prefilled value into a manual one when the user changes it', () => {
        dsoServiceSpy.resolve.mockReturnValue(
          answer(dsoResolution({ result: dsoResult('ores'), data_version: '2026.10.0' })),
        );
        fillStep1(component);
        next();
        component.metersForm.patchValue({ grd: 'rew' });
        component.onGrdChange();
        fillStep2(component);

        component.onSubmit();

        expect(submitted()).toMatchObject({ grd: 'rew', grd_source: 'manual' });
        expect(submitted()).not.toHaveProperty('grd_data_version');
      });

      it('never prefills Elia, nor an operator the select does not offer', () => {
        for (const operator of ['elia', 'unknown-operator']) {
          dsoServiceSpy.resolve.mockReturnValue(
            answer(dsoResolution({ result: dsoResult(operator) })),
          );
          const created = TestBed.createComponent(MeterCreation).componentInstance;
          created.ngOnInit();
          fillStep1(created);
          created.validateStep1(vi.fn());

          expect(created.metersForm.get('grd')?.value, operator).toBe('');
          expect(created.grdSource(), operator).toBeNull();
        }
      });
    });

    describe('a "choose_section" answer', () => {
      const flawinne = dsoSection('92094|flawinne', 'Flawinne', 'aieg', ['5020']);
      const namur = dsoSection('92094|namur', 'Namur', 'ores', ['5000', '5020']);
      const namurCommune = {
        ins: '92094',
        names: placeNames('Namur', 'Namen', 'Namür'),
        region: 'WAL' as const,
        province: 'BE-WNA',
      };

      it('prefills when every section has the same operator (Baarle-Hertog)', () => {
        dsoServiceSpy.resolve.mockReturnValue(
          answer(
            dsoResolution({
              status: 'choose_section',
              sections: [
                dsoSection('13002|baarle-hertog', 'Baarle-Hertog', 'fluvius-antwerpen', ['2387']),
                dsoSection('13002|zondereigen', 'Zondereigen', 'fluvius-antwerpen', ['2387']),
              ],
            }),
          ),
        );
        fillStep1(component);
        next();

        expect(grd()).toBe('fluvius-antwerpen');
        expect(component.grdSource()).toBe('auto');
        expect(component.grdChoices().sections).toBeNull();
      });

      it('offers the sections as radios when their operators differ, and prefills nothing', () => {
        dsoServiceSpy.resolve.mockReturnValue(
          answer(
            dsoResolution({
              status: 'choose_section',
              communes: [namurCommune],
              sections: [flawinne, namur],
            }),
          ),
        );
        fillStep1(component);
        next();

        expect(grd()).toBe('');
        expect(component.grdSource()).toBeNull();
        expect(component.grdChoices().sections).toEqual({
          selected: null,
          options: [
            { value: '92094|flawinne', label: 'Flawinne' },
            { value: '92094|namur', label: 'Namur' },
          ],
        });
      });

      it('asks again for the chosen section, by commune and section, and prefills it', () => {
        dsoServiceSpy.resolve.mockReturnValueOnce(
          answer(
            dsoResolution({
              status: 'choose_section',
              communes: [namurCommune],
              sections: [flawinne, namur],
            }),
          ),
        );
        fillStep1(component);
        const fields = { street: 'Rue Léopold', number: '1', postcode: '4000', city: 'Liège' };
        pickAddress(component, 'onAddressPicked', fields, { nis_code: 92094 });
        next();
        dsoServiceSpy.resolve.mockReturnValueOnce(
          answer(dsoResolution({ result: dsoResult('aieg', { ins: '92094', section: flawinne }) })),
        );

        component.chooseGrdSection('92094|flawinne');

        // Without the register hints, which would route the backend to the address
        // lookup and ignore ins/section; with a postcode the section covers.
        expect(lastQuery()).toEqual({
          ins: '92094',
          section: '92094|flawinne',
          postcode: '5020',
          city: 'Liège',
          ean: '541448200000000001',
        });
        expect(grd()).toBe('aieg');
        expect(component.grdSource()).toBe('auto');
        expect(component.grdChoices().sections?.selected).toBe('92094|flawinne');
      });
    });

    describe('a "choose_commune" answer', () => {
      it('offers the communes as radios, then asks again for the chosen one', () => {
        dsoServiceSpy.resolve.mockReturnValueOnce(
          answer(
            dsoResolution({
              status: 'choose_commune',
              communes: [
                { ins: '23104', names: placeNames('Lennik'), region: 'VLA', province: 'BE-VBR' },
                {
                  ins: '23106',
                  names: placeNames('Pajottegem'),
                  region: 'VLA',
                  province: 'BE-VBR',
                },
              ],
            }),
          ),
        );
        fillStep1(component);
        next();

        expect(grd()).toBe('');
        expect(component.grdChoices().communes?.options).toEqual([
          { value: '23104', label: 'Lennik' },
          { value: '23106', label: 'Pajottegem' },
        ]);

        dsoServiceSpy.resolve.mockReturnValueOnce(
          answer(dsoResolution({ result: dsoResult('fluvius-halle-vilvoorde') })),
        );
        component.chooseGrdCommune('23106');

        expect(lastQuery()).toMatchObject({ ins: '23106', postcode: '4000' });
        expect(grd()).toBe('fluvius-halle-vilvoorde');
        expect(component.grdChoices().communes?.selected).toBe('23106');
      });
    });

    describe('no answer', () => {
      it.each([
        ['unavailable', answer({ available: false, status: 'unavailable', warnings: [] })],
        ['not_found', answer(dsoResolution({ status: 'not_found' }))],
        ['an HTTP error', throwError(() => new HttpErrorResponse({ status: 404 }))],
      ])('changes nothing on %s', (_label, response) => {
        dsoServiceSpy.resolve.mockReturnValue(response);
        fillStep1(component);
        component.metersForm.patchValue({ grd: 'ores' });

        next();

        expect(grd()).toBe('ores');
        expect(component.grdSource()).toBeNull();
        expect(component.grdLookupLoading()).toBe(false);
      });

      it('says why it left the select alone', () => {
        fillStep1(component);
        next();

        expect(component.grdLookupStatus()).toBe('unavailable');
        expect(component.grdDataVersionShown()).toBeNull();
      });

      it('submits a GRD chosen without any lookup as manual, without a data version', () => {
        fillFormCompletely(component);

        component.onSubmit();

        expect(submitted()).toMatchObject({ grd: 'resa', grd_source: 'manual' });
        expect(submitted()).not.toHaveProperty('grd_data_version');
      });
    });

    describe('what comes with the answer', () => {
      it("shows the data's note in the reader's language, else in French", () => {
        const note = { key: 'wal-namur', fr: 'Note FR', nl: 'Notitie NL', de: '', en: 'Note EN' };
        dsoServiceSpy.resolve.mockReturnValue(
          answer(dsoResolution({ result: dsoResult('ores', { note }) })),
        );
        fillStep1(component);
        next();
        const translate = TestBed.inject(TranslateService);

        translate.use('nl');
        expect(component.grdNote()).toBe('Notitie NL');
        translate.use('de');
        expect(component.grdNote()).toBe('Note FR');
      });

      it('flags data still to confirm', () => {
        dsoServiceSpy.resolve.mockReturnValue(
          answer(
            dsoResolution({ result: dsoResult('ores', { flags: ['transition', 'to_confirm'] }) }),
          ),
        );
        fillStep1(component);
        next();

        expect(component.grdToConfirm()).toBe(true);
      });

      it('translates the warnings, with the regulators by name', () => {
        const translate = TestBed.inject(TranslateService);
        translate.setTranslation('fr', {
          METER: {
            GRD_WARNING: {
              REGION_OUTSIDE_COMMUNITY_REGULATOR: '{{address_regulator}} / {{community_regulator}}',
              EAN_SIBELGA_OUTSIDE_BRUSSELS: 'Sibelga hors de Bruxelles ({{region}})',
            },
          },
          REGULATORS: { 'BE-WAL-CWAPE': 'CWaPE (Wallonie)' },
        });
        translate.use('fr');
        dsoServiceSpy.resolve.mockReturnValue(
          answer(
            dsoResolution({
              result: dsoResult('resa'),
              warnings: [
                {
                  code: 'REGION_OUTSIDE_COMMUNITY_REGULATOR',
                  params: { address_regulator: 'BE-WAL-CWAPE', community_regulator: 'BE-XX-NEW' },
                },
                { code: 'EAN_SIBELGA_OUTSIDE_BRUSSELS', params: { region: 'WAL' } },
                // A code from a newer backend that this build cannot word.
                {
                  code: 'SOMETHING_NEW' as 'EAN_SIBELGA_OUTSIDE_BRUSSELS',
                  params: {},
                },
              ],
            }),
          ),
        );
        fillStep1(component);
        next();

        // An unknown regulator code is shown as is rather than as a missing key, and
        // a warning without a text is left out.
        expect(component.grdWarnings()).toEqual([
          'CWaPE (Wallonie) / BE-XX-NEW',
          'Sibelga hors de Bruxelles (WAL)',
        ]);
        // Warnings never block, nor change the prefill.
        expect(grd()).toBe('resa');
      });
    });
  });

  // ── 9. Address details disclosure ───────────────────────────────────

  describe('address details disclosure', () => {
    it('starts collapsed, because a new meter has no address yet', () => {
      expect(detailsOpen(component)).toBe(false);
    });

    it('opens on a picked suggestion, so the filled fields are actually seen', () => {
      // A pick that silently populated hidden inputs is indistinguishable from
      // a pick that did nothing.
      pickAddress(component, 'onAddressPicked', {
        street: 'Place de la Station',
        number: '20A',
        postcode: '5000',
        city: 'Namur',
      });

      expect(detailsOpen(component)).toBe(true);
    });

    it('opens on request, WITHOUT a pick', () => {
      // The escape hatch is load-bearing: the picker is suggest-only and must
      // never gate a save, so an address the register does not know still has
      // to be encodable. If a pick were the only way in, collapsing by default
      // would quietly turn "suggest, never block" into a hard block.
      openDetails(component);

      expect(detailsOpen(component)).toBe(true);
    });

    it('opens when step 1 fails on an address control', () => {
      // The trap this exists to prevent: four of the five inputs are
      // `Validators.required` and live inside the collapsed block, so marking
      // them touched while hidden paints the step as invalid with nothing on
      // screen to fix.
      component.validateStep1(vi.fn());

      expect(detailsOpen(component)).toBe(true);
    });

    it('stays collapsed when step 1 fails on something that is NOT the address', () => {
      // Guards the opposite mistake — opening on any failure at all, which
      // would make the collapse pointless the moment a user forgot the EAN.
      component.metersForm.patchValue({
        address_street: 'Rue Test',
        address_number: '1',
        address_postcode: '1000',
        address_city: 'Brussels',
      });

      component.validateStep1(vi.fn());

      expect(detailsOpen(component)).toBe(false);
    });
  });
});

// ── The rendered wizard (real template) ─────────────────────────────

describe('MeterCreation rendered', () => {
  // The suite above replaces the template with '', so it cannot see whether
  // pressing "next" shows anything. Step 1 used to be a <div [formGroup]> whose
  // error handlers each carried their own [formGroup]: nothing ever submitted
  // them, so a missing postcode blocked the step with no message at all.
  let component: MeterCreation;
  let fixture: ComponentFixture<MeterCreation>;
  let resolveSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    resolveSpy = vi
      .fn()
      .mockReturnValue(answer({ available: false, status: 'unavailable', warnings: [] }));
    await TestBed.configureTestingModule({
      imports: [MeterCreation, TranslateModule.forRoot()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: DsoService,
          useValue: {
            getOperators: vi.fn().mockReturnValue(of(new ApiResponse<DsoOperatorDTO[]>([]))),
            resolve: resolveSpy,
          },
        },
        { provide: DynamicDialogRef, useValue: { close: vi.fn() } },
        { provide: DynamicDialogConfig, useValue: { data: {} } },
        {
          provide: MemberService,
          useValue: { getMembersList: vi.fn().mockReturnValue(of(membersResponse())) },
        },
        { provide: MeterService, useValue: { addMeter: vi.fn() } },
        { provide: ErrorMessageHandler, useValue: { handleError: vi.fn() } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(MeterCreation);
    component = fixture.componentInstance;
    await settle();
  });

  function byTestId(testId: string): HTMLElement {
    const el = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      `[data-testid="${testId}"]`,
    );
    if (!el) {
      throw new Error(`[data-testid="${testId}"] is not rendered`);
    }
    return el;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  // A p-button reacts to clicks on the <button> it renders.
  async function pressNext(): Promise<void> {
    byTestId('meter-creation__btn--next-step').querySelector('button')?.click();
    await settle();
  }

  // The message under a field: its error handler sits beside the input.
  function fieldError(testId: string): string {
    const message = byTestId(testId).parentElement?.querySelector(
      '[data-testid="error-handler__message--error"]',
    );
    return message?.textContent?.trim() ?? '';
  }

  function onStep2(): boolean {
    return byTestId('meter-creation__step--configuration').getAttribute('data-p-active') === 'true';
  }

  // No translations are loaded, so a message reads as its key.
  const REQUIRED = 'FORM_ERROR.REQUIRED_FIELD';
  const STREET = 'meter-creation__input--street';
  const NUMBER = 'meter-creation__input--address-number';
  const POSTCODE = 'meter-creation__input--postcode';
  const CITY = 'meter-creation__input--city';

  function fillIdentity(): void {
    component.metersForm.patchValue({
      EAN: '541448200000000001',
      meterNumber: 'MTR-001',
      tarifGroup: { id: 1, name: 'Low Voltage' },
      phasesNumber: { id: 1, name: 'Single Phase' },
      readingFrequency: { id: 1, name: 'Monthly' },
    });
  }

  it('shows "required" under the postcode a picked address left empty', async () => {
    fillIdentity();
    pickAddress(component, 'onAddressPicked', {
      street: 'Rue de la Loi',
      number: '16',
      postcode: '',
      city: 'Brussels',
    });
    await settle();

    await pressNext();

    expect(fieldError(POSTCODE)).toBe(REQUIRED);
    expect(fieldError(STREET)).toBe('');
    expect(fieldError(NUMBER)).toBe('');
    expect(fieldError(CITY)).toBe('');
    expect(onStep2()).toBe(false);
  });

  it('opens the collapsed address block WITH its messages', async () => {
    // The block opens during the submit; handlers created only then would
    // have missed it and left the four fields blank.
    fillIdentity();
    expect(detailsOpen(component)).toBe(false);

    await pressNext();

    expect(detailsOpen(component)).toBe(true);
    expect(byTestId(POSTCODE).closest('[hidden]')).toBeNull();
    for (const field of [STREET, NUMBER, POSTCODE, CITY]) {
      expect(fieldError(field)).toBe(REQUIRED);
    }
    expect(onStep2()).toBe(false);
  });

  it('shows the messages of the other step-1 fields too', async () => {
    await pressNext();

    expect(fieldError('meter-creation__input--ean')).toBe(REQUIRED);
    expect(fieldError('meter-creation__input--meter-number')).toBe(REQUIRED);
  });

  it('moves on to step 2 when step 1 is complete, without a message', async () => {
    fillIdentity();
    pickAddress(component, 'onAddressPicked', {
      street: 'Rue de la Loi',
      number: '16',
      postcode: '1000',
      city: 'Brussels',
    });
    await settle();

    await pressNext();

    expect(onStep2()).toBe(true);
    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        '[data-testid="error-handler__message--error"]',
      ).length,
    ).toBe(0);
  });

  // ── Card radios ──
  // The five card groups (three on step 1, two on step 2) all bind to controls
  // of the one metersForm. PrimeNG treats radios with the same form root AND the
  // same `name` as one group, and writes a pick into every other radio of it.
  // Without a name per field the five were one group: choosing a reading
  // frequency emptied the phase's dot, while its card stayed highlighted (the
  // highlight reads the form value).

  // Choose a card the way a user does: its label clicks the radio.
  async function chooseCard(inputId: string): Promise<void> {
    const label = (fixture.nativeElement as HTMLElement).querySelector<HTMLLabelElement>(
      `label[for="${inputId}"]`,
    );
    if (!label) {
      throw new Error(`label[for="${inputId}"] is not rendered`);
    }
    label.click();
    await settle();
  }

  // The dot is drawn from the radio's own state (a class on its host); the
  // native input carries the same state for assistive technology.
  function radio(inputId: string): { input: boolean; dot: boolean } {
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      `input#${inputId}`,
    );
    if (!input) {
      throw new Error(`input#${inputId} is not rendered`);
    }
    return {
      input: input.checked,
      dot: !!input.closest('p-radiobutton')?.classList.contains('p-radiobutton-checked'),
    };
  }

  const CHECKED = { input: true, dot: true };

  it('keeps the dot of a card group when a card is chosen in another one', async () => {
    const phase = `phase${PhaseCategory.THREE}`;
    const readingFreq = `readingFreq${ReadingFrequency.YEARLY}`;

    await chooseCard(phase);
    await chooseCard(readingFreq);

    expect(component.metersForm.get('phasesNumber')?.value).toMatchObject({
      id: PhaseCategory.THREE,
    });
    expect(component.metersForm.get('readingFrequency')?.value).toMatchObject({
      id: ReadingFrequency.YEARLY,
    });
    expect(radio(phase)).toEqual(CHECKED);
    expect(radio(readingFreq)).toEqual(CHECKED);
  });

  it('keeps every dot across both steps, back on step 1 too', async () => {
    // Step 2 is a second <form>, but on the same metersForm root. The panel
    // that is not shown is only detached, so its radios still hear every pick.
    const step1 = [
      `phase${PhaseCategory.SINGLE}`,
      `readingFreq${ReadingFrequency.MONTHLY}`,
      `tarifGroup${TarifGroup.HIGH_TENSION}`,
    ];
    for (const inputId of step1) {
      await chooseCard(inputId);
    }
    component.metersForm.patchValue({ EAN: '541448200000000001', meterNumber: 'MTR-001' });
    pickAddress(component, 'onAddressPicked', {
      street: 'Rue de la Loi',
      number: '16',
      postcode: '1000',
      city: 'Brussels',
    });
    await settle();
    await pressNext();
    expect(onStep2()).toBe(true);

    const step2 = [`rate${MeterRate.EXCLUSIVE_NIGHT}`, `client${ClientType.PROFESSIONAL}`];
    for (const inputId of step2) {
      await chooseCard(inputId);
    }
    for (const inputId of step2) {
      expect(radio(inputId), inputId).toEqual(CHECKED);
    }

    byTestId('meter-creation__btn--back').querySelector('button')?.click();
    await settle();
    expect(onStep2()).toBe(false);
    for (const inputId of step1) {
      expect(radio(inputId), inputId).toEqual(CHECKED);
    }
  });

  // ── GRD lookup ──

  async function moveToStep2(): Promise<void> {
    fillIdentity();
    pickAddress(component, 'onAddressPicked', {
      street: 'Rue de Fernelmont',
      number: '2',
      postcode: '5020',
      city: 'Namur',
    });
    await settle();
    await pressNext();
  }

  function rendered(testId: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      `[data-testid="${testId}"]`,
    );
  }

  it('shows the prefilled operator in the select, with the attribution', async () => {
    resolveSpy.mockReturnValue(
      answer(dsoResolution({ result: dsoResult('ores'), data_version: '2026.10.0' })),
    );

    await moveToStep2();

    expect(onStep2()).toBe(true);
    expect(component.metersForm.get('grd')?.value).toBe('ores');
    expect(byTestId('meter-creation__select--grd').textContent).toContain('ORES');
    expect(byTestId('meter-creation__grd-lookup--prefilled').textContent).toContain(
      'METER.GRD_LOOKUP.PREFILLED',
    );
    expect(byTestId('meter-creation__grd-lookup--attribution')).toBeTruthy();
  });

  it('lets the user choose the locality with a radio, then prefills its operator', async () => {
    resolveSpy.mockReturnValueOnce(
      answer(
        dsoResolution({
          status: 'choose_section',
          communes: [
            { ins: '92094', names: placeNames('Namur'), region: 'WAL', province: 'BE-WNA' },
          ],
          sections: [
            dsoSection('92094|flawinne', 'Flawinne', 'aieg', ['5020']),
            dsoSection('92094|namur', 'Namur', 'ores', ['5000', '5020']),
          ],
        }),
      ),
    );
    await moveToStep2();
    expect(component.metersForm.get('grd')?.value).toBe('');
    const sections = byTestId('meter-creation__grd-lookup--sections');
    expect(sections.textContent).toContain('Flawinne');
    expect(sections.textContent).toContain('Namur');

    resolveSpy.mockReturnValueOnce(answer(dsoResolution({ result: dsoResult('aieg') })));
    sections.querySelector<HTMLLabelElement>('label[for="grdSection0"]')?.click();
    await settle();

    expect(resolveSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ ins: '92094', section: '92094|flawinne', postcode: '5020' }),
    );
    expect(component.metersForm.get('grd')?.value).toBe('aieg');
    expect(
      (sections.querySelector<HTMLInputElement>('input#grdSection0') as HTMLInputElement).checked,
    ).toBe(true);
    // The card radios of the form keep their own state.
    expect(rendered('meter-creation__grd-lookup--prefilled')).toBeTruthy();
  });

  it('shows nothing but a quiet line when the lookup is unavailable', async () => {
    await moveToStep2();

    expect(onStep2()).toBe(true);
    expect(rendered('meter-creation__grd-lookup--unavailable')).toBeTruthy();
    expect(rendered('meter-creation__grd-lookup--prefilled')).toBeNull();
    expect(rendered('meter-creation__grd-lookup--sections')).toBeNull();
    expect(component.metersForm.get('grd')?.value).toBe('');
  });
});
