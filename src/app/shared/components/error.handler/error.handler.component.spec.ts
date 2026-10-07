import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  FormGroupDirective,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { ErrorHandlerComponent } from './error.handler.component';

function nrnGroup(nrn: string): FormGroup {
  return new FormGroup({ nrn: new FormControl(nrn, Validators.required) });
}

/** A parent that can hand its form a new group, as the member wizards do. */
@Component({
  selector: 'app-swapping-field-host',
  imports: [ReactiveFormsModule, ErrorHandlerComponent],
  template: `
    <form [formGroup]="group()">
      <input formControlName="nrn" />
      <app-error-handler controlName="nrn" />
    </form>
  `,
})
class SwappingFieldHost {
  readonly group = signal<FormGroup>(nrnGroup(''));
}

describe('ErrorHandlerComponent', () => {
  let component: ErrorHandlerComponent;
  let fixture: ComponentFixture<ErrorHandlerComponent>;
  let mockFormGroupDirective: FormGroupDirective;
  let formGroup: FormGroup;

  async function setupComponent(
    controlName: string = 'test',
    controls: Record<string, FormControl> = { test: new FormControl('') },
  ): Promise<void> {
    formGroup = new FormGroup(controls);
    mockFormGroupDirective = new FormGroupDirective([], []);
    mockFormGroupDirective.form = formGroup;

    await TestBed.configureTestingModule({
      imports: [ErrorHandlerComponent, TranslateModule.forRoot()],
      providers: [{ provide: FormGroupDirective, useValue: mockFormGroupDirective }],
    }).compileComponents();

    fixture = TestBed.createComponent(ErrorHandlerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('controlName', controlName);
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should create', async () => {
    await setupComponent();
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should load default error messages on init', async () => {
    await setupComponent();

    const translateService = TestBed.inject(TranslateService);
    vi.spyOn(translateService, 'get').mockReturnValue(
      of({
        'FORM_ERROR.REQUIRED_FIELD': 'Field is required',
        'FORM_ERROR.INVALID_EMAIL': 'Invalid email',
        'FORM_ERROR.MIN_LENGTH': 'Too short',
      }),
    );

    fixture.detectChanges();

    expect(component.errors['required']).toBeDefined();
    expect(component.errors['email']).toBeDefined();
    expect(component.errors['minlength']).toBeDefined();
  });

  it('should display required error when control has required validator', async () => {
    await setupComponent('test', {
      test: new FormControl('', [Validators.required]),
    });
    fixture.detectChanges();

    const control = formGroup.get('test');
    control?.setValue('');
    control?.markAsTouched();
    fixture.detectChanges();

    expect(component.message()).toBeTruthy();
  });

  it('should display email error when control has email validator', async () => {
    await setupComponent('test', {
      test: new FormControl('', [Validators.email]),
    });
    fixture.detectChanges();

    const control = formGroup.get('test');
    control?.setValue('not-an-email');
    fixture.detectChanges();

    expect(component.message()).toBeTruthy();
  });

  it('should display minlength error with params', async () => {
    await setupComponent('test', {
      test: new FormControl('', [Validators.minLength(5)]),
    });
    fixture.detectChanges();

    const control = formGroup.get('test');
    control?.setValue('ab');
    fixture.detectChanges();

    expect(component.message()).toBeTruthy();
  });

  it('renders the minlength sentence with its numbers, never a raw key', async () => {
    // The handler asked for 'FORM_ERROR.min_length' - wrong case, a key that
    // exists in no locale - so every "too short" error showed that raw path.
    // `toBeTruthy()` above cannot tell a sentence from a key.
    await setupComponent('test', {
      test: new FormControl('', [Validators.minLength(5)]),
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      FORM_ERROR: {
        MIN_LENGTH: 'At least {{ requiredLength }} characters (now {{ actualLength }}).',
      },
    });
    translate.use('en');
    fixture.detectChanges();

    formGroup.get('test')?.setValue('ab');
    fixture.detectChanges();

    expect(component.message()).toBe('At least 5 characters (now 2).');
  });

  it('should clear error when control becomes valid', async () => {
    await setupComponent('test', {
      test: new FormControl('', [Validators.required]),
    });
    fixture.detectChanges();

    const control = formGroup.get('test');
    control?.setValue('');
    fixture.detectChanges();
    expect(component.message()).toBeTruthy();

    control?.setValue('valid value');
    fixture.detectChanges();
    expect(component.message()).toBe('');
  });

  it('should use customErrors input when provided', async () => {
    await setupComponent('test', {
      test: new FormControl('', [Validators.required]),
    });
    fixture.componentRef.setInput('customErrors', {
      required: 'Custom required message',
    });
    fixture.detectChanges();

    const control = formGroup.get('test');
    control?.setValue('');
    fixture.detectChanges();

    expect(component.message()).toBe('Custom required message');
  });

  it('should use errorsAdd input for additional error types', async () => {
    const customValidator = (control: AbstractControl): ValidationErrors | null => {
      return control.value === 'bad' ? { customValidator: true } : null;
    };

    await setupComponent('test', {
      test: new FormControl('', [customValidator]),
    });
    fixture.componentRef.setInput('errorsAdd', {
      customValidator: () => 'Custom validator error',
    });
    fixture.detectChanges();

    const control = formGroup.get('test');
    control?.setValue('bad');
    fixture.detectChanges();

    expect(component.message()).toBe('Custom validator error');
  });

  it('should log console error when controlName is not found in form group', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await setupComponent('nonExistentControl', {
      test: new FormControl(''),
    });
    fixture.detectChanges();

    expect(consoleSpy).toHaveBeenCalledWith(
      'Control "nonExistentControl" not found in the form group.',
    );

    consoleSpy.mockRestore();
  });

  it('should show error div in template only when message is non-empty', async () => {
    await setupComponent('test', {
      test: new FormControl('', [Validators.required]),
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    const control = formGroup.get('test');
    control?.setValue('valid');
    fixture.detectChanges();
    expect(compiled.querySelector('.error')).toBeNull();

    control?.setValue('');
    fixture.detectChanges();
    expect(compiled.querySelector('.error')).toBeTruthy();
  });

  it('should respond to form submit (ngSubmit)', async () => {
    await setupComponent('test', {
      test: new FormControl('', [Validators.required]),
    });
    fixture.detectChanges();

    mockFormGroupDirective.ngSubmit.emit();
    fixture.detectChanges();

    expect(component.message()).toBeTruthy();
  });

  it('should display the error message text in the template', async () => {
    await setupComponent('test', {
      test: new FormControl('', [Validators.required]),
    });
    fixture.componentRef.setInput('customErrors', {
      required: 'This field is mandatory',
    });
    fixture.detectChanges();

    const control = formGroup.get('test');
    control?.setValue('');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const errorDiv = compiled.querySelector('.error');
    expect(errorDiv?.textContent?.trim()).toBe('This field is mandatory');
  });

  it('should only show the first error key when multiple errors exist', async () => {
    await setupComponent('test', {
      test: new FormControl('', [Validators.required, Validators.minLength(5)]),
    });
    fixture.componentRef.setInput('customErrors', {
      required: 'Required error',
      minlength: 'Min length error',
    });
    fixture.detectChanges();

    const control = formGroup.get('test');
    control?.setValue('');
    fixture.detectChanges();

    // Should show only the first error (required comes before minlength)
    expect(component.message()).toBe('Required error');
  });

  // `[formGroup]` can be handed a new group while the field stays on screen:
  // the member wizards rebuild theirs whenever the member type changes. The
  // handler notices during the check of its parent's view, so this needs a real
  // parent re-binding a real FormGroupDirective.
  describe('a FormGroup swapped into the directive', () => {
    const VALID_NRN = '85.07.30-033.28';
    let host: ComponentFixture<SwappingFieldHost>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [SwappingFieldHost, TranslateModule.forRoot()],
      }).compileComponents();
      const translate = TestBed.inject(TranslateService);
      translate.setTranslation('en', { FORM_ERROR: { REQUIRED_FIELD: 'Required' } });
      translate.use('en');
      host = TestBed.createComponent(SwappingFieldHost);
      host.detectChanges();
    });

    function shown(): string {
      const message = (host.nativeElement as HTMLElement).querySelector(
        '[data-testid="error-handler__message--error"]',
      );
      return message?.textContent?.trim() ?? '';
    }

    function submit(): void {
      (host.nativeElement as HTMLElement).querySelector('form')?.dispatchEvent(new Event('submit'));
      host.detectChanges();
    }

    function swapIn(group: FormGroup): void {
      host.componentInstance.group.set(group);
      host.detectChanges();
    }

    function typeNrn(value: string): void {
      const input = (host.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      host.detectChanges();
    }

    function isObserved(changes: unknown): boolean {
      return (changes as { observed: boolean }).observed;
    }

    it('reads a message on screen again from the control that replaced it', () => {
      submit();
      expect(shown()).toBe('Required');

      swapIn(nrnGroup(VALID_NRN));

      expect(shown()).toBe('');
    });

    it('clears the message once the field is filled in on the new control', () => {
      submit();
      swapIn(nrnGroup(''));
      // The new control is empty too.
      expect(shown()).toBe('Required');

      typeNrn(VALID_NRN);

      expect(shown()).toBe('');
    });

    it('keeps a blank field blank, and checks the new control on submit', () => {
      typeNrn(VALID_NRN);
      swapIn(nrnGroup(''));
      // Nothing was on screen, so the swap alone shows nothing.
      expect(shown()).toBe('');

      submit();

      expect(shown()).toBe('Required');
    });

    it('shows nothing under a field filled in on the new control when the form is submitted', () => {
      swapIn(nrnGroup(''));
      typeNrn(VALID_NRN);

      submit();

      expect(shown()).toBe('');
    });

    it('stops listening to the control it replaced', () => {
      const replaced = host.componentInstance.group().controls['nrn'];
      expect(isObserved(replaced.valueChanges)).toBe(true);

      swapIn(nrnGroup(''));

      expect(isObserved(replaced.valueChanges)).toBe(false);
    });

    it('clears its message when the new group has no such control', () => {
      submit();
      expect(shown()).toBe('Required');

      swapIn(new FormGroup({ nrn_manager: new FormControl('', Validators.required) }));

      expect(shown()).toBe('');
    });
  });

  // Production builds skip the NG01052 check, so a step panel that PrimeNG
  // creates before its form exists leaves the directive without a group.
  describe('a directive that has no group yet', () => {
    it('waits for the group and follows its control once it arrives', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      await setupComponent('test');
      mockFormGroupDirective.form = null as unknown as FormGroup;
      fixture.detectChanges();
      expect(consoleSpy).toHaveBeenCalledWith('Control "test" not found in the form group.');

      const group = new FormGroup({ test: new FormControl('ok', Validators.required) });
      mockFormGroupDirective.form = group;
      // Stands in for the check of the parent's view that follows a re-bind.
      fixture.componentRef.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      group.get('test')?.setValue('');
      expect(component.message()).toBeTruthy();

      group.get('test')?.setValue('Jean');
      expect(component.message()).toBe('');
      // Reported once, when the field was created, not at every check.
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });
  });
});
