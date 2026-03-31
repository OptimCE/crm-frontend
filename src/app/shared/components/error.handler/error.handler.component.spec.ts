import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  FormGroupDirective,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { ErrorHandlerComponent } from './error.handler.component';

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
});
