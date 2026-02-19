import { Component, inject, Input, OnDestroy, OnInit } from '@angular/core';
import { BehaviorSubject, distinctUntilChanged, merge, Subscription } from 'rxjs';
import { FormGroupDirective, ValidationErrors } from '@angular/forms';
import { AsyncPipe } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { ErrorAdded, ErrorHandlerParams } from '../../types/error.types';

@Component({
  selector: 'app-error-handler',
  standalone: true,
  imports: [AsyncPipe],
  templateUrl: './error.handler.component.html',
  styleUrl: './error.handler.component.css',
})
export class ErrorHandlerComponent implements OnInit, OnDestroy {
  private subscription = new Subscription();
  private formGroupDirective = inject(FormGroupDirective);
  private translate = inject(TranslateService);

  @Input() controlName!: string;
  @Input() customErrors?: ValidationErrors;
  @Input() errorsAdd: ErrorHandlerParams = {};

  message$ = new BehaviorSubject<string>('');

  errors: ErrorAdded = {};

  ngOnInit(): void {
    this.loadDefaultErrorMessages();

    if (this.formGroupDirective) {
      const control = this.formGroupDirective.control.get(this.controlName);
      if (control) {
        this.subscription = merge(control.valueChanges, this.formGroupDirective.ngSubmit)
          .pipe(distinctUntilChanged())
          .subscribe(() => {
            const controlErrors = control.errors;

            if (controlErrors) {
              this.errors = { ...this.errors, ...this.errorsAdd }; // Merge default & additional errors

              const firstKey = Object.keys(controlErrors)[0];
              const getError = this.errors[firstKey];
              const text = this.customErrors?.[firstKey] || getError(controlErrors[firstKey]);

              this.setError(text);
            } else {
              this.setError('');
            }
          });
      } else {
        console.error(`Control "${this.controlName}" not found in the form group.`);
      }
    } else {
      console.error(`ErrorHandlerComponent must be used within a FormGroupDirective.`);
    }
  }

  private loadDefaultErrorMessages() {
    this.translate
      .get(['form_error.required_field', 'form_error.invalid_email', 'form_error.min_length'])
      .subscribe((translations) => {
        this.errors = {
          required: () => translations['form_error.required_field'] || 'Ce champ est obligatoire',
          minlength: ({ requiredLength, actualLength }: any) =>
            translations['form_error.min_length']
              ? this.translate.instant('form_error.min_length', { requiredLength, actualLength })
              : `Ce champ doit contenir au moins ${requiredLength} caractères (actuellement ${actualLength}).`,
          email: () => translations['form_error.invalid_email'] || 'Adresse email invalide',
        };
      });
  }

  private setError(text: string) {
    this.message$.next(text);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
