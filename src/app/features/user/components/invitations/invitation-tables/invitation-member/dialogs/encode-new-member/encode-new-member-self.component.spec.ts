import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { of, throwError } from 'rxjs';
import { CheckboxChangeEvent } from 'primeng/checkbox';

import { EncodeNewMemberSelfComponent } from './encode-new-member-self.component';
import { MeService } from '../../../../../../../../shared/services/me.service';
import { ErrorMessageHandler } from '../../../../../../../../shared/services-ui/error.message.handler';
import { MemberType } from '../../../../../../../../shared/types/member.types';
import { AcceptInvitationWEncodedDTO } from '../../../../../../../../shared/dtos/invitation.dtos';

describe('EncodeNewMemberSelfComponent', () => {
  let component: EncodeNewMemberSelfComponent;
  let fixture: ComponentFixture<EncodeNewMemberSelfComponent>;
  let meServiceSpy: { acceptInvitationMemberEncoded: ReturnType<typeof vi.fn> };
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };
  let dialogConfigSpy: { data: { invitationID?: number } | null };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };

  function setupTestBed(
    configData: { invitationID?: number } | null = { invitationID: 123 },
  ): void {
    meServiceSpy = { acceptInvitationMemberEncoded: vi.fn() };
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
});
