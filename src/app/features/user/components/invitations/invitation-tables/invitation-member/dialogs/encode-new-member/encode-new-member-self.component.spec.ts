import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { NEVER, of, throwError } from 'rxjs';
import { CheckboxChangeEvent } from 'primeng/checkbox';

import { EncodeNewMemberSelfComponent } from './encode-new-member-self.component';
import { MeService } from '../../../../../../../../shared/services/me.service';
import { UserService } from '../../../../../../../../shared/services/user.service';
import { UserDTO } from '../../../../../../../../shared/dtos/user.dtos';
import { ErrorMessageHandler } from '../../../../../../../../shared/services-ui/error.message.handler';
import { MemberType } from '../../../../../../../../shared/types/member.types';
import { AcceptInvitationWEncodedDTO } from '../../../../../../../../shared/dtos/invitation.dtos';
import { ApiResponse } from '../../../../../../../../core/dtos/api.response';
import {
  AddressGeoPrecision,
  AddressSuggestionDTO,
} from '../../../../../../../../shared/dtos/geocoding.dtos';
import { AddressPicked } from '../../../../../../../../shared/components/address-autocomplete/address-autocomplete';
import { addressFingerprint } from '../../../../../../../../shared/components/address-autocomplete/address-field-source';

function profile(overrides: Partial<UserDTO> = {}): UserDTO {
  return {
    id: 7,
    email: 'alice@example.be',
    first_name: 'Alice',
    last_name: 'Dupont',
    nrn: '85073003328',
    phone_number: '+32470112233',
    iban: 'BE68539007547034',
    home_address: {
      id: 1,
      street: 'Rue de la Loi',
      number: '16',
      postcode: '1000',
      supplement: 'Bte 3',
      city: 'Bruxelles',
    },
    billing_address: {
      id: 2,
      street: 'Avenue Louise',
      number: '200',
      postcode: '1050',
      supplement: '',
      city: 'Bruxelles',
    },
    ...overrides,
  };
}

/** What `getProfile()` provisions on first login: an email and nothing else. */
function blankProfile(): Partial<UserDTO> {
  return {
    first_name: null,
    last_name: null,
    nrn: null,
    phone_number: null,
    iban: null,
    home_address: undefined,
    billing_address: undefined,
  };
}

function profileResponse(overrides: Partial<UserDTO> = {}): ApiResponse<UserDTO | string> {
  return { data: profile(overrides), error_code: 0 };
}

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
  };
  const full = { ...fields, supplement: '' };
  (component as Record<string, (e: AddressPicked) => void>)[handler]({
    suggestion,
    fields: full,
    fingerprint: addressFingerprint(full),
  });
}

