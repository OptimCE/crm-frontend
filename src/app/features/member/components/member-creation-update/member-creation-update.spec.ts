import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { TranslateModule } from '@ngx-translate/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';

import { MemberCreationUpdate } from './member-creation-update';
import { MemberService } from '../../../../shared/services/member.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { ApiResponse } from '../../../../core/dtos/api.response';
import { MemberType } from '../../../../shared/types/member.types';
import {
  IndividualDTO,
  CompanyDTO,
  CreateMemberDTO,
  ManagerDTO,
  UpdateMemberDTO,
} from '../../../../shared/dtos/member.dtos';
import { AddressDTO } from '../../../../shared/dtos/address.dtos';
import { CheckboxChangeEvent } from 'primeng/checkbox';

// --- Helper builders ---

function buildAddress(overrides: Partial<AddressDTO> = {}): AddressDTO {
  return {
    id: 1,
    street: 'Rue Test',
    number: 10,
    postcode: '1000',
    supplement: '',
    city: 'Brussels',
    ...overrides,
  };
}

function buildManager(overrides: Partial<ManagerDTO> = {}): ManagerDTO {
  return {
    id: 1,
    NRN: '90.01.15-123.45',
    name: 'Doe',
    surname: 'Jane',
    email: 'jane@example.com',
    phone_number: '0412345678',
    ...overrides,
  };
}

function buildIndividualDTO(overrides: Partial<IndividualDTO> = {}): IndividualDTO {
  return {
    id: 1,
    name: 'Dupont',
    member_type: MemberType.INDIVIDUAL,
    status: 1,
    iban: 'BE68539007547034',
    home_address: buildAddress(),
    billing_address: buildAddress({ id: 2, street: 'Rue Billing', number: 20 }),
    NRN: '90.01.15-001.23',
    first_name: 'Jean',
    email: 'jean@example.com',
    phone_number: '0498765432',
    social_rate: false,
    ...overrides,
  };
}

function buildCompanyDTO(overrides: Partial<CompanyDTO> = {}): CompanyDTO {
  return {
    id: 2,
    name: 'ACME Corp',
    member_type: MemberType.COMPANY,
    status: 1,
    iban: 'BE68539007547034',
    home_address: buildAddress(),
    billing_address: buildAddress({ id: 2, street: 'Rue Billing', number: 20 }),
    vat_number: 'BE0123456789',
    manager: buildManager(),
    ...overrides,
  };
}

// --- Helpers to fill forms for onSubmitEnd ---

function fillIndividualForms(component: MemberCreationUpdate): void {
  component.onTypeClientChange(MemberType.INDIVIDUAL);
  component.formData.patchValue({
    id: '90.01.15-001.23',
    name: 'Jean',
    surname: 'Dupont',
    email: 'jean@example.com',
    phone: '0498765432',
    socialRate: false,
  });
  component.addressForm.patchValue({
    home_address_street: 'Rue Test',
    home_address_number: '10',
    home_address_postcode: '1000',
    home_address_supplement: '',
    home_address_city: 'Brussels',
    billing_address_street: 'Rue Billing',
    billing_address_number: '20',
    billing_address_postcode: '2000',
    billing_address_supplement: '',
    billing_address_city: 'Liege',
  });
  component.ibanForm.patchValue({ iban: 'BE68539007547034' });
}

function fillCompanyForms(component: MemberCreationUpdate): void {
  component.onTypeClientChange(MemberType.COMPANY);
  component.formData.patchValue({
    id: 'BE0123456789',
    name: 'ACME Corp',
    vatNumber: 'BE0123456789',
    NRN_manager: '90.01.15-123.45',
    name_manager: 'Doe',
    surname_manager: 'Jane',
    email_manager: 'jane@example.com',
    phone_manager: '0412345678',
  });
  component.addressForm.patchValue({
    home_address_street: 'Rue Test',
    home_address_number: '10',
    home_address_postcode: '1000',
    home_address_supplement: '',
    home_address_city: 'Brussels',
    billing_address_street: 'Rue Billing',
    billing_address_number: '20',
    billing_address_postcode: '2000',
    billing_address_supplement: '',
    billing_address_city: 'Liege',
  });
  component.ibanForm.patchValue({ iban: 'BE68539007547034' });
}

