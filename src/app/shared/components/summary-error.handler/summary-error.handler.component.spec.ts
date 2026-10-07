import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, EventEmitter, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  FormGroupDirective,
  FormRecord,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { By } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import { vi } from 'vitest';

import { FormErrorSummaryComponent } from './summary-error.handler.component';
import { ErrorHandlerParams } from '../../types/error.types';

/** A parent that can hand its form a new group, as the member wizards do. */
@Component({
  selector: 'app-swapping-form-host',
  standalone: true,
  imports: [ReactiveFormsModule, FormErrorSummaryComponent],
  template: `<form [formGroup]="group()"><app-summary-error /></form>`,
})
class SwappingFormHost {
  readonly group = signal<FormGroup>(
    new FormGroup({ name: new FormControl('', Validators.required) }),
  );
}

describe('FormErrorSummaryComponent', () => {
  let component: FormErrorSummaryComponent;
  let fixture: ComponentFixture<FormErrorSummaryComponent>;
  let mockFormGroupDirective: FormGroupDirective;
  let formGroup: FormGroup;
  function setupTestBed(
    controls: Record<string, FormControl> = {
      name: new FormControl(''),
      email: new FormControl(''),
    },
  ) {
    formGroup = new FormGroup(controls);
    mockFormGroupDirective = new FormGroupDirective([], []);
    mockFormGroupDirective.form = formGroup;

    // ngSubmit is an EventEmitter on FormGroupDirective
    (mockFormGroupDirective as unknown as { ngSubmit: EventEmitter<unknown> }).ngSubmit =
      new EventEmitter<unknown>();

    return TestBed.configureTestingModule({
      imports: [FormErrorSummaryComponent, TranslateModule.forRoot()],
      providers: [{ provide: FormGroupDirective, useValue: mockFormGroupDirective }],
    })
      .overrideComponent(FormErrorSummaryComponent, {
        set: { template: '' },
      })
      .compileComponents();
  }

  function createComponent() {
    fixture = TestBed.createComponent(FormErrorSummaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // =============================================
  // 1. Component Creation
  // =============================================

  describe('creation', () => {
    beforeEach(async () => {
      await setupTestBed();
      createComponent();
    });

    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize errorMessages as empty array', () => {
      expect(component.errorMessages()).toEqual([]);
    });

    it('should initialize hasSubmitted as false', () => {
      expect(component.hasSubmitted()).toBe(false);
    });

    it('should initialize showBeforeSubmit as false', () => {
      expect(component.showBeforeSubmit()).toBe(false);
    });
  });

  // =============================================
  // 2. Initialization (ngOnInit) — submit behavior
  // =============================================

  describe('ngOnInit — submit behavior', () => {
    beforeEach(async () => {
      await setupTestBed({
        name: new FormControl('', Validators.required),
      });
      createComponent();
    });

    it('should set hasSubmitted to true on ngSubmit', () => {
      expect(component.hasSubmitted()).toBe(false);

      mockFormGroupDirective.ngSubmit.emit();

      expect(component.hasSubmitted()).toBe(true);
    });

    it('should collect errors on ngSubmit when controls have errors', () => {
      // name control is empty and required → should have errors after submit
      mockFormGroupDirective.ngSubmit.emit();

      expect(component.errorMessages().length).toBeGreaterThan(0);
    });

    it('should collect errors on valueChanges after submit', () => {
      // Submit first to set hasSubmitted
      mockFormGroupDirective.ngSubmit.emit();
      const errorsAfterSubmit = component.errorMessages().length;
      expect(errorsAfterSubmit).toBeGreaterThan(0);

      // Fix the error
      formGroup.get('name')?.setValue('valid');
      expect(component.errorMessages().length).toBe(0);
    });

    it('should collect errors on statusChanges after submit', () => {
      mockFormGroupDirective.ngSubmit.emit();
      expect(component.errorMessages().length).toBeGreaterThan(0);

      // Fix the error by setting a value
      formGroup.get('name')?.setValue('valid');
      expect(component.errorMessages().length).toBe(0);
    });

    it('should NOT collect errors on value changes when hasSubmitted is false and showBeforeSubmit is false', () => {
      // No submit, no showBeforeSubmit → errors should stay empty
      formGroup.get('name')?.setValue('something');
      formGroup.get('name')?.setValue('');

      expect(component.errorMessages()).toEqual([]);
    });
  });

  // =============================================
  // 3. showBeforeSubmit behavior
  // =============================================

  describe('showBeforeSubmit', () => {
    beforeEach(async () => {
      await setupTestBed({
        name: new FormControl('', Validators.required),
      });
      createComponent();
    });

    it('should collect errors on value changes when showBeforeSubmit is true', () => {
      fixture.componentRef.setInput('showBeforeSubmit', true);
      fixture.detectChanges();

      // Trigger a value change to activate the subscription
      formGroup.get('name')?.setValue('');
      formGroup.get('name')?.updateValueAndValidity();

      expect(component.errorMessages().length).toBeGreaterThan(0);
    });
  });

  // =============================================
  // 4. Error Collection — default error handlers
  // =============================================

  describe('error collection — default handlers', () => {
    it('should collect required error message', async () => {
      await setupTestBed({
        username: new FormControl('', Validators.required),
      });
      createComponent();

      mockFormGroupDirective.ngSubmit.emit();

      const errors = component.errorMessages();
      expect(errors.length).toBe(1);
      // Should contain the control name in some form
      expect(errors[0]).toBeTruthy();
    });

    it('should collect email error message', async () => {
      await setupTestBed({
        email: new FormControl('not-an-email', Validators.email),
      });
      createComponent();

      mockFormGroupDirective.ngSubmit.emit();

      const errors = component.errorMessages();
      expect(errors.length).toBe(1);
      expect(errors[0]).toBeTruthy();
    });

    it('should collect minlength error message with params', async () => {
      await setupTestBed({
        password: new FormControl('ab', Validators.minLength(8)),
      });
      createComponent();

      mockFormGroupDirective.ngSubmit.emit();

      const errors = component.errorMessages();
      expect(errors.length).toBe(1);
      expect(errors[0]).toBeTruthy();
    });

    it('should return empty errors when all controls are valid', async () => {
      await setupTestBed({
        name: new FormControl('John', Validators.required),
        email: new FormControl('john@test.com', Validators.email),
      });
      createComponent();

      mockFormGroupDirective.ngSubmit.emit();

      expect(component.errorMessages()).toEqual([]);
    });

    it('should collect multiple errors from multiple controls', async () => {
      await setupTestBed({
        name: new FormControl('', Validators.required),
        email: new FormControl('bad', Validators.email),
      });
      createComponent();

      mockFormGroupDirective.ngSubmit.emit();

      expect(component.errorMessages().length).toBe(2);
    });

    it('should collect multiple errors from a single control', async () => {
      await setupTestBed({
        email: new FormControl('ab', [Validators.email, Validators.minLength(8)]),
      });
      createComponent();

      mockFormGroupDirective.ngSubmit.emit();

      // email + minlength errors on same control
      expect(component.errorMessages().length).toBe(2);
    });
  });

  // =============================================
  // 4b. Error Collection — nested groups (recursion)
  // =============================================

  describe('error collection — nested groups', () => {
    function setupNested() {
      formGroup = new FormGroup({
        name: new FormControl('', Validators.required),
        inputs: new FormRecord({
          iterations: new FormControl<number | null>(null, Validators.required),
        }),
      });
      mockFormGroupDirective = new FormGroupDirective([], []);
      mockFormGroupDirective.form = formGroup;
      (mockFormGroupDirective as unknown as { ngSubmit: EventEmitter<unknown> }).ngSubmit =
        new EventEmitter<unknown>();

      return TestBed.configureTestingModule({
        imports: [FormErrorSummaryComponent, TranslateModule.forRoot()],
        providers: [{ provide: FormGroupDirective, useValue: mockFormGroupDirective }],
      })
        .overrideComponent(FormErrorSummaryComponent, { set: { template: '' } })
        .compileComponents();
    }

    it('should collect errors from controls nested in a FormRecord/FormGroup', async () => {
      await setupNested();
      createComponent();

      mockFormGroupDirective.ngSubmit.emit();

      // top-level `name` required + nested `iterations` required
      expect(component.errorMessages().length).toBe(2);
    });

    it('should clear nested errors once the nested control becomes valid', async () => {
      await setupNested();
      createComponent();

      mockFormGroupDirective.ngSubmit.emit();
      expect(component.errorMessages().length).toBe(2);

      formGroup.get('name')?.setValue('valid');
      (formGroup.get('inputs') as FormRecord).get('iterations')?.setValue(10);

      expect(component.errorMessages()).toEqual([]);
    });
  });

  // =============================================
  // 5. Error Collection — fallback unknown error
  // =============================================

  describe('error collection — unknown error key', () => {
    it('should use fallback message for unrecognized error keys', async () => {
      await setupTestBed({
        field: new FormControl(''),
      });
      createComponent();

      // Manually set an unknown error
      formGroup.get('field')?.setErrors({ customUnknownValidator: true });

      mockFormGroupDirective.ngSubmit.emit();

      const errors = component.errorMessages();
      expect(errors.length).toBe(1);
      expect(errors[0]).toBeTruthy();
    });
  });

  // =============================================
  // 6. Error Collection — errorsAdd input (custom overrides)
  // =============================================

  describe('error collection — errorsAdd input', () => {
    it('should use custom error handler from errorsAdd input', async () => {
      await setupTestBed({
        field: new FormControl(''),
      });
      createComponent();

      const customHandler = vi.fn(
        (_params: ErrorHandlerParams, _controlName: string, _displayName?: string) =>
          'Custom error message',
      );
      fixture.componentRef.setInput('errorsAdd', { customError: customHandler });
      fixture.detectChanges();

      formGroup.get('field')?.setErrors({ customError: { detail: 'bad' } });
      mockFormGroupDirective.ngSubmit.emit();

      const errors = component.errorMessages();
      expect(errors.length).toBe(1);
      expect(errors[0]).toBe('Custom error message');
      expect(customHandler).toHaveBeenCalledWith({ detail: 'bad' }, 'field', expect.any(String));
    });

    it('should allow errorsAdd to override default error handlers', async () => {
      await setupTestBed({
        name: new FormControl('', Validators.required),
      });
      createComponent();

      fixture.componentRef.setInput('errorsAdd', {
        required: () => 'Overridden required message',
      });
      fixture.detectChanges();

      mockFormGroupDirective.ngSubmit.emit();

      const errors = component.errorMessages();
      expect(errors.length).toBe(1);
      expect(errors[0]).toBe('Overridden required message');
    });
  });

  // =============================================
  // 7. Display Name Resolution — controlLabels
  // =============================================

  describe('display name resolution — controlLabels', () => {
    it('should use controlLabels input value as display name', async () => {
      await setupTestBed({
        firstName: new FormControl('', Validators.required),
      });
      createComponent();

      fixture.componentRef.setInput('controlLabels', { firstName: 'First Name' });
      fixture.detectChanges();

      // Use a custom errorsAdd to capture the displayName argument
      const spy = vi.fn(
        (_params: ErrorHandlerParams, _controlName: string, displayName?: string) =>
          `Error on ${displayName}`,
      );
      fixture.componentRef.setInput('errorsAdd', { required: spy });
      fixture.detectChanges();

      mockFormGroupDirective.ngSubmit.emit();

      expect(spy).toHaveBeenCalledWith(expect.anything(), 'firstName', 'First Name');
    });
  });

  // =============================================
  // 8. Prettify fallback
  // =============================================

  describe('display name resolution — prettify fallback', () => {
    it('should prettify camelCase control names', async () => {
      await setupTestBed({
        emailAddress: new FormControl('', Validators.required),
      });
      createComponent();

      const spy = vi.fn(
        (_params: ErrorHandlerParams, _controlName: string, displayName?: string) =>
          `Error: ${displayName}`,
      );
      fixture.componentRef.setInput('errorsAdd', { required: spy });
      fixture.detectChanges();

      mockFormGroupDirective.ngSubmit.emit();

      expect(spy).toHaveBeenCalledWith(expect.anything(), 'emailAddress', 'Email address');
    });

    it('should prettify snake_case control names', async () => {
      await setupTestBed({
        first_name: new FormControl('', Validators.required),
      });
      createComponent();

      const spy = vi.fn(
        (_params: ErrorHandlerParams, _controlName: string, displayName?: string) =>
          `Error: ${displayName}`,
      );
      fixture.componentRef.setInput('errorsAdd', { required: spy });
      fixture.detectChanges();

      mockFormGroupDirective.ngSubmit.emit();

      expect(spy).toHaveBeenCalledWith(expect.anything(), 'first_name', 'First name');
    });

    it('should prettify kebab-case control names', async () => {
      await setupTestBed({
        'last-name': new FormControl('', Validators.required),
      });
      createComponent();

      const spy = vi.fn(
        (_params: ErrorHandlerParams, _controlName: string, displayName?: string) =>
          `Error: ${displayName}`,
      );
      fixture.componentRef.setInput('errorsAdd', { required: spy });
      fixture.detectChanges();

      mockFormGroupDirective.ngSubmit.emit();

      expect(spy).toHaveBeenCalledWith(expect.anything(), 'last-name', 'Last name');
    });
  });

  // =============================================
  // 9. Error clearing behavior
  // =============================================

  describe('error clearing', () => {
    beforeEach(async () => {
      await setupTestBed({
        name: new FormControl('', Validators.required),
      });
      createComponent();
    });

    it('should clear errors when all controls become valid after submit', () => {
      mockFormGroupDirective.ngSubmit.emit();
      expect(component.errorMessages().length).toBeGreaterThan(0);

      formGroup.get('name')?.setValue('Valid');
      expect(component.errorMessages()).toEqual([]);
    });
  });

  // =============================================
  // 9b. A FormGroup swapped into the directive
  // =============================================

  // `[formGroup]` can be handed a new group after this component exists: the
  // member wizards rebuild theirs whenever the member type changes. The summary
  // notices during the check of its parent's view, so this needs a real parent
  // re-binding a real FormGroupDirective.
  describe('a FormGroup swapped into the directive', () => {
    let host: ComponentFixture<SwappingFormHost>;
    let summary: FormErrorSummaryComponent;
    let replacement: FormGroup;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [SwappingFormHost, TranslateModule.forRoot()],
      }).compileComponents();
      host = TestBed.createComponent(SwappingFormHost);
      host.detectChanges();
      summary = host.debugElement.query(By.directive(FormErrorSummaryComponent))
        .componentInstance as FormErrorSummaryComponent;
      replacement = new FormGroup({
        company: new FormControl('', Validators.required),
        vat: new FormControl('', Validators.required),
      });
    });

    function submit(): void {
      (host.nativeElement as HTMLElement).querySelector('form')?.dispatchEvent(new Event('submit'));
    }

    function swapIn(group: FormGroup): void {
      host.componentInstance.group.set(group);
      host.detectChanges();
    }

    function isObserved(changes: unknown): boolean {
      return (changes as { observed: boolean }).observed;
    }

    it('lists the errors of the new group as soon as it is swapped in after a submit', () => {
      submit();
      expect(summary.errorMessages().length).toBe(1);

      swapIn(replacement);

      expect(summary.errorMessages().length).toBe(2);
    });

    it('refreshes as the new group is fixed', () => {
      submit();
      swapIn(replacement);

      replacement.get('company')?.setValue('ACME');
      replacement.get('vat')?.setValue('BE0123456789');

      expect(summary.errorMessages()).toEqual([]);
    });

    it('stops listening to the group it replaced', () => {
      const replaced = host.componentInstance.group();
      expect(isObserved(replaced.valueChanges)).toBe(true);

      swapIn(replacement);

      expect(isObserved(replaced.valueChanges)).toBe(false);
      expect(isObserved(replaced.statusChanges)).toBe(false);
    });

    it('stays empty after a swap until the form is submitted', () => {
      swapIn(replacement);

      replacement.get('company')?.setValue('ACME');

      expect(summary.errorMessages()).toEqual([]);
    });
  });

  // Production builds skip the NG01052 check, so a step panel that PrimeNG
  // creates before its form exists leaves the directive without a group.
  describe('a directive that has no group yet', () => {
    beforeEach(async () => {
      await setupTestBed();
      mockFormGroupDirective.form = null as unknown as FormGroup;
    });

    it('waits for the group and follows it once it arrives', () => {
      fixture = TestBed.createComponent(FormErrorSummaryComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('showBeforeSubmit', true);
      fixture.detectChanges();
      expect(component.errorMessages()).toEqual([]);

      const group = new FormGroup({ name: new FormControl('', Validators.required) });
      mockFormGroupDirective.form = group;
      // Stands in for the check of the parent's view that follows a re-bind.
      fixture.componentRef.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      expect(component.errorMessages().length).toBe(1);

      group.get('name')?.setValue('Jean');
      expect(component.errorMessages()).toEqual([]);
    });
  });

  // =============================================
  // 10. Template rendering
  // =============================================

  describe('template rendering', () => {
    beforeEach(async () => {
      // Use real template for rendering tests
      formGroup = new FormGroup({
        name: new FormControl('', Validators.required),
      });
      mockFormGroupDirective = new FormGroupDirective([], []);
      mockFormGroupDirective.form = formGroup;
      (mockFormGroupDirective as unknown as { ngSubmit: EventEmitter<unknown> }).ngSubmit =
        new EventEmitter<unknown>();

      await TestBed.configureTestingModule({
        imports: [FormErrorSummaryComponent, TranslateModule.forRoot()],
        providers: [{ provide: FormGroupDirective, useValue: mockFormGroupDirective }],
      }).compileComponents();

      fixture = TestBed.createComponent(FormErrorSummaryComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should NOT render errors when hasSubmitted is false and showBeforeSubmit is false', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('ul')).toBeNull();
    });

    it('should render error list after submit when controls have errors', () => {
      mockFormGroupDirective.ngSubmit.emit();
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      const items = el.querySelectorAll('li.error');
      expect(items.length).toBeGreaterThan(0);
    });

    it('should render the correct number of error messages', () => {
      mockFormGroupDirective.ngSubmit.emit();
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      const items = el.querySelectorAll('li.error');
      expect(items.length).toBe(component.errorMessages().length);
    });

    it('should render errors when showBeforeSubmit is true and controls have errors', () => {
      fixture.componentRef.setInput('showBeforeSubmit', true);
      // Trigger change detection and value change
      formGroup.get('name')?.updateValueAndValidity();
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      const items = el.querySelectorAll('li.error');
      expect(items.length).toBeGreaterThan(0);
    });

    it('should NOT render errors when there are no validation errors', () => {
      // Set valid values
      formGroup.get('name')?.setValue('John');
      mockFormGroupDirective.ngSubmit.emit();
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('ul')).toBeNull();
    });
  });
});
