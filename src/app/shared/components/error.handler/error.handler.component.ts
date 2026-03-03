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
  @Input() errorsAdd: ErrorAdded = {};

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
              const errorParams = (controlErrors[firstKey] || {}) as ErrorHandlerParams;
              const text =
                (this.customErrors?.[firstKey] as string | undefined) || getError(errorParams);

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
              ? (this.translate.instant('FORM_ERROR.min_length', {
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
    this.message$.next(text);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
