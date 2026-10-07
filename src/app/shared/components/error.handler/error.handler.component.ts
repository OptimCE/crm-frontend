import { Component, DestroyRef, DoCheck, inject, input, OnInit, signal } from '@angular/core';
import { distinctUntilChanged, merge, Subscription } from 'rxjs';
import { AbstractControl, FormGroupDirective, ValidationErrors } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { ErrorAdded, ErrorHandlerParams } from '../../types/error.types';

@Component({
  selector: 'app-error-handler',
  templateUrl: './error.handler.component.html',
  styleUrl: './error.handler.component.css',
})
export class ErrorHandlerComponent implements OnInit, DoCheck {
  private destroyRef = inject(DestroyRef);
  private formGroupDirective = inject(FormGroupDirective);
  private translate = inject(TranslateService);

  readonly controlName = input.required<string>();
  readonly customErrors = input<ValidationErrors>();
  readonly errorsAdd = input<ErrorAdded>({});

  readonly message = signal<string>('');

  errors: ErrorAdded = {};

  /** The control whose errors are shown, and the subscription to its changes. */
  private watchedControl: AbstractControl | null = null;
  private controlChanges?: Subscription;

  ngOnInit(): void {
    this.loadDefaultErrorMessages();

    if (this.formGroupDirective) {
      this.destroyRef.onDestroy(() => this.controlChanges?.unsubscribe());
      this.watchControl();
      if (!this.watchedControl) {
        console.error(`Control "${this.controlName()}" not found in the form group.`);
      }
    } else {
      console.error(`ErrorHandlerComponent must be used within a FormGroupDirective.`);
    }
  }

  ngDoCheck(): void {
    this.watchControl();
  }

  /**
   * Follow the control named `controlName` in the group `[formGroup]` holds now.
   *
   * The host can hand the directive a new group while this field stays on
   * screen: the member wizards rebuild theirs whenever the member type changes,
   * and keep the manager's fields when an individual with a guardian becomes a
   * company. Angular moves the inputs over to the new controls, but nothing
   * tells this component, which used to keep showing the discarded control's
   * errors, even under a field filled in since.
   */
  private watchControl(): void {
    const control = this.formGroupDirective?.control?.get(this.controlName()) ?? null;
    if (control === this.watchedControl) return;
    this.controlChanges?.unsubscribe();
    this.watchedControl = control;
    this.controlChanges = control
      ? merge(control.valueChanges, this.formGroupDirective.ngSubmit)
          .pipe(distinctUntilChanged())
          .subscribe(() => this.showErrorsOf(control))
      : undefined;
    // A message on screen was about the replaced control: read it again from this
    // one. A blank field stays blank until it changes or the form is submitted.
    if (this.message()) {
      this.showErrorsOf(control);
    }
  }

  private showErrorsOf(control: AbstractControl | null): void {
    const controlErrors = control?.errors;

    if (controlErrors) {
      this.errors = { ...this.errors, ...this.errorsAdd() }; // Merge default & additional errors

      const firstKey = Object.keys(controlErrors)[0];
      const getError = this.errors[firstKey];
      const errorParams = (controlErrors[firstKey] || {}) as ErrorHandlerParams;
      const text = (this.customErrors()?.[firstKey] as string | undefined) || getError(errorParams);

      this.setError(text);
    } else {
      this.setError('');
    }
  }

  private loadDefaultErrorMessages(): void {
    this.translate
      .get(['FORM_ERROR.REQUIRED_FIELD', 'FORM_ERROR.INVALID_EMAIL', 'FORM_ERROR.MIN_LENGTH'])
      .subscribe((translations: Record<string, string>) => {
        this.errors = {
          required: () => translations['FORM_ERROR.REQUIRED_FIELD'] || 'Ce champ est obligatoire',
          minlength: (params: ErrorHandlerParams) => {
            const requiredLength = params['requiredLength'] as number;
            const actualLength = params['actualLength'] as number;
            return translations['FORM_ERROR.MIN_LENGTH']
              ? (this.translate.instant('FORM_ERROR.MIN_LENGTH', {
                  requiredLength,
                  actualLength,
                }) as string)
              : `Ce champ doit contenir au moins ${requiredLength} caractères (actuellement ${actualLength}).`;
          },
          email: () => translations['FORM_ERROR.INVALID_EMAIL'] || 'Adresse email invalide',
        };
      });
  }

  private setError(text: string) {
    this.message.set(text);
  }
}