describe('MemberCreationUpdate', () => {
  let component: MemberCreationUpdate;
  let fixture: ComponentFixture<MemberCreationUpdate>;

  let memberServiceSpy: {
    addMember: ReturnType<typeof vi.fn>;
    updateMember: ReturnType<typeof vi.fn>;
  };
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };
  let dialogConfigSpy: { data: { member: IndividualDTO | CompanyDTO } | null };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };

  // --- Default creation-mode setup ---

  function createTestBed(configData: { member: IndividualDTO | CompanyDTO } | null = null) {
    memberServiceSpy = { addMember: vi.fn(), updateMember: vi.fn() };
    dialogRefSpy = { close: vi.fn() };
    dialogConfigSpy = { data: configData };
    errorHandlerSpy = { handleError: vi.fn() };

    return TestBed.configureTestingModule({
      imports: [MemberCreationUpdate, TranslateModule.forRoot()],
      providers: [
        { provide: MemberService, useValue: memberServiceSpy },
        { provide: DynamicDialogRef, useValue: dialogRefSpy },
        { provide: DynamicDialogConfig, useValue: dialogConfigSpy },
        { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(MemberCreationUpdate, {
        set: {
          imports: [TranslateModule],
          template: '',
          providers: [{ provide: ErrorMessageHandler, useValue: errorHandlerSpy }],
        },
      })
      .compileComponents();
  }

  // =============================================
  // 1. Setup & Initialization — creation mode
  // =============================================

  describe('creation mode (no existing member)', () => {
    beforeEach(async () => {
      await createTestBed(null);
      fixture = TestBed.createComponent(MemberCreationUpdate);
      component = fixture.componentInstance;
      component.ngOnInit();
      await fixture.whenStable();
    });

    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize addressForm with all address controls', () => {
      expect(component.addressForm).toBeDefined();
      expect(component.addressForm.get('home_address_street')).toBeDefined();
      expect(component.addressForm.get('home_address_number')).toBeDefined();
      expect(component.addressForm.get('home_address_postcode')).toBeDefined();
      expect(component.addressForm.get('home_address_supplement')).toBeDefined();
      expect(component.addressForm.get('home_address_city')).toBeDefined();
      expect(component.addressForm.get('billing_address_street')).toBeDefined();
      expect(component.addressForm.get('billing_address_number')).toBeDefined();
      expect(component.addressForm.get('billing_address_postcode')).toBeDefined();
      expect(component.addressForm.get('billing_address_supplement')).toBeDefined();
      expect(component.addressForm.get('billing_address_city')).toBeDefined();
      expect(component.addressForm.get('same_address')).toBeDefined();
    });

    it('should initialize ibanForm with iban control', () => {
      expect(component.ibanForm).toBeDefined();
      expect(component.ibanForm.get('iban')).toBeDefined();
    });

    it('should default typeClient to -1', () => {
      expect(component.typeClient()).toBe(-1);
    });

    it('should default gestionnaire to false', () => {
      expect(component.gestionnaire()).toBe(false);
    });

    it('should not set existingMember when no config data', () => {
      expect(component.existingMember()).toBeUndefined();
    });
  });

  // =============================================
  // 2. Initialization — update mode (Individual)
  // =============================================

  describe('update mode with existing Individual', () => {
    const individual = buildIndividualDTO();

    beforeEach(async () => {
      await createTestBed({ member: individual });
      fixture = TestBed.createComponent(MemberCreationUpdate);
      component = fixture.componentInstance;
      component.ngOnInit();
      await fixture.whenStable();
    });

    it('should set existingMember signal from config data', () => {
      expect(component.existingMember()).toEqual(individual);
    });

    it('should set typeClient to INDIVIDUAL', () => {
      expect(component.typeClient()).toBe(MemberType.INDIVIDUAL);
    });

    it('should build formData with individual fields', () => {
      expect(component.formData).toBeDefined();
      expect(component.formData.get('id')).toBeDefined();
      expect(component.formData.get('name')).toBeDefined();
      expect(component.formData.get('surname')).toBeDefined();
      expect(component.formData.get('email')).toBeDefined();
      expect(component.formData.get('phone')).toBeDefined();
      expect(component.formData.get('socialRate')).toBeDefined();
    });

    it('should patch formData with existing individual values', () => {
      expect(component.formData.get('id')?.value).toBe(individual.NRN);
      expect(component.formData.get('name')?.value).toBe(individual.first_name);
      expect(component.formData.get('surname')?.value).toBe(individual.name);
      expect(component.formData.get('email')?.value).toBe(individual.email);
      expect(component.formData.get('phone')?.value).toBe(individual.phone_number);
      expect(component.formData.get('socialRate')?.value).toBe(individual.social_rate);
    });

    it('should patch addressForm with existing addresses', () => {
      expect(component.addressForm.get('home_address_street')?.value).toBe(
        individual.home_address.street,
      );
      expect(component.addressForm.get('home_address_number')?.value).toBe(
        individual.home_address.number,
      );
      expect(component.addressForm.get('home_address_city')?.value).toBe(
        individual.home_address.city,
      );
      expect(component.addressForm.get('billing_address_street')?.value).toBe(
        individual.billing_address.street,
      );
    });

    it('should patch ibanForm with existing IBAN', () => {
      expect(component.ibanForm.get('iban')?.value).toBe(individual.iban);
    });

    it('should not enable gestionnaire for individual without manager', () => {
      expect(component.gestionnaire()).toBe(false);
    });
  });

  // =============================================
  // 3. Initialization — update mode (Company)
  // =============================================

  describe('update mode with existing Company', () => {
    const company = buildCompanyDTO();

    beforeEach(async () => {
      await createTestBed({ member: company });
      fixture = TestBed.createComponent(MemberCreationUpdate);
      component = fixture.componentInstance;
      component.ngOnInit();
      await fixture.whenStable();
    });

    it('should set typeClient to COMPANY', () => {
      expect(component.typeClient()).toBe(MemberType.COMPANY);
    });

    it('should build formData with company fields', () => {
      expect(component.formData.get('vatNumber')).toBeDefined();
      expect(component.formData.get('vatNumber')?.value).toBe(company.vat_number);
    });

    it('should enable gestionnaire for companies', () => {
      expect(component.gestionnaire()).toBe(true);
    });

    it('should patch manager fields from existing company', () => {
      expect(component.formData.get('NRN_manager')?.value).toBe(company.manager.NRN);
      expect(component.formData.get('name_manager')?.value).toBe(company.manager.name);
      expect(component.formData.get('surname_manager')?.value).toBe(company.manager.surname);
      expect(component.formData.get('email_manager')?.value).toBe(company.manager.email);
      expect(component.formData.get('phone_manager')?.value).toBe(company.manager.phone_number);
    });
  });

  // =============================================
  // 4-9. Method tests (creation mode)
  // =============================================

  describe('methods', () => {
    beforeEach(async () => {
      await createTestBed(null);
      fixture = TestBed.createComponent(MemberCreationUpdate);
      component = fixture.componentInstance;
      component.ngOnInit();
      await fixture.whenStable();
    });

    // --- onTypeClientChange ---

    describe('onTypeClientChange', () => {
      it('should update typeClient signal', () => {
        component.onTypeClientChange(MemberType.INDIVIDUAL);
        expect(component.typeClient()).toBe(MemberType.INDIVIDUAL);
      });

      it('should build formData when type is not -1', () => {
        component.onTypeClientChange(MemberType.INDIVIDUAL);
        expect(component.formData).toBeDefined();
        expect(component.formData.get('id')).toBeDefined();
      });

      it('should not build formData when type is -1', () => {
        component.onTypeClientChange(-1);
        expect(component.formData).toBeUndefined();
      });
    });

    // --- buildFormGroup — Individual ---

    describe('buildFormGroup — Individual', () => {
      beforeEach(() => {
        component.onTypeClientChange(MemberType.INDIVIDUAL);
      });

      it('should create formData with individual controls', () => {
        expect(component.formData.get('id')).toBeDefined();
        expect(component.formData.get('name')).toBeDefined();
        expect(component.formData.get('surname')).toBeDefined();
        expect(component.formData.get('email')).toBeDefined();
        expect(component.formData.get('phone')).toBeDefined();
        expect(component.formData.get('socialRate')).toBeDefined();
      });

      it('should not have company-specific fields', () => {
        expect(component.formData.get('vatNumber')).toBeNull();
      });

      it('should set gestionnaire to false for individuals', () => {
        expect(component.gestionnaire()).toBe(false);
      });
    });

    // --- buildFormGroup — Company ---

    describe('buildFormGroup — Company', () => {
      beforeEach(() => {
        component.onTypeClientChange(MemberType.COMPANY);
      });

      it('should create formData with company controls', () => {
        expect(component.formData.get('id')).toBeDefined();
        expect(component.formData.get('name')).toBeDefined();
        expect(component.formData.get('vatNumber')).toBeDefined();
      });

      it('should not have individual-specific fields', () => {
        expect(component.formData.get('surname')).toBeNull();
        expect(component.formData.get('email')).toBeNull();
        expect(component.formData.get('phone')).toBeNull();
      });

      it('should set gestionnaire to true and add manager fields', () => {
        expect(component.gestionnaire()).toBe(true);
        expect(component.formData.get('NRN_manager')).toBeDefined();
        expect(component.formData.get('name_manager')).toBeDefined();
        expect(component.formData.get('surname_manager')).toBeDefined();
        expect(component.formData.get('email_manager')).toBeDefined();
        expect(component.formData.get('phone_manager')).toBeDefined();
      });
    });

    // --- Step navigation ---

    describe('step navigation', () => {
      it('submitForm1 should call activateCallback(1) when typeClient is set', () => {
        component.onTypeClientChange(MemberType.INDIVIDUAL);
        const callback = vi.fn();
        component.submitForm1(callback);
        expect(callback).toHaveBeenCalledWith(1);
      });

      it('submitForm1 should NOT call activateCallback when typeClient is -1', () => {
        const callback = vi.fn();
        component.submitForm1(callback);
        expect(callback).not.toHaveBeenCalled();
      });

      it('submitForm2 should call activateCallback(2) when formData is valid', () => {
        component.onTypeClientChange(MemberType.INDIVIDUAL);
        component.formData.patchValue({
          id: '90.01.15-001.23',
          name: 'Jean',
          surname: 'Dupont',
          email: 'jean@example.com',
          phone: '0498765432',
          socialRate: false,
        });
        const callback = vi.fn();
        component.submitForm2(callback);
        expect(callback).toHaveBeenCalledWith(2);
      });

      it('submitForm2 should NOT call activateCallback when formData is invalid', () => {
        component.onTypeClientChange(MemberType.INDIVIDUAL);
        // formData has required fields that are empty
        const callback = vi.fn();
        component.submitForm2(callback);
        expect(callback).not.toHaveBeenCalled();
      });

      it('submitForm3 should call activateCallback(3) when addressForm is valid', () => {
        component.addressForm.patchValue({
          home_address_street: 'Rue Test',
          home_address_number: '10',
          home_address_postcode: '1000',
          home_address_city: 'Brussels',
          billing_address_street: 'Rue Billing',
          billing_address_number: '20',
          billing_address_postcode: '2000',
          billing_address_city: 'Liege',
        });
        const callback = vi.fn();
        component.submitForm3(callback);
        expect(callback).toHaveBeenCalledWith(3);
      });

      it('submitForm3 should NOT call activateCallback when addressForm is invalid', () => {
        // addressForm has required fields that are empty by default
        const callback = vi.fn();
        component.submitForm3(callback);
        expect(callback).not.toHaveBeenCalled();
      });
    });

    // --- toggleSameAddress ---

    describe('toggleSameAddress', () => {
      it('should remove billing address controls when same_address is checked', () => {
        component.addressForm.patchValue({ same_address: true });
        component.toggleSameAddress({} as CheckboxChangeEvent);

        expect(component.addressForm.get('billing_address_street')).toBeNull();
        expect(component.addressForm.get('billing_address_number')).toBeNull();
        expect(component.addressForm.get('billing_address_postcode')).toBeNull();
        expect(component.addressForm.get('billing_address_city')).toBeNull();
      });

      it('should re-add billing address controls when same_address is unchecked', () => {
        // First remove them
        component.addressForm.patchValue({ same_address: true });
        component.toggleSameAddress({} as CheckboxChangeEvent);
        expect(component.addressForm.get('billing_address_street')).toBeNull();

        // Then re-add
        component.addressForm.patchValue({ same_address: false });
        component.toggleSameAddress({} as CheckboxChangeEvent);
        expect(component.addressForm.get('billing_address_street')).toBeDefined();
        expect(component.addressForm.get('billing_address_number')).toBeDefined();
      });

      it('should handle same_address as array (primeng checkbox behavior)', () => {
        component.addressForm.patchValue({ same_address: [true] });
        component.toggleSameAddress({} as CheckboxChangeEvent);
        expect(component.addressForm.get('billing_address_street')).toBeNull();
      });
    });

    // --- gestionnaireChange ---

    describe('gestionnaireChange', () => {
      beforeEach(() => {
        component.onTypeClientChange(MemberType.INDIVIDUAL);
      });

      it('should set gestionnaire to true and add manager controls', () => {
        component.gestionnaireChange({ checked: true } as unknown as CheckboxChangeEvent);

        expect(component.gestionnaire()).toBe(true);
        expect(component.formData.get('NRN_manager')).toBeDefined();
        expect(component.formData.get('name_manager')).toBeDefined();
        expect(component.formData.get('surname_manager')).toBeDefined();
        expect(component.formData.get('email_manager')).toBeDefined();
        expect(component.formData.get('phone_manager')).toBeDefined();
      });

      it('should set gestionnaire to false and remove manager controls', () => {
        // First add them
        component.gestionnaireChange({ checked: true } as unknown as CheckboxChangeEvent);
        expect(component.formData.get('NRN_manager')).toBeDefined();

        // Then remove
        component.gestionnaireChange({ checked: false } as unknown as CheckboxChangeEvent);
        expect(component.gestionnaire()).toBe(false);
        expect(component.formData.get('NRN_manager')).toBeNull();
      });

      it('should handle checked as array (primeng checkbox behavior)', () => {
        component.gestionnaireChange({ checked: [true] } as unknown as CheckboxChangeEvent);
        expect(component.gestionnaire()).toBe(true);

        component.gestionnaireChange({ checked: [] } as unknown as CheckboxChangeEvent);
        expect(component.gestionnaire()).toBe(false);
      });
    });
  });

  // =============================================
  // 10. onSubmitEnd — Creation
  // =============================================

  describe('onSubmitEnd — creation', () => {
    beforeEach(async () => {
      await createTestBed(null);
      fixture = TestBed.createComponent(MemberCreationUpdate);
      component = fixture.componentInstance;
      component.ngOnInit();
      await fixture.whenStable();
    });

    it('should not submit when ibanForm is invalid', () => {
      fillIndividualForms(component);
      component.ibanForm.patchValue({ iban: '' });
      component.onSubmitEnd();
      expect(memberServiceSpy.addMember).not.toHaveBeenCalled();
    });

    it('should not submit when typeClient is -1', () => {
      // formData is undefined when no type is selected, so onSubmitEnd
      // will throw before reaching the typeClient guard.
      component.ibanForm.patchValue({ iban: 'BE68539007547034' });
      expect(() => component.onSubmitEnd()).toThrow();
      expect(memberServiceSpy.addMember).not.toHaveBeenCalled();
    });

    it('should call addMember with correct DTO for individual', () => {
      fillIndividualForms(component);
      memberServiceSpy.addMember.mockReturnValue(of(new ApiResponse('ok')));

      component.onSubmitEnd();

      expect(memberServiceSpy.addMember).toHaveBeenCalledTimes(1);
      const dto = memberServiceSpy.addMember.mock.calls[0][0] as CreateMemberDTO;
      expect(dto.NRN).toBe('90.01.15-001.23');
      expect(dto.first_name).toBe('Jean');
      expect(dto.name).toBe('Dupont');
      expect(dto.email).toBe('jean@example.com');
      expect(dto.member_type).toBe(MemberType.INDIVIDUAL);
      expect(dto.iban).toBe('BE68539007547034');
      expect(dto.social_rate).toBe(false);
      expect(dto.home_address.street).toBe('Rue Test');
      expect(dto.billing_address.street).toBe('Rue Billing');
    });

    it('should call addMember with correct DTO for company with manager', () => {
      fillCompanyForms(component);
      memberServiceSpy.addMember.mockReturnValue(of(new ApiResponse('ok')));

      component.onSubmitEnd();

      expect(memberServiceSpy.addMember).toHaveBeenCalledTimes(1);
      const dto = memberServiceSpy.addMember.mock.calls[0][0] as CreateMemberDTO;
      expect(dto.member_type).toBe(MemberType.COMPANY);
      expect(dto.vat_number).toBe('BE0123456789');
      expect(dto.manager).toBeDefined();
      expect(dto.manager?.NRN).toBe('90.01.15-123.45');
      expect(dto.manager?.name).toBe('Doe');
      expect(dto.manager?.surname).toBe('Jane');
      expect(dto.manager?.email).toBe('jane@example.com');
    });

    it('should not submit company without manager', () => {
      component.onTypeClientChange(MemberType.COMPANY);
      // Disable gestionnaire to remove manager
      component.updateGestionnaire(false);
      component.formData.patchValue({
        id: 'BE0123456789',
        name: 'ACME Corp',
        vatNumber: 'BE0123456789',
      });
      component.addressForm.patchValue({
        home_address_street: 'Rue Test',
        home_address_number: '10',
        home_address_postcode: '1000',
        home_address_city: 'Brussels',
        billing_address_street: 'Rue Billing',
        billing_address_number: '20',
        billing_address_postcode: '2000',
        billing_address_city: 'Liege',
      });
      component.ibanForm.patchValue({ iban: 'BE68539007547034' });

      component.onSubmitEnd();

      expect(memberServiceSpy.addMember).not.toHaveBeenCalled();
    });

    it('should close dialog with 1 on successful creation', () => {
      fillIndividualForms(component);
      memberServiceSpy.addMember.mockReturnValue(of(new ApiResponse('ok')));

      component.onSubmitEnd();

      expect(dialogRefSpy.close).toHaveBeenCalledWith(1);
    });

    it('should call errorHandler when response is falsy', () => {
      fillIndividualForms(component);
      memberServiceSpy.addMember.mockReturnValue(of(null));

      component.onSubmitEnd();

      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });

    it('should call errorHandler with data on ApiResponse error', () => {
      fillIndividualForms(component);
      memberServiceSpy.addMember.mockReturnValue(
        throwError(() => new ApiResponse('Creation failed')),
      );

      component.onSubmitEnd();

      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith('Creation failed');
    });

    it('should call errorHandler with null on non-ApiResponse error', () => {
      fillIndividualForms(component);
      memberServiceSpy.addMember.mockReturnValue(throwError(() => new Error('network error')));

      component.onSubmitEnd();

      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(null);
    });
  });

  // =============================================
  // 11. onSubmitEnd — Update
  // =============================================

  describe('onSubmitEnd — update', () => {
    const individual = buildIndividualDTO();

    beforeEach(async () => {
      await createTestBed({ member: individual });
      fixture = TestBed.createComponent(MemberCreationUpdate);
      component = fixture.componentInstance;
      component.ngOnInit();
      await fixture.whenStable();
    });

    it('should call updateMember with correct DTO including existing id', () => {
      memberServiceSpy.updateMember.mockReturnValue(of(new ApiResponse('ok')));

      component.onSubmitEnd();

      expect(memberServiceSpy.updateMember).toHaveBeenCalledTimes(1);
      expect(memberServiceSpy.addMember).not.toHaveBeenCalled();
      const dto = memberServiceSpy.updateMember.mock.calls[0][0] as UpdateMemberDTO;
      expect(dto.id).toBe(individual.id);
    });

    it('should preserve address id when address has not changed', () => {
      memberServiceSpy.updateMember.mockReturnValue(of(new ApiResponse('ok')));

      component.onSubmitEnd();

      const dto = memberServiceSpy.updateMember.mock.calls[0][0] as UpdateMemberDTO;
      expect((dto.home_address as AddressDTO).id).toBe(individual.home_address.id);
      expect((dto.billing_address as AddressDTO).id).toBe(individual.billing_address.id);
    });

    it('should reset address id when address has changed', () => {
      component.addressForm.patchValue({
        home_address_street: 'Changed Street',
      });
      memberServiceSpy.updateMember.mockReturnValue(of(new ApiResponse('ok')));

      component.onSubmitEnd();

      const dto = memberServiceSpy.updateMember.mock.calls[0][0] as UpdateMemberDTO;
      expect((dto.home_address as AddressDTO).id).toBe(-1);
    });

    it('should close dialog with 2 on successful update', () => {
      memberServiceSpy.updateMember.mockReturnValue(of(new ApiResponse('ok')));

      component.onSubmitEnd();

      expect(dialogRefSpy.close).toHaveBeenCalledWith(2);
    });

    it('should call errorHandler when update response is falsy', () => {
      memberServiceSpy.updateMember.mockReturnValue(of(null));

      component.onSubmitEnd();

      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });

    it('should call errorHandler with data on ApiResponse update error', () => {
      memberServiceSpy.updateMember.mockReturnValue(
        throwError(() => new ApiResponse('Update failed')),
      );

      component.onSubmitEnd();

      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith('Update failed');
    });

    it('should call errorHandler with null on non-ApiResponse update error', () => {
      memberServiceSpy.updateMember.mockReturnValue(throwError(() => new Error('network error')));

      component.onSubmitEnd();

      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(null);
    });
  });

  // =============================================
  // 12. onSubmitEnd — same_address behavior
  // =============================================

  describe('onSubmitEnd — same_address', () => {
    beforeEach(async () => {
      await createTestBed(null);
      fixture = TestBed.createComponent(MemberCreationUpdate);
      component = fixture.componentInstance;
      component.ngOnInit();
      await fixture.whenStable();
    });

    it('should use home address as billing address when same_address is checked', () => {
      fillIndividualForms(component);
      // Toggle same address on (removes billing controls)
      component.addressForm.patchValue({ same_address: true });
      component.toggleSameAddress({} as CheckboxChangeEvent);

      memberServiceSpy.addMember.mockReturnValue(of(new ApiResponse('ok')));

      component.onSubmitEnd();

      const dto = memberServiceSpy.addMember.mock.calls[0][0] as CreateMemberDTO;
      expect(dto.home_address.street).toBe('Rue Test');
      expect(dto.billing_address.street).toBe('Rue Test');
      expect(dto.billing_address.city).toBe('Brussels');
    });
  });
});
