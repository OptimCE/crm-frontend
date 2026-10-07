import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { TranslateModule, TranslateService, TranslationObject } from '@ngx-translate/core';
import { vi } from 'vitest';
import { CheckboxChangeEvent } from 'primeng/checkbox';

import { NewMemberInformations } from './new-member-informations';
import { MemberType } from '../../../../../../shared/types/member.types';
import { numRegistreBeValidator } from '../../num_registre_nat_be.validator';
import de from '../../../../../../../assets/i18n/de.json';
import en from '../../../../../../../assets/i18n/en.json';
import fr from '../../../../../../../assets/i18n/fr.json';
import nl from '../../../../../../../assets/i18n/nl.json';

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

  // --- invalid national register number message, with the real bundles ---

  describe('invalid national register number message', () => {
    // BUG: fr, nl and de had copied the bank step's "the IBAN number is invalid",
    // so a mistyped national register number was reported as a wrong IBAN.
    // Cast: the PRIMENG block carries a number (`firstDayOfWeek`), which the
    // strict TranslationObject type does not admit. The strings are what matter.
    const bundles = { fr, nl, de, en } as unknown as Record<string, TranslationObject>;

    /** Nine digits, as the old placeholder showed: two short of a national register number. */
    const MISTYPED = '123456789';

    function buildFormWithMistypedNrns(): FormGroup {
      const nrnRules = [Validators.required, numRegistreBeValidator()];
      return new FormGroup({
        id: new FormControl(MISTYPED, nrnRules),
        name: new FormControl('Jean'),
        surname: new FormControl('Dupont'),
        email: new FormControl('jean@example.com'),
        phone: new FormControl('0498765432'),
        socialRate: new FormControl(false),
        NRN_manager: new FormControl(MISTYPED, nrnRules),
        name_manager: new FormControl('Marie'),
        surname_manager: new FormControl('Dupont'),
        email_manager: new FormControl('marie@example.com'),
        phone_manager: new FormControl('0498123456'),
      });
    }

    /** The message shown beside the input whose id is `inputId`. */
    function fieldMessage(root: HTMLElement, inputId: string): string {
      return (
        root
          .querySelector(`#${inputId}`)
          ?.parentElement?.querySelector('[data-testid="error-handler__message--error"]')
          ?.textContent?.trim() ?? ''
      );
    }

    it.each(Object.keys(bundles))(
      'names the national register number, not an IBAN, in %s',
      (lang) => {
        const translate = TestBed.inject(TranslateService);
        translate.setTranslation(lang, bundles[lang]);
        translate.use(lang);
        createComponent(buildFormWithMistypedNrns(), MemberType.INDIVIDUAL, true);
        const root = fixture.nativeElement as HTMLElement;

        root.querySelector('form')?.dispatchEvent(new Event('submit'));
        fixture.detectChanges();

        const message = translate.instant(
          'MEMBER.ADD.INFORMATIONS.ERROR.SOCIAL_SECURITY_NUMBER',
        ) as string;
        const summary = Array.from(
          root.querySelectorAll('[data-testid="summary-error__list"] li'),
          (item) => item.textContent?.trim(),
        );
        // Beside the member's and the guardian's number, and once each in the summary.
        expect([fieldMessage(root, 'nrn'), fieldMessage(root, 'NRN_manager'), ...summary]).toEqual([
          message,
          message,
          message,
          message,
        ]);
        // It names the field as the summary labels it, so a rewording stays green
        // and a copied IBAN message does not.
        const field = translate.instant('MEMBER.ADD.INFORMATIONS.FORM_ERROR.ID') as string;
        expect(message.toLowerCase()).toContain(field.toLowerCase());
        expect(message).not.toMatch(/IBAN/i);
      },
    );
  });
});
