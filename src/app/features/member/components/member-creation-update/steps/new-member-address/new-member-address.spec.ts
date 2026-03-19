import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { vi } from 'vitest';
import { CheckboxChangeEvent } from 'primeng/checkbox';

import { NewMemberAddress } from './new-member-address';

describe('NewMemberAddress', () => {
  let component: NewMemberAddress;
  let fixture: ComponentFixture<NewMemberAddress>;

  function buildAddressForm(): FormGroup {
    return new FormGroup({
      same_address: new FormControl(false),
      home_address_street: new FormControl('', [Validators.required]),
      home_address_number: new FormControl('', [Validators.required]),
      home_address_postcode: new FormControl('', [Validators.required]),
      home_address_supplement: new FormControl(''),
      home_address_city: new FormControl('', [Validators.required]),
      billing_address_street: new FormControl('', [Validators.required]),
      billing_address_number: new FormControl('', [Validators.required]),
      billing_address_postcode: new FormControl('', [Validators.required]),
      billing_address_supplement: new FormControl(''),
      billing_address_city: new FormControl('', [Validators.required]),
    });
  }

  function createComponent(form: FormGroup): void {
    fixture = TestBed.createComponent(NewMemberAddress);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('addressForm', form);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewMemberAddress, TranslateModule.forRoot()],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  // --- Basic creation ---

  it('should create', () => {
    createComponent(buildAddressForm());
    expect(component).toBeTruthy();
  });

  it('should receive addressForm input', () => {
    const form = buildAddressForm();
    createComponent(form);
    expect(component.addressForm()).toBe(form);
  });

  // --- submit ---

  describe('submit', () => {
    it('should emit formSubmitted when addressForm is valid', () => {
      const form = buildAddressForm();
      form.patchValue({
        home_address_street: 'Rue Test',
        home_address_number: '10',
        home_address_postcode: '1000',
        home_address_city: 'Brussels',
        billing_address_street: 'Rue Billing',
        billing_address_number: '20',
        billing_address_postcode: '2000',
        billing_address_city: 'Liege',
      });
      createComponent(form);

      const emitSpy = vi.fn();
      component.formSubmitted.subscribe(emitSpy);

      component.submit();

      expect(emitSpy).toHaveBeenCalledTimes(1);
    });

    it('should NOT emit formSubmitted when addressForm is invalid', () => {
      const form = buildAddressForm();
      // leave required fields empty
      createComponent(form);

      const emitSpy = vi.fn();
      component.formSubmitted.subscribe(emitSpy);

      component.submit();

      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  // --- goBack ---

  describe('goBack', () => {
    it('should emit backClicked', () => {
      createComponent(buildAddressForm());

      const emitSpy = vi.fn();
      component.backClicked.subscribe(emitSpy);

      component.goBack();

      expect(emitSpy).toHaveBeenCalledTimes(1);
    });
  });

  // --- toggleSameAddress ---

  describe('toggleSameAddress', () => {
    it('should emit toggleSameAddressEvent with the received event', () => {
      createComponent(buildAddressForm());

      const emitSpy = vi.fn();
      component.toggleSameAddressEvent.subscribe(emitSpy);

      const mockEvent = { checked: true } as unknown as CheckboxChangeEvent;
      component.toggleSameAddress(mockEvent);

      expect(emitSpy).toHaveBeenCalledWith(mockEvent);
    });
  });

  // --- submit with same_address removing billing controls ---

  describe('submit after billing controls removed', () => {
    it('should emit formSubmitted when billing controls are removed and home is valid', () => {
      const form = buildAddressForm();
      // Remove billing controls (simulating what parent does on same_address toggle)
      form.removeControl('billing_address_street');
      form.removeControl('billing_address_number');
      form.removeControl('billing_address_postcode');
      form.removeControl('billing_address_supplement');
      form.removeControl('billing_address_city');

      form.patchValue({
        same_address: true,
        home_address_street: 'Rue Test',
        home_address_number: '10',
        home_address_postcode: '1000',
        home_address_city: 'Brussels',
      });
      createComponent(form);

      const emitSpy = vi.fn();
      component.formSubmitted.subscribe(emitSpy);

      component.submit();

      expect(emitSpy).toHaveBeenCalledTimes(1);
    });
  });
});
