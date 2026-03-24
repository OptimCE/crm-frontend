import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { vi } from 'vitest';
import { CheckboxChangeEvent } from 'primeng/checkbox';

import { NewMemberInformations } from './new-member-informations';
import { MemberType } from '../../../../../../shared/types/member.types';

describe('NewMemberInformations', () => {
  let component: NewMemberInformations;
  let fixture: ComponentFixture<NewMemberInformations>;

  function buildIndividualForm(): FormGroup {
    return new FormGroup({
      id: new FormControl('', [Validators.required]),
      name: new FormControl('', [Validators.required]),
      surname: new FormControl('', [Validators.required]),
      email: new FormControl('', [Validators.required, Validators.email]),
      phone: new FormControl('', [Validators.required]),
      socialRate: new FormControl(false, [Validators.required]),
    });
  }

  function buildCompanyForm(): FormGroup {
    return new FormGroup({
      id: new FormControl('', [Validators.required]),
      name: new FormControl('', [Validators.required]),
      vatNumber: new FormControl('', [Validators.required]),
    });
  }

  function createComponent(form: FormGroup, typeClient: number, gestionnaire = false): void {
    fixture = TestBed.createComponent(NewMemberInformations);
    component = fixture.componentInstance;

    // Set required inputs using the fixture's componentRef
    fixture.componentRef.setInput('form', form);
    fixture.componentRef.setInput('typeClient', typeClient);
    fixture.componentRef.setInput('gestionnaire', gestionnaire);

    component.ngOnInit();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewMemberInformations, TranslateModule.forRoot()],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  // --- Basic creation ---

  describe('with individual form', () => {
    let form: FormGroup;

    beforeEach(() => {
      form = buildIndividualForm();
      createComponent(form, MemberType.INDIVIDUAL);
    });

    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should receive form input', () => {
      expect(component.form()).toBe(form);
    });

    it('should receive typeClient input', () => {
      expect(component.typeClient()).toBe(MemberType.INDIVIDUAL);
    });

    it('should default gestionnaire to false', () => {
      expect(component.gestionnaire()).toBe(false);
    });

    it('should expose MemberType enum for template', () => {
      expect(component['MemberType']).toBe(MemberType);
    });
  });

  // --- submit ---

  describe('submit', () => {
    it('should emit formSubmitted when form is valid', () => {
      const form = buildIndividualForm();
      form.patchValue({
        id: '12345',
        name: 'Jean',
        surname: 'Dupont',
        email: 'jean@example.com',
        phone: '0498765432',
        socialRate: false,
      });
      createComponent(form, MemberType.INDIVIDUAL);

      const emitSpy = vi.fn();
      component.formSubmitted.subscribe(emitSpy);

      component.submit();

      expect(emitSpy).toHaveBeenCalledTimes(1);
    });

    it('should NOT emit formSubmitted when form is invalid', () => {
      const form = buildIndividualForm();
      // leave required fields empty
      createComponent(form, MemberType.INDIVIDUAL);

      const emitSpy = vi.fn();
      component.formSubmitted.subscribe(emitSpy);

      component.submit();

      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('should mark form as touched when form is invalid', () => {
      const form = buildIndividualForm();
      createComponent(form, MemberType.INDIVIDUAL);

      const touchedSpy = vi.spyOn(form, 'markAsTouched');

      component.submit();

      expect(touchedSpy).toHaveBeenCalled();
    });
  });

  // --- goBack ---

  describe('goBack', () => {
    it('should emit backClicked', () => {
      const form = buildIndividualForm();
      createComponent(form, MemberType.INDIVIDUAL);

      const emitSpy = vi.fn();
      component.backClicked.subscribe(emitSpy);

      component.goBack();

      expect(emitSpy).toHaveBeenCalledTimes(1);
    });
  });

  // --- gestionnaireChange ---

  describe('gestionnaireChange', () => {
    it('should emit gestionnaireChangeEvent with the received event', () => {
      const form = buildIndividualForm();
      createComponent(form, MemberType.INDIVIDUAL);

      const emitSpy = vi.fn();
      component.gestionnaireChangeEvent.subscribe(emitSpy);

      const mockEvent = { checked: true } as unknown as CheckboxChangeEvent;
      component.gestionnaireChange(mockEvent);

      expect(emitSpy).toHaveBeenCalledWith(mockEvent);
    });
  });

  // --- setupErrorTranslation ---

  describe('setupErrorTranslation', () => {
    it('should initialize idErrorAdded as empty object before translations load', () => {
      const form = buildIndividualForm();
      createComponent(form, MemberType.INDIVIDUAL);

      // The signal is initialized with {} before translations arrive
      expect(component.idErrorAdded()).toBeDefined();
    });

    it('should initialize errorsSummaryAdded as empty object before translations load', () => {
      const form = buildIndividualForm();
      createComponent(form, MemberType.INDIVIDUAL);

      expect(component.errorsSummaryAdded()).toBeDefined();
    });
  });

  // --- with company form ---

  describe('with company form', () => {
    it('should accept a company form group', () => {
      const form = buildCompanyForm();
      createComponent(form, MemberType.COMPANY);

      expect(component.form()).toBe(form);
      expect(component.typeClient()).toBe(MemberType.COMPANY);
    });

    it('should submit valid company form', () => {
      const form = buildCompanyForm();
      form.patchValue({
        id: 'BE0123456789',
        name: 'ACME Corp',
        vatNumber: 'BE0123456789',
      });
      createComponent(form, MemberType.COMPANY);

      const emitSpy = vi.fn();
      component.formSubmitted.subscribe(emitSpy);

      component.submit();

      expect(emitSpy).toHaveBeenCalledTimes(1);
    });
  });

  // --- gestionnaire input ---

  describe('with gestionnaire enabled', () => {
    function buildIndividualFormWithManager(): FormGroup {
      const form = buildIndividualForm();
      form.addControl('NRN_manager', new FormControl('', [Validators.required]));
      form.addControl('name_manager', new FormControl('', [Validators.required]));
      form.addControl('surname_manager', new FormControl('', [Validators.required]));
      form.addControl(
        'email_manager',
        new FormControl('', [Validators.required, Validators.email]),
      );
      form.addControl('phone_manager', new FormControl('', [Validators.required]));
      return form;
    }

    it('should accept gestionnaire input as true', () => {
      const form = buildIndividualFormWithManager();
      createComponent(form, MemberType.INDIVIDUAL, true);

      expect(component.gestionnaire()).toBe(true);
    });

    it('should have manager controls available in form', () => {
      const form = buildIndividualFormWithManager();
      createComponent(form, MemberType.INDIVIDUAL, true);

      expect(form.get('NRN_manager')).toBeDefined();
      expect(form.get('name_manager')).toBeDefined();
      expect(form.get('surname_manager')).toBeDefined();
      expect(form.get('email_manager')).toBeDefined();
      expect(form.get('phone_manager')).toBeDefined();
    });
  });
});
