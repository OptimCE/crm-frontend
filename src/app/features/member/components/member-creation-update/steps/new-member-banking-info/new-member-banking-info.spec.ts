import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { vi } from 'vitest';

import { NewMemberBankingInfo } from './new-member-banking-info';

describe('NewMemberBankingInfo', () => {
  let component: NewMemberBankingInfo;
  let fixture: ComponentFixture<NewMemberBankingInfo>;

  function buildIbanForm(): FormGroup {
    return new FormGroup({
      iban: new FormControl('', [Validators.required]),
    });
  }

  function createComponent(form: FormGroup): void {
    fixture = TestBed.createComponent(NewMemberBankingInfo);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('ibanForm', form);
    component.ngOnInit();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewMemberBankingInfo, TranslateModule.forRoot()],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  // --- Basic creation ---

  it('should create', () => {
    createComponent(buildIbanForm());
    expect(component).toBeTruthy();
  });

  it('should receive ibanForm input', () => {
    const form = buildIbanForm();
    createComponent(form);
    expect(component.ibanForm()).toBe(form);
  });

  // --- submit ---

  describe('submit', () => {
    it('should emit formSubmitted when ibanForm is valid', () => {
      const form = buildIbanForm();
      form.patchValue({ iban: 'BE68539007547034' });
      createComponent(form);

      const emitSpy = vi.fn();
      component.formSubmitted.subscribe(emitSpy);

      component.submit();

      expect(emitSpy).toHaveBeenCalledTimes(1);
    });

    it('should NOT emit formSubmitted when iban is empty (required)', () => {
      const form = buildIbanForm();
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
      createComponent(buildIbanForm());

      const emitSpy = vi.fn();
      component.backClicked.subscribe(emitSpy);

      component.goBack();

      expect(emitSpy).toHaveBeenCalledTimes(1);
    });
  });

  // --- setupErrorTranslation ---

  describe('setupErrorTranslation', () => {
    it('should initialize ibanErrorAdded as empty object', () => {
      createComponent(buildIbanForm());
      expect(component.ibanErrorAdded()).toBeDefined();
    });
  });

  // --- form validation ---

  describe('form validation', () => {
    it('should mark iban as required when empty', () => {
      const form = buildIbanForm();
      createComponent(form);

      expect(form.get('iban')?.hasError('required')).toBe(true);
    });

    it('should accept non-empty iban value', () => {
      const form = buildIbanForm();
      form.patchValue({ iban: 'BE68539007547034' });
      createComponent(form);

      expect(form.get('iban')?.valid).toBe(true);
    });
  });
});
