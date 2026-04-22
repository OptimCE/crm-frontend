import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AbstractControl } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { UserService } from '../../../../../shared/services/user.service';
import { ApiResponse } from '../../../../../core/dtos/api.response';
import { UpdateUserDTO } from '../../../../../shared/dtos/user.dtos';
import { UserUpdateDialog } from './user-update-dialog';

function buildMockUser(): UpdateUserDTO {
  return {
    nrn: '123456',
    first_name: 'John',
    last_name: 'Doe',
    phone_number: '0471234567',
    iban: 'BE68539007547034',
    home_address: {
      street: 'Rue Haute',
      number: 10,
      postcode: '1000',
      city: 'Brussels',
      supplement: 'A',
    },
    billing_address: {
      street: 'Rue Basse',
      number: 20,
      postcode: '2000',
      city: 'Antwerp',
      supplement: '',
    },
  };
}

/** Safe accessor – fails the test early when the control is missing. */
function ctrl(component: UserUpdateDialog, name: string): AbstractControl {
  const c = component.formData.get(name);
  expect(c).toBeTruthy();
  return c as AbstractControl;
}

describe('UserUpdateDialog', () => {
  let component: UserUpdateDialog;
  let fixture: ComponentFixture<UserUpdateDialog>;

  let dialogConfigMock: { data: { user: UpdateUserDTO } | undefined };
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };
  let userServiceSpy: { updateUserInfo: ReturnType<typeof vi.fn> };

  async function createComponent(): Promise<void> {
    fixture = TestBed.createComponent(UserUpdateDialog);
    component = fixture.componentInstance;
    component.ngOnInit();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    dialogConfigMock = { data: { user: buildMockUser() } };
    dialogRefSpy = { close: vi.fn() };
    userServiceSpy = {
      updateUserInfo: vi.fn().mockReturnValue(of(new ApiResponse('ok'))),
    };

    await TestBed.configureTestingModule({
      imports: [UserUpdateDialog, TranslateModule.forRoot()],
      providers: [
        { provide: DynamicDialogConfig, useValue: dialogConfigMock },
        { provide: DynamicDialogRef, useValue: dialogRefSpy },
        { provide: UserService, useValue: userServiceSpy },
      ],
    }).compileComponents();
  });

  // ── 1. Creation ─────────────────────────────────────────────────────

  it('should create the component', async () => {
    await createComponent();
    expect(component).toBeTruthy();
  });

  // ── 2. Form initialisation ──────────────────────────────────────────

  describe('initializeForm', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should initialize form with all expected controls', () => {
      const expectedControls = [
        'id',
        'name',
        'surname',
        'phone',
        'iban',
        'same_address',
        'home_address_street',
        'home_address_number',
        'home_address_postcode',
        'home_address_supplement',
        'home_address_city',
        'billing_address_street',
        'billing_address_number',
        'billing_address_postcode',
        'billing_address_supplement',
        'billing_address_city',
      ];

      expectedControls.forEach((controlName) => {
        expect(component.formData.get(controlName)).toBeTruthy();
      });
    });

    it('should not have required validators on individual fields', () => {
      const fields = [
        'id',
        'name',
        'surname',
        'phone',
        'iban',
        'home_address_street',
        'home_address_number',
        'home_address_postcode',
        'home_address_city',
        'billing_address_street',
        'billing_address_number',
        'billing_address_postcode',
        'billing_address_city',
      ];

      fields.forEach((field) => {
        const control = ctrl(component, field);
        control.setValue('');
        expect(control.hasError('required')).toBe(false);
      });
    });

    it('should allow submitting an empty form (no fields required)', () => {
      dialogConfigMock.data = undefined;
      component.ngOnInit();

      expect(component.formData.valid).toBe(true);
    });
  });

  // ── 3. Address cross-validation ────────────────────────────────────

  describe('address cross-validation', () => {
    beforeEach(async () => {
      dialogConfigMock.data = undefined;
      await createComponent();
    });

    it('should mark form invalid when only some home address fields are filled', () => {
      ctrl(component, 'home_address_street').setValue('Rue Haute');
      component.formData.updateValueAndValidity();

      expect(component.formData.hasError('addressIncomplete')).toBe(true);
      expect(ctrl(component, 'home_address_number').hasError('addressRequired')).toBe(true);
      expect(ctrl(component, 'home_address_postcode').hasError('addressRequired')).toBe(true);
      expect(ctrl(component, 'home_address_city').hasError('addressRequired')).toBe(true);
    });

    it('should be valid when all required home address fields are filled', () => {
      ctrl(component, 'home_address_street').setValue('Rue Haute');
      ctrl(component, 'home_address_number').setValue('10');
      ctrl(component, 'home_address_postcode').setValue('1000');
      ctrl(component, 'home_address_city').setValue('Brussels');
      component.formData.updateValueAndValidity();

      expect(component.formData.hasError('addressIncomplete')).toBe(false);
    });

    it('should mark form invalid when only some billing address fields are filled', () => {
      ctrl(component, 'billing_address_street').setValue('Rue Basse');
      component.formData.updateValueAndValidity();

      expect(component.formData.hasError('addressIncomplete')).toBe(true);
      expect(ctrl(component, 'billing_address_number').hasError('addressRequired')).toBe(true);
    });

    it('should not require supplement for address validation', () => {
      ctrl(component, 'home_address_street').setValue('Rue Haute');
      ctrl(component, 'home_address_number').setValue('10');
      ctrl(component, 'home_address_postcode').setValue('1000');
      ctrl(component, 'home_address_city').setValue('Brussels');
      component.formData.updateValueAndValidity();

      expect(ctrl(component, 'home_address_supplement').hasError('addressRequired')).toBe(false);
      expect(component.formData.valid).toBe(true);
    });

    it('should clear stale addressRequired errors when a partially filled group is emptied', () => {
      ctrl(component, 'billing_address_street').setValue('X');
      component.formData.updateValueAndValidity();
      expect(component.formData.hasError('addressIncomplete')).toBe(true);

      ctrl(component, 'billing_address_street').setValue('');
      component.formData.updateValueAndValidity();

      expect(ctrl(component, 'billing_address_number').hasError('addressRequired')).toBe(false);
      expect(ctrl(component, 'billing_address_postcode').hasError('addressRequired')).toBe(false);
      expect(ctrl(component, 'billing_address_city').hasError('addressRequired')).toBe(false);
      expect(component.formData.valid).toBe(true);
    });

    it('should be valid when only the home address is filled and billing is empty', () => {
      ctrl(component, 'home_address_street').setValue('Rue Haute');
      ctrl(component, 'home_address_number').setValue('10');
      ctrl(component, 'home_address_postcode').setValue('1000');
      ctrl(component, 'home_address_city').setValue('Brussels');
      component.formData.updateValueAndValidity();

      expect(component.formData.valid).toBe(true);
    });

    it('should be valid when only the billing address is filled and home is empty', () => {
      ctrl(component, 'billing_address_street').setValue('Rue Basse');
      ctrl(component, 'billing_address_number').setValue('20');
      ctrl(component, 'billing_address_postcode').setValue('2000');
      ctrl(component, 'billing_address_city').setValue('Antwerp');
      component.formData.updateValueAndValidity();

      expect(component.formData.valid).toBe(true);
    });

    it('should be valid when same_address disables a partially pre-filled billing group', () => {
      ctrl(component, 'home_address_street').setValue('Rue Haute');
      ctrl(component, 'home_address_number').setValue('10');
      ctrl(component, 'home_address_postcode').setValue('1000');
      ctrl(component, 'home_address_city').setValue('Brussels');

      ctrl(component, 'billing_address_street').setValue('Stale');

      [
        'billing_address_street',
        'billing_address_number',
        'billing_address_postcode',
        'billing_address_supplement',
        'billing_address_city',
      ].forEach((name) => component.formData.get(name)?.disable());
      component.formData.updateValueAndValidity();

      expect(ctrl(component, 'billing_address_number').hasError('addressRequired')).toBe(false);
      expect(ctrl(component, 'billing_address_postcode').hasError('addressRequired')).toBe(false);
      expect(ctrl(component, 'billing_address_city').hasError('addressRequired')).toBe(false);
      expect(component.formData.valid).toBe(true);
    });
  });

  // ── 4. patchValue ───────────────────────────────────────────────────

  describe('patchValue', () => {
    it('should patch personal info fields from user DTO', async () => {
      await createComponent();

      expect(ctrl(component, 'id').value).toBe('123456');
      expect(ctrl(component, 'name').value).toBe('John');
      expect(ctrl(component, 'surname').value).toBe('Doe');
      expect(ctrl(component, 'phone').value).toBe('0471234567');
      expect(ctrl(component, 'iban').value).toBe('BE68539007547034');
    });

    it('should patch home address fields when home_address exists', async () => {
      await createComponent();

      expect(ctrl(component, 'home_address_street').value).toBe('Rue Haute');
      expect(ctrl(component, 'home_address_number').value).toBe(10);
      expect(ctrl(component, 'home_address_postcode').value).toBe('1000');
      expect(ctrl(component, 'home_address_city').value).toBe('Brussels');
      expect(ctrl(component, 'home_address_supplement').value).toBe('A');
    });

    it('should patch billing address fields when billing_address exists', async () => {
      await createComponent();

      expect(ctrl(component, 'billing_address_street').value).toBe('Rue Basse');
      expect(ctrl(component, 'billing_address_number').value).toBe(20);
      expect(ctrl(component, 'billing_address_postcode').value).toBe('2000');
      expect(ctrl(component, 'billing_address_city').value).toBe('Antwerp');
      expect(ctrl(component, 'billing_address_supplement').value).toBe('');
    });

    it('should not patch address fields when addresses are undefined', async () => {
      const user = buildMockUser();
      delete user.home_address;
      delete user.billing_address;
      dialogConfigMock.data = { user };

      await createComponent();

      expect(ctrl(component, 'home_address_street').value).toBe('');
      expect(ctrl(component, 'billing_address_street').value).toBe('');
    });

    it('should not patch when config data is undefined', async () => {
      dialogConfigMock.data = undefined;
      await createComponent();

      expect(ctrl(component, 'id').value).toBe('');
      expect(ctrl(component, 'name').value).toBe('');
    });
  });

  // ── 5. toggleSameAddress ────────────────────────────────────────────

  describe('toggleSameAddress', () => {
    const billingControlNames = [
      'billing_address_street',
      'billing_address_number',
      'billing_address_postcode',
      'billing_address_supplement',
      'billing_address_city',
    ];

    beforeEach(async () => {
      await createComponent();
    });

    it('should disable billing controls when same address is checked', () => {
      ctrl(component, 'same_address').setValue(true);
      component.toggleSameAddress({} as never);

      billingControlNames.forEach((name) => {
        expect(ctrl(component, name).disabled).toBe(true);
      });
    });

    it('should enable billing controls when same address is unchecked', () => {
      // First enable same address
      ctrl(component, 'same_address').setValue(true);
      component.toggleSameAddress({} as never);

      // Then disable it
      ctrl(component, 'same_address').setValue(false);
      component.toggleSameAddress({} as never);

      billingControlNames.forEach((name) => {
        expect(ctrl(component, name).enabled).toBe(true);
      });
    });

    it('should handle array value from checkbox (PrimeNG format) and disable billing controls', () => {
      ctrl(component, 'same_address').setValue([true]);
      component.toggleSameAddress({} as never);

      billingControlNames.forEach((name) => {
        expect(ctrl(component, name).disabled).toBe(true);
      });
    });
  });

  // ── 6. cancel ───────────────────────────────────────────────────────

  describe('cancel', () => {
    it('should close dialog with false', async () => {
      await createComponent();
      component.cancel();
      expect(dialogRefSpy.close).toHaveBeenCalledWith(false);
    });
  });

  // ── 7. submitForm — validation ──────────────────────────────────────

  describe('submitForm — invalid form', () => {
    it('should mark all fields as touched and not call service when address is incomplete', async () => {
      dialogConfigMock.data = undefined;
      await createComponent();

      ctrl(component, 'home_address_street').setValue('Rue Haute');
      component.formData.updateValueAndValidity();

      component.submitForm();

      expect(component.formData.touched).toBe(true);
      expect(userServiceSpy.updateUserInfo).not.toHaveBeenCalled();
      expect(dialogRefSpy.close).not.toHaveBeenCalled();
    });
  });

  // ── 8. submitForm — only sends filled fields ───────────────────────

  describe('submitForm — partial update', () => {
    it('should only send filled fields to the service', async () => {
      dialogConfigMock.data = undefined;
      await createComponent();

      ctrl(component, 'name').setValue('Alice');
      ctrl(component, 'phone').setValue('0499999999');

      component.submitForm();

      expect(userServiceSpy.updateUserInfo).toHaveBeenCalledTimes(1);
      const arg = userServiceSpy.updateUserInfo.mock.calls[0][0] as UpdateUserDTO;
      expect(arg.first_name).toBe('Alice');
      expect(arg.phone_number).toBe('0499999999');
      expect(arg.nrn).toBeUndefined();
      expect(arg.last_name).toBeUndefined();
      expect(arg.iban).toBeUndefined();
      expect(arg.home_address).toBeUndefined();
      expect(arg.billing_address).toBeUndefined();
    });

    it('should send an empty DTO when no fields are filled', async () => {
      dialogConfigMock.data = undefined;
      await createComponent();

      component.submitForm();

      expect(userServiceSpy.updateUserInfo).toHaveBeenCalledTimes(1);
      const arg = userServiceSpy.updateUserInfo.mock.calls[0][0] as UpdateUserDTO;
      expect(Object.keys(arg).length).toBe(0);
    });
  });

  // ── 9. submitForm — success with both addresses ─────────────────────

  describe('submitForm — valid form with both addresses', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should call updateUserInfo with the filled fields and addresses', () => {
      component.submitForm();

      expect(userServiceSpy.updateUserInfo).toHaveBeenCalledTimes(1);
      const arg = userServiceSpy.updateUserInfo.mock.calls[0][0] as UpdateUserDTO;
      expect(arg.nrn).toBe('123456');
      expect(arg.first_name).toBe('John');
      expect(arg.last_name).toBe('Doe');
      expect(arg.phone_number).toBe('0471234567');
      expect(arg.iban).toBe('BE68539007547034');
      expect(arg.home_address).toEqual({
        street: 'Rue Haute',
        number: 10,
        postcode: '1000',
        city: 'Brussels',
        supplement: 'A',
      });
      expect(arg.billing_address).toEqual({
        street: 'Rue Basse',
        number: 20,
        postcode: '2000',
        city: 'Antwerp',
        supplement: '',
      });
    });

    it('should close dialog with true on successful response', () => {
      component.submitForm();
      expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
    });
  });

  // ── 10. submitForm — same address (billing skipped) ──────────────────

  describe('submitForm — isSameAddress is true', () => {
    beforeEach(async () => {
      await createComponent();
      ctrl(component, 'same_address').setValue(true);
      component.toggleSameAddress({} as never);
    });

    it('should not include billing_address in DTO when isSameAddress is true', () => {
      component.submitForm();

      const arg = userServiceSpy.updateUserInfo.mock.calls[0][0] as UpdateUserDTO;
      expect(arg.billing_address).toBeUndefined();
    });
  });
});
