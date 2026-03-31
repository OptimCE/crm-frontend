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

    it('should set required validators on mandatory fields', () => {
      const requiredFields = [
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

      requiredFields.forEach((field) => {
        const control = ctrl(component, field);
        control.setValue('');
        expect(control.hasError('required')).toBe(true);
      });
    });

    it('should not set required validator on supplement fields', () => {
      const optionalFields = ['home_address_supplement', 'billing_address_supplement'];

      optionalFields.forEach((field) => {
        const control = ctrl(component, field);
        control.setValue('');
        expect(control.hasError('required')).toBe(false);
      });
    });
  });

  // ── 3. patchValue ───────────────────────────────────────────────────

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

  // ── 4. toggleSameAddress ────────────────────────────────────────────

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

  // ── 5. cancel ───────────────────────────────────────────────────────

  describe('cancel', () => {
    it('should close dialog with false', async () => {
      await createComponent();
      component.cancel();
      expect(dialogRefSpy.close).toHaveBeenCalledWith(false);
    });
  });

  // ── 6. submitForm — validation ──────────────────────────────────────

  describe('submitForm — invalid form', () => {
    it('should mark all fields as touched and not call service when form is invalid', async () => {
      dialogConfigMock.data = undefined;
      await createComponent();

      component.submitForm();

      expect(component.formData.touched).toBe(true);
      expect(userServiceSpy.updateUserInfo).not.toHaveBeenCalled();
      expect(dialogRefSpy.close).not.toHaveBeenCalled();
    });
  });

  // ── 7. submitForm — success with both addresses ─────────────────────

  describe('submitForm — valid form with both addresses', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should call updateUserInfo with the updated user DTO', () => {
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

  // ── 8. submitForm — same address (billing skipped) ──────────────────

  describe('submitForm — isSameAddress is true', () => {
    beforeEach(async () => {
      await createComponent();
      ctrl(component, 'same_address').setValue(true);
      component.toggleSameAddress({} as never);
    });

    it('should not set billing_address when isSameAddress is true', () => {
      const originalBilling = component.user.billing_address;
      component.submitForm();

      const arg = userServiceSpy.updateUserInfo.mock.calls[0][0] as UpdateUserDTO;
      // billing_address should remain unchanged (not overwritten by form values)
      expect(arg.billing_address).toEqual(originalBilling);
    });
  });
});