describe('EncodeNewMemberSelfComponent', () => {
  let component: EncodeNewMemberSelfComponent;
  let fixture: ComponentFixture<EncodeNewMemberSelfComponent>;
  let meServiceSpy: { acceptInvitationMemberEncoded: ReturnType<typeof vi.fn> };
  let userServiceSpy: { getUserInfo: ReturnType<typeof vi.fn> };
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };
  let dialogConfigSpy: { data: { invitationID?: number } | null };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };

  function setupTestBed(
    configData: { invitationID?: number } | null = { invitationID: 123 },
  ): void {
    meServiceSpy = { acceptInvitationMemberEncoded: vi.fn() };
    // UserService extends ServiceBase, which injects HttpClient and
    // CacheService - neither is provided here, so it must always be mocked.
    userServiceSpy = { getUserInfo: vi.fn().mockReturnValue(of(profileResponse())) };
    routerSpy = { navigate: vi.fn() };
    dialogRefSpy = { close: vi.fn() };
    dialogConfigSpy = { data: configData };
    errorHandlerSpy = { handleError: vi.fn() };
  }

  async function createComponent(
    configData: { invitationID?: number } | null = { invitationID: 123 },
    options: { skipDetectChanges?: boolean } = {},
  ): Promise<void> {
    setupTestBed(configData);

    await TestBed.configureTestingModule({
      imports: [EncodeNewMemberSelfComponent, TranslateModule.forRoot()],
      providers: [
        { provide: MeService, useValue: meServiceSpy },
        { provide: UserService, useValue: userServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: DynamicDialogRef, useValue: dialogRefSpy },
        { provide: DynamicDialogConfig, useValue: dialogConfigSpy },
        { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(EncodeNewMemberSelfComponent, {
        set: {
          providers: [{ provide: ErrorMessageHandler, useValue: errorHandlerSpy }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(EncodeNewMemberSelfComponent);
    component = fixture.componentInstance;
    if (!options.skipDetectChanges) {
      fixture.detectChanges();
    }
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('Component creation and initialization', () => {
    it('should create the component', async () => {
      await createComponent();
      expect(component).toBeTruthy();
    });

    it('should set invitationID from config data', async () => {
      await createComponent({ invitationID: 456 });
      expect(component.invitationID).toBe(456);
    });

    it('should initialize addressForm with required controls', async () => {
      await createComponent();
      expect(component.addressForm).toBeDefined();
      expect(component.addressForm.contains('home_address_street')).toBe(true);
      expect(component.addressForm.contains('home_address_number')).toBe(true);
      expect(component.addressForm.contains('home_address_postcode')).toBe(true);
      expect(component.addressForm.contains('home_address_supplement')).toBe(true);
      expect(component.addressForm.contains('home_address_city')).toBe(true);
      expect(component.addressForm.contains('billing_address_street')).toBe(true);
      expect(component.addressForm.contains('billing_address_city')).toBe(true);
    });

    // Same defect as member-creation-update.toggleSameAddress, copied here.
    it('should re-add billing address controls with their required validators', () => {
      component.addressForm.patchValue({ same_address: true });
      component.toggleSameAddress({} as CheckboxChangeEvent);
      component.addressForm.patchValue({ same_address: false });
      component.toggleSameAddress({} as CheckboxChangeEvent);

      for (const name of [
        'billing_address_street',
        'billing_address_number',
        'billing_address_postcode',
        'billing_address_city',
      ]) {
        expect(component.addressForm.get(name)?.hasValidator(Validators.required)).toBe(true);
      }
      expect(
        component.addressForm.get('billing_address_supplement')?.hasValidator(Validators.required),
      ).toBe(false);
    });

    it('should initialize ibanForm with iban control', async () => {
      await createComponent();
      expect(component.ibanForm).toBeDefined();
      expect(component.ibanForm.contains('iban')).toBe(true);
    });

    it('should initialize formData as empty FormGroup', async () => {
      await createComponent();
      expect(component.formData).toBeDefined();
      expect(Object.keys(component.formData.controls).length).toBe(0);
    });

    it('should close dialog when config data is null', async () => {
      await createComponent(null, { skipDetectChanges: true });
      component.ngOnInit();
      expect(dialogRefSpy.close).toHaveBeenCalledWith(false);
    });

    it('should close dialog when invitationID is missing', async () => {
      await createComponent({}, { skipDetectChanges: true });
      component.ngOnInit();
      expect(dialogRefSpy.close).toHaveBeenCalledWith(false);
    });

    it('should default typeClient signal to -1', async () => {
      await createComponent();
      expect(component.typeClient()).toBe(-1);
    });

    it('should default gestionnaire signal to false', async () => {
      await createComponent();
      expect(component.gestionnaire()).toBe(false);
    });
  });

  describe('onTypeClientChange', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should set typeClient signal to the given type', () => {
      component.onTypeClientChange(MemberType.INDIVIDUAL);
      expect(component.typeClient()).toBe(MemberType.INDIVIDUAL);
    });

    it('should build form group when type is not -1', () => {
      const spy = vi.spyOn(component, 'buildFormGroup');
      component.onTypeClientChange(MemberType.INDIVIDUAL);
      expect(spy).toHaveBeenCalled();
    });

    it('should not build form group when type is -1', () => {
      const spy = vi.spyOn(component, 'buildFormGroup');
      component.onTypeClientChange(-1);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('buildFormGroup', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should create INDIVIDUAL form with correct controls', () => {
      component.onTypeClientChange(MemberType.INDIVIDUAL);
      expect(component.formData.contains('id')).toBe(true);
      expect(component.formData.contains('name')).toBe(true);
      expect(component.formData.contains('surname')).toBe(true);
      expect(component.formData.contains('email')).toBe(true);
      expect(component.formData.contains('phone')).toBe(true);
      expect(component.formData.contains('socialRate')).toBe(true);
    });

    it('should not include vatNumber in INDIVIDUAL form', () => {
      component.onTypeClientChange(MemberType.INDIVIDUAL);
      expect(component.formData.contains('vatNumber')).toBe(false);
    });

    it('should create COMPANY form with correct controls', () => {
      component.onTypeClientChange(MemberType.COMPANY);
      expect(component.formData.contains('id')).toBe(true);
      expect(component.formData.contains('name')).toBe(true);
      expect(component.formData.contains('vatNumber')).toBe(true);
    });

    it('should not include surname/email/phone/socialRate in COMPANY form base', () => {
      component.onTypeClientChange(MemberType.COMPANY);
      expect(component.formData.contains('surname')).toBe(false);
      expect(component.formData.contains('email')).toBe(false);
      expect(component.formData.contains('phone')).toBe(false);
      expect(component.formData.contains('socialRate')).toBe(false);
    });

    it('should set gestionnaire to true for COMPANY type', () => {
      component.onTypeClientChange(MemberType.COMPANY);
      expect(component.gestionnaire()).toBe(true);
    });

    it('should set gestionnaire to false for INDIVIDUAL type', () => {
      component.onTypeClientChange(MemberType.INDIVIDUAL);
      expect(component.gestionnaire()).toBe(false);
    });

    it('should add manager controls for COMPANY type', () => {
      component.onTypeClientChange(MemberType.COMPANY);
      expect(component.formData.contains('NRN_manager')).toBe(true);
      expect(component.formData.contains('name_manager')).toBe(true);
      expect(component.formData.contains('surname_manager')).toBe(true);
      expect(component.formData.contains('email_manager')).toBe(true);
      expect(component.formData.contains('phone_manager')).toBe(true);
    });
  });

  describe('submitForm1', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should call activateCallback with 1 when typeClient is set', () => {
      component.onTypeClientChange(MemberType.INDIVIDUAL);
      const callback = vi.fn();
      component.submitForm1(callback);
      expect(callback).toHaveBeenCalledWith(1);
    });

    it('should not call activateCallback when typeClient is -1', () => {
      const callback = vi.fn();
      component.submitForm1(callback);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('submitForm2', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should call activateCallback with 2 when formData is valid', () => {
      component.formData = new FormGroup({
        name: new FormControl('Test'),
      });
      const callback = vi.fn();
      component.submitForm2(callback);
      expect(callback).toHaveBeenCalledWith(2);
    });

    it('should not call activateCallback when formData is invalid', () => {
      component.formData = new FormGroup({
        name: new FormControl('', [Validators.required]),
      });
      const callback = vi.fn();
      component.submitForm2(callback);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('submitForm3', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should call activateCallback with 3 when addressForm is valid', () => {
      component.addressForm = new FormGroup({
        street: new FormControl('Main St'),
      });
      const callback = vi.fn();
      component.submitForm3(callback);
      expect(callback).toHaveBeenCalledWith(3);
    });

    it('should not call activateCallback when addressForm is invalid', () => {
      const callback = vi.fn();
      component.submitForm3(callback);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('updateGestionnaire', () => {
    beforeEach(async () => {
      await createComponent();
      component.onTypeClientChange(MemberType.INDIVIDUAL);
    });

    it('should add manager controls when set to true', () => {
      component.updateGestionnaire(true);
      expect(component.gestionnaire()).toBe(true);
      expect(component.formData.contains('NRN_manager')).toBe(true);
      expect(component.formData.contains('name_manager')).toBe(true);
      expect(component.formData.contains('surname_manager')).toBe(true);
      expect(component.formData.contains('email_manager')).toBe(true);
      expect(component.formData.contains('phone_manager')).toBe(true);
    });

    it('should remove manager controls when set to false', () => {
      component.updateGestionnaire(true);
      component.updateGestionnaire(false);
      expect(component.gestionnaire()).toBe(false);
      expect(component.formData.contains('NRN_manager')).toBe(false);
      expect(component.formData.contains('name_manager')).toBe(false);
    });

    it('should not error when removing controls that do not exist', () => {
      expect(() => component.updateGestionnaire(false)).not.toThrow();
    });
  });

  describe('gestionnaireChange', () => {
    beforeEach(async () => {
      await createComponent();
      component.onTypeClientChange(MemberType.INDIVIDUAL);
    });

    it('should call updateGestionnaire with true when checked is true', () => {
      const spy = vi.spyOn(component, 'updateGestionnaire');
      component.gestionnaireChange({ checked: true } as CheckboxChangeEvent);
      expect(spy).toHaveBeenCalledWith(true);
    });

    it('should call updateGestionnaire with false when checked is false', () => {
      const spy = vi.spyOn(component, 'updateGestionnaire');
      component.gestionnaireChange({ checked: false } as CheckboxChangeEvent);
      expect(spy).toHaveBeenCalledWith(false);
    });

    it('should handle array-style checked value with items', () => {
      const spy = vi.spyOn(component, 'updateGestionnaire');
      component.gestionnaireChange({ checked: [true] } as unknown as CheckboxChangeEvent);
      expect(spy).toHaveBeenCalledWith(true);
    });

    it('should handle empty array as false', () => {
      const spy = vi.spyOn(component, 'updateGestionnaire');
      component.gestionnaireChange({ checked: [] } as unknown as CheckboxChangeEvent);
      expect(spy).toHaveBeenCalledWith(false);
    });
  });

  describe('toggleSameAddress', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should remove billing address controls when same_address is true', () => {
      component.addressForm.patchValue({ same_address: true });
      component.toggleSameAddress({} as CheckboxChangeEvent);
      expect(component.addressForm.contains('billing_address_street')).toBe(false);
      expect(component.addressForm.contains('billing_address_number')).toBe(false);
      expect(component.addressForm.contains('billing_address_postcode')).toBe(false);
      expect(component.addressForm.contains('billing_address_supplement')).toBe(false);
      expect(component.addressForm.contains('billing_address_city')).toBe(false);
    });

    it('should add billing address controls when same_address is false', () => {
      // First remove them
      component.addressForm.patchValue({ same_address: true });
      component.toggleSameAddress({} as CheckboxChangeEvent);
      // Then toggle back
      component.addressForm.patchValue({ same_address: false });
      component.toggleSameAddress({} as CheckboxChangeEvent);
      expect(component.addressForm.contains('billing_address_street')).toBe(true);
      expect(component.addressForm.contains('billing_address_number')).toBe(true);
      expect(component.addressForm.contains('billing_address_postcode')).toBe(true);
      expect(component.addressForm.contains('billing_address_supplement')).toBe(true);
      expect(component.addressForm.contains('billing_address_city')).toBe(true);
    });

    it('should handle array-style same_address value', () => {
      component.addressForm.patchValue({ same_address: [true] });
      component.toggleSameAddress({} as CheckboxChangeEvent);
      expect(component.addressForm.contains('billing_address_street')).toBe(false);
    });
  });

  describe('onSubmitEnd', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should return early if ibanForm is invalid', () => {
      component.onTypeClientChange(MemberType.INDIVIDUAL);
      component.onSubmitEnd();
      expect(meServiceSpy.acceptInvitationMemberEncoded).not.toHaveBeenCalled();
    });

    it('should return early if typeClient is -1', () => {
      component.ibanForm.patchValue({ iban: 'BE71096123456769' });
      component.onSubmitEnd();
      expect(meServiceSpy.acceptInvitationMemberEncoded).not.toHaveBeenCalled();
    });

    it('should return early if COMPANY type and no manager', () => {
      component.onTypeClientChange(MemberType.COMPANY);
      // Remove manager controls to simulate no manager
      component.updateGestionnaire(false);
      fillValidForms();
      component.onSubmitEnd();
      expect(meServiceSpy.acceptInvitationMemberEncoded).not.toHaveBeenCalled();
    });

    it('should call service with correct DTO for INDIVIDUAL', () => {
      component.onTypeClientChange(MemberType.INDIVIDUAL);
      fillValidForms();
      fillIndividualForm();
      meServiceSpy.acceptInvitationMemberEncoded.mockReturnValue(of({ data: 'success' }));

      component.onSubmitEnd();

      expect(meServiceSpy.acceptInvitationMemberEncoded).toHaveBeenCalledTimes(1);
      const callArg = meServiceSpy.acceptInvitationMemberEncoded.mock
        .calls[0][0] as AcceptInvitationWEncodedDTO;
      expect(callArg.invitation_id).toBe(123);
      expect(callArg.member.member_type).toBe(MemberType.INDIVIDUAL);
      expect(callArg.member.first_name).toBe('John');
      expect(callArg.member.name).toBe('Doe');
      expect(callArg.member.NRN).toBe('12345');
      expect(callArg.member.email).toBe('john@test.com');
      expect(callArg.member.phone_number).toBe('0471234567');
      expect(callArg.member.iban).toBe('BE71096123456769');
      expect(callArg.member.manager).toBeUndefined();
    });

    it('should call service with correct DTO for COMPANY with manager', () => {
      component.onTypeClientChange(MemberType.COMPANY);
      fillValidForms();
      fillCompanyForm();
      fillManagerForm();
      meServiceSpy.acceptInvitationMemberEncoded.mockReturnValue(of({ data: 'success' }));

      component.onSubmitEnd();

      expect(meServiceSpy.acceptInvitationMemberEncoded).toHaveBeenCalledTimes(1);
      const callArg = meServiceSpy.acceptInvitationMemberEncoded.mock
        .calls[0][0] as AcceptInvitationWEncodedDTO;
      expect(callArg.member.member_type).toBe(MemberType.COMPANY);
      expect(callArg.member.vat_number).toBe('BE0123456789');
      const manager = callArg.member.manager;
      expect(manager).toBeDefined();
      if (manager) {
        expect(manager.NRN).toBe('90.01.15-123.45');
        expect(manager.name).toBe('Manager');
        expect(manager.surname).toBe('Name');
        expect(manager.email).toBe('manager@test.com');
        expect(manager.phone_number).toBe('0479999999');
      }
    });

    it('should close dialog with response data on success', () => {
      component.onTypeClientChange(MemberType.INDIVIDUAL);
      fillValidForms();
      fillIndividualForm();
      meServiceSpy.acceptInvitationMemberEncoded.mockReturnValue(of({ data: 'member-created' }));

      component.onSubmitEnd();

      expect(dialogRefSpy.close).toHaveBeenCalledWith('member-created');
    });

    it('should call errorHandler when response is falsy', () => {
      component.onTypeClientChange(MemberType.INDIVIDUAL);
      fillValidForms();
      fillIndividualForm();
      meServiceSpy.acceptInvitationMemberEncoded.mockReturnValue(of(null));

      component.onSubmitEnd();

      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith();
    });

    it('should call errorHandler with error data on error', () => {
      component.onTypeClientChange(MemberType.INDIVIDUAL);
      fillValidForms();
      fillIndividualForm();
      meServiceSpy.acceptInvitationMemberEncoded.mockReturnValue(
        throwError(() => ({ data: 'some-error' })),
      );

      component.onSubmitEnd();

      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith('some-error');
    });

    it('should call errorHandler with null when error has no data', () => {
      component.onTypeClientChange(MemberType.INDIVIDUAL);
      fillValidForms();
      fillIndividualForm();
      meServiceSpy.acceptInvitationMemberEncoded.mockReturnValue(throwError(() => ({})));

      component.onSubmitEnd();

      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(null);
    });

    it('should use homeAddress as billingAddress when same_address is true', () => {
      component.onTypeClientChange(MemberType.INDIVIDUAL);
      fillIndividualForm();
      component.ibanForm.patchValue({ iban: 'BE71096123456769' });

      // Set same_address to true and remove billing controls
      component.addressForm.patchValue({ same_address: true });
      component.toggleSameAddress({} as CheckboxChangeEvent);

      // Fill home address
      component.addressForm.patchValue({
        home_address_street: 'Home St',
        home_address_number: '10',
        home_address_postcode: '1000',
        home_address_supplement: '',
        home_address_city: 'Brussels',
      });

      meServiceSpy.acceptInvitationMemberEncoded.mockReturnValue(of({ data: 'ok' }));
      component.onSubmitEnd();

      const callArg = meServiceSpy.acceptInvitationMemberEncoded.mock
        .calls[0][0] as AcceptInvitationWEncodedDTO;
      expect(callArg.member.home_address.street).toBe('Home St');
      expect(callArg.member.billing_address.street).toBe('Home St');
    });

    it('should build separate billingAddress when same_address is false', () => {
      component.onTypeClientChange(MemberType.INDIVIDUAL);
      fillIndividualForm();
      component.ibanForm.patchValue({ iban: 'BE71096123456769' });

      component.addressForm.patchValue({
        same_address: false,
        home_address_street: 'Home St',
        home_address_number: '10',
        home_address_postcode: '1000',
        home_address_supplement: '',
        home_address_city: 'Brussels',
        billing_address_street: 'Billing St',
        billing_address_number: '20',
        billing_address_postcode: '2000',
        billing_address_supplement: 'A',
        billing_address_city: 'Antwerp',
      });

      meServiceSpy.acceptInvitationMemberEncoded.mockReturnValue(of({ data: 'ok' }));
      component.onSubmitEnd();

      const callArg = meServiceSpy.acceptInvitationMemberEncoded.mock
        .calls[0][0] as AcceptInvitationWEncodedDTO;
      expect(callArg.member.home_address.street).toBe('Home St');
      expect(callArg.member.billing_address.street).toBe('Billing St');
      expect(callArg.member.billing_address.city).toBe('Antwerp');
    });
  });

  // ---- Helper functions ----

  function fillValidForms(): void {
    component.ibanForm.patchValue({ iban: 'BE71096123456769' });
    component.addressForm.patchValue({
      same_address: false,
      home_address_street: 'Main St',
      home_address_number: '1',
      home_address_postcode: '1000',
      home_address_supplement: '',
      home_address_city: 'Brussels',
      billing_address_street: 'Bill St',
      billing_address_number: '2',
      billing_address_postcode: '2000',
      billing_address_supplement: '',
      billing_address_city: 'Liege',
    });
  }

  describe('Prefill from the user profile', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('reads nothing until the user asks for it', () => {
      expect(userServiceSpy.getUserInfo).not.toHaveBeenCalled();
      expect(component.prefillState()).toBe('idle');
    });

    it('holds the profile until a member type is chosen', () => {
      component.useMyProfile();

      expect(userServiceSpy.getUserInfo).toHaveBeenCalledTimes(1);
      // Step-1 controls do not exist yet, and whether the address applies at
      // all depends on the answer.
      expect(component.prefillState()).toBe('armed');
      expect(component.prefilledCount()).toBe(0);
    });

    it('fills the individual form once the type is chosen', () => {
      component.useMyProfile();
      component.onTypeClientChange(MemberType.INDIVIDUAL);

      expect(component.prefillState()).toBe('applied');
      expect(component.formData.getRawValue()).toMatchObject({
        id: '85073003328',
        // `name` is the FIRST name and `surname` the LAST name in this wizard.
        name: 'Alice',
        surname: 'Dupont',
        email: 'alice@example.be',
        phone: '+32470112233',
      });
      expect(component.ibanForm.get('iban')?.value).toBe('BE68539007547034');
      expect(component.addressForm.get('home_address_street')?.value).toBe('Rue de la Loi');
      // AddressDTO.number is numeric; the control is a text input.
      expect(component.addressForm.get('home_address_number')?.value).toBe('16');
      expect(component.prefilledCount()).toBeGreaterThan(0);
    });

    it('applies immediately when the type was already chosen', () => {
      component.onTypeClientChange(MemberType.INDIVIDUAL);
      component.useMyProfile();

      expect(component.prefillState()).toBe('applied');
      expect(component.formData.get('surname')?.value).toBe('Dupont');
    });

    it('fills only the manager block for a company', () => {
      component.useMyProfile();
      component.onTypeClientChange(MemberType.COMPANY);

      expect(component.formData.getRawValue()).toMatchObject({
        NRN_manager: '85073003328',
        name_manager: 'Alice',
        surname_manager: 'Dupont',
        email_manager: 'alice@example.be',
        phone_manager: '+32470112233',
      });
      // A company's own identity and bank details are not the user's personal ones.
      expect(component.formData.get('id')?.value).toBe('');
      expect(component.formData.get('name')?.value).toBe('');
      expect(component.formData.get('vatNumber')?.value).toBe('');
      expect(component.ibanForm.get('iban')?.value).toBe('');
      expect(component.addressForm.get('home_address_street')?.value).toBe('');
    });

    it('fills the manager block when an individual ticks the gestionnaire box', () => {
      component.useMyProfile();
      component.onTypeClientChange(MemberType.INDIVIDUAL);
      expect(component.formData.contains('NRN_manager')).toBe(false);

      component.gestionnaireChange({ checked: true } as CheckboxChangeEvent);

      expect(component.formData.get('NRN_manager')?.value).toBe('85073003328');
      expect(component.formData.get('surname_manager')?.value).toBe('Dupont');
    });

    it('never overwrites a value the user already typed', () => {
      component.onTypeClientChange(MemberType.INDIVIDUAL);
      component.formData.get('surname')?.setValue('Van Damme');
      component.ibanForm.get('iban')?.setValue('BE00000000000000');

      component.useMyProfile();

      expect(component.formData.get('surname')?.value).toBe('Van Damme');
      expect(component.ibanForm.get('iban')?.value).toBe('BE00000000000000');
      // The blank ones are still filled.
      expect(component.formData.get('name')?.value).toBe('Alice');
    });

    it('ticks "same address" and drops the billing controls when billing matches home', () => {
      userServiceSpy.getUserInfo.mockReturnValue(
        of(profileResponse({ billing_address: profile().home_address })),
      );

      component.useMyProfile();
      component.onTypeClientChange(MemberType.INDIVIDUAL);

      expect(component.addressForm.get('same_address')?.value).toEqual([true]);
      expect(component.addressForm.contains('billing_address_street')).toBe(false);
    });

    it('keeps both addresses when they differ', () => {
      component.useMyProfile();
      component.onTypeClientChange(MemberType.INDIVIDUAL);

      expect(component.addressForm.get('same_address')?.value).toBe(false);
      expect(component.addressForm.get('billing_address_street')?.value).toBe('Avenue Louise');
    });

    it('still fills what little a freshly provisioned account has', () => {
      // getProfile() creates the row with nothing but the email from Keycloak.
      userServiceSpy.getUserInfo.mockReturnValue(of(profileResponse(blankProfile())));

      component.useMyProfile();
      component.onTypeClientChange(MemberType.COMPANY);

      // Even here the manager block gets the email, so this is not "empty".
      expect(component.formData.get('email_manager')?.value).toBe('alice@example.be');
      expect(component.prefillState()).toBe('applied');
      expect(component.prefilledCount()).toBe(1);
    });

    it('reports an empty profile instead of claiming success', () => {
      userServiceSpy.getUserInfo.mockReturnValue(
        of(profileResponse({ ...blankProfile(), email: '' })),
      );

      component.useMyProfile();
      component.onTypeClientChange(MemberType.INDIVIDUAL);

      expect(component.prefillState()).toBe('empty');
      expect(component.prefilledCount()).toBe(0);
    });

    it('treats the 200-with-a-message failure envelope as an error', () => {
      userServiceSpy.getUserInfo.mockReturnValue(
        of({ data: 'Something went wrong', error_code: 42 }),
      );

      component.useMyProfile();

      expect(component.prefillState()).toBe('error');
    });

    it('reports a transport failure', () => {
      userServiceSpy.getUserInfo.mockReturnValue(throwError(() => new Error('offline')));

      component.useMyProfile();

      expect(component.prefillState()).toBe('error');
    });

    it('does not fire a second request while one is in flight', () => {
      userServiceSpy.getUserInfo.mockReturnValue(NEVER);

      component.useMyProfile();
      component.useMyProfile();

      expect(userServiceSpy.getUserInfo).toHaveBeenCalledTimes(1);
    });

    it('closes the dialog and leaves for the profile page', () => {
      component.goToProfile();

      expect(dialogRefSpy.close).toHaveBeenCalledWith(false);
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/users']);
    });

    it('does not put the "same address" tick back after the user removed it', () => {
      userServiceSpy.getUserInfo.mockReturnValue(
        of(profileResponse({ billing_address: profile().home_address })),
      );
      component.useMyProfile();
      component.onTypeClientChange(MemberType.INDIVIDUAL);
      expect(component.addressForm.get('same_address')?.value).toEqual([true]);

      // The user disagrees and unticks it, then goes back and changes the type.
      // `[]` is what an actual click produces: the non-binary checkbox filters
      // its value out of the model array.
      component.addressForm.get('same_address')?.setValue([]);
      component.toggleSameAddress({} as CheckboxChangeEvent);
      component.onTypeClientChange(MemberType.INDIVIDUAL);

      expect(component.addressForm.get('same_address')?.value).toEqual([]);
      expect(component.addressForm.contains('billing_address_street')).toBe(true);
    });

    it('stops counting a control that a type switch rebuilt empty', () => {
      component.useMyProfile();
      component.onTypeClientChange(MemberType.INDIVIDUAL);
      const asIndividual = component.prefilledCount();
      expect(component.formData.get('id')?.value).toBe('85073003328');

      component.onTypeClientChange(MemberType.COMPANY);

      // `id` exists on the company form too, but it was rebuilt blank and the
      // company branch never fills it, so the count must not carry it over.
      expect(component.formData.get('id')?.value).toBe('');
      expect(component.prefilledCount()).toBeLessThanOrEqual(asIndividual);
      expect(component.prefilledCount()).toBeGreaterThan(0);
    });

    it('stops counting a prefilled value the user has since replaced', () => {
      component.useMyProfile();
      component.onTypeClientChange(MemberType.INDIVIDUAL);
      const filled = component.prefilledCount();

      component.formData.get('surname')?.setValue('Van Damme');
      component.gestionnaireChange({ checked: false } as CheckboxChangeEvent);

      expect(component.prefilledCount()).toBe(filled - 1);
    });
  });

  function fillIndividualForm(): void {
    component.formData.patchValue({
      id: '12345',
      name: 'John',
      surname: 'Doe',
      email: 'john@test.com',
      phone: '0471234567',
      socialRate: false,
    });
  }

  function fillCompanyForm(): void {
    component.formData.patchValue({
      id: 'COMP001',
      name: 'TestCorp',
      vatNumber: 'BE0123456789',
    });
  }

  function fillManagerForm(): void {
    component.formData.patchValue({
      NRN_manager: '90.01.15-123.45',
      name_manager: 'Manager',
      surname_manager: 'Name',
      email_manager: 'manager@test.com',
      phone_manager: '0479999999',
    });
  }

  describe('address picker', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('fills the HOME controls from a picked suggestion', () => {
      pickAddress(component, 'onHomeAddressPicked', {
        street: 'Place de la Station',
        number: '20A',
        postcode: '5000',
        city: 'Namur',
      });

      const value = component.addressForm.getRawValue() as Record<string, unknown>;
      expect(value['home_address_street']).toBe('Place de la Station');
      expect(value['home_address_number']).toBe('20A');
      expect(value['home_address_postcode']).toBe('5000');
      expect(value['home_address_city']).toBe('Namur');
    });

    it('fills the BILLING controls independently', () => {
      pickAddress(component, 'onBillingAddressPicked', {
        street: 'Rue Neuve',
        number: '40',
        postcode: '1000',
        city: 'Bruxelles',
      });

      const value = component.addressForm.getRawValue() as Record<string, unknown>;
      expect(value['billing_address_street']).toBe('Rue Neuve');
      expect(value['home_address_street']).not.toBe('Rue Neuve');
    });

    it('keeps the home and billing coordinates apart', () => {
      // One store per block. A shared one would put the billing address on the
      // home address's roof.
      pickAddress(component, 'onHomeAddressPicked', {
        street: 'Rue A',
        number: '1',
        postcode: '1000',
        city: 'Bruxelles',
      });
      pickAddress(component, 'onBillingAddressPicked', {
        street: 'Rue B',
        number: '2',
        postcode: '1000',
        city: 'Bruxelles',
      });

      const c = component as unknown as {
        homePick: { geoFor: (f: unknown) => unknown };
        billingPick: { geoFor: (f: unknown) => unknown };
      };
      const home = {
        street: 'Rue A',
        number: '1',
        supplement: '',
        postcode: '1000',
        city: 'Bruxelles',
      };
      const billing = {
        street: 'Rue B',
        number: '2',
        supplement: '',
        postcode: '1000',
        city: 'Bruxelles',
      };
      expect(c.homePick.geoFor(home)).toMatchObject({ latitude: 50.846169 });
      expect(c.homePick.geoFor(billing)).toBeNull();
      expect(c.billingPick.geoFor(billing)).toMatchObject({ latitude: 50.846169 });
    });

    it('DROPS the coordinate once the address is edited afterwards', () => {
      pickAddress(component, 'onHomeAddressPicked', {
        street: 'Rue A',
        number: '1',
        postcode: '1000',
        city: 'Bruxelles',
      });

      const c = component as unknown as { homePick: { geoFor: (f: unknown) => unknown } };
      expect(
        c.homePick.geoFor({
          street: 'Rue A',
          number: '3',
          supplement: '',
          postcode: '1000',
          city: 'Bruxelles',
        }),
      ).toBeNull();
    });

    it('tolerates a pick while the billing controls are REMOVED', () => {
      // toggleSameAddress removes them outright; patchValue must not throw.
      component.addressForm.patchValue({ same_address: true });
      component.toggleSameAddress({} as CheckboxChangeEvent);

      expect(() =>
        pickAddress(component, 'onBillingAddressPicked', {
          street: 'Rue B',
          number: '2',
          postcode: '1000',
          city: 'Bruxelles',
        }),
      ).not.toThrow();
    });
  });
});
