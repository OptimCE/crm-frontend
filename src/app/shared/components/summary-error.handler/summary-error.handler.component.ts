import { Component, DestroyRef, ElementRef, inject, input, OnInit, signal } from '@angular/core';
import { FormGroupDirective } from '@angular/forms';
import { merge } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ErrorHandlerParams, ErrorSummaryAdded } from '../../types/error.types';

@Component({
  selector: 'app-summary-error',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './summary-error.handler.component.html',
  styleUrl: './summary-error.handler.component.css',
})
export class FormErrorSummaryComponent implements OnInit {
  private formGroupDirective = inject(FormGroupDirective);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly errorMessages = signal<string[]>([]);

  readonly errorsAdd = input<ErrorSummaryAdded>({});
  readonly controlLabels = input<Record<string, string>>({});
  readonly showBeforeSubmit = input<boolean>(false);
  readonly hasSubmitted = signal<boolean>(false);

  defaultErrors: ErrorSummaryAdded = {};

  ngOnInit(): void {
    this.loadDefaultErrorMessages();
    const form = this.formGroupDirective?.control;
    if (!form) return;
    this.formGroupDirective.ngSubmit.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.hasSubmitted.set(true);
      this.collectErrors();
    });
    merge(form.valueChanges, form.statusChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.hasSubmitted() || this.showBeforeSubmit()) {
          this.collectErrors();
        }
      });
  }

  private loadDefaultErrorMessages(): void {
    this.translate
      .stream(['FORM_ERROR.REQUIRED_FIELD', 'FORM_ERROR.INVALID_EMAIL', 'FORM_ERROR.MIN_LENGTH'])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.defaultErrors = {
          required: (_: ErrorHandlerParams, controlName: string, displayName?: string) => {
            return this.translate.instant('FORM_ERROR.REQUIRED_FIELD', {
              controlName: displayName ?? controlName,
            }) as string;
          },

          minlength: (params: ErrorHandlerParams, controlName: string, displayName?: string) => {
            const requiredLength = params['requiredLength'] as number;
            const actualLength = params['actualLength'] as number;
            return this.translate.instant('FORM_ERROR.MIN_LENGTH', {
              controlName: displayName ?? controlName,
              requiredLength,
              actualLength,
            }) as string;
          },

          email: (_: ErrorHandlerParams, controlName: string, displayName?: string) => {
            return this.translate.instant('FORM_ERROR.INVALID_EMAIL', {
              controlName: displayName ?? controlName,
            }) as string;
          },
        };

        this.collectErrors();
      });
  }

  private collectErrors(): void {
    const errors: string[] = [];
    const form = this.formGroupDirective.control;

    if (!this.hasSubmitted() && !this.showBeforeSubmit()) {
      this.errorMessages.set([]);
      return;
    }

    Object.keys(form.controls).forEach((controlName) => {
      const control = form.get(controlName);
      const controlErrors = control?.errors;
      if (!controlErrors) return;
      const displayName = this.getDisplayName(controlName);

      if (control?.errors) {
        Object.keys(control.errors).forEach((errorKey) => {
          const builders = { ...this.defaultErrors, ...this.errorsAdd() };
          const build = builders[errorKey];

          if (build) {
            errors.push(
              build(controlErrors[errorKey] as ErrorHandlerParams, controlName, displayName),
            );
          } else {
            errors.push(this.fallbackUnknownError(displayName));
          }
        });
      }
    });
    this.errorMessages.set(errors);
  }
  private getDisplayName(controlName: string): string {
    // 1) If provided via input and exists as a translate key, translate it.
    const fromInput = this.controlLabels()[controlName];
    if (fromInput) {
      // If it looks like a i18n key, translate; otherwise treat as literal label.
      const translated = this.translate.instant(fromInput) as string;
      if (translated !== fromInput) return translated;
      return fromInput;
    }

    // 2) Try to find a <label for="..."> inside the same <form>.
    const formEl = this.host.nativeElement.closest('form');
    if (formEl) {
      // We try both id==controlName and [formcontrolname]==controlName to find a matching input id.
      const labelViaFor = formEl.querySelector(`label[for="${controlName}"]`);
      if (labelViaFor?.textContent?.trim()) return labelViaFor.textContent.trim();

      // Find the control element to get its id, then find a label[for=id].
      const controlEl = formEl.querySelector(`[formControlName="${controlName}"]`);
      const id = controlEl?.getAttribute('id');
      if (id) {
        const labelViaId = formEl.querySelector(`label[for="${id}"]`);
        if (labelViaId?.textContent?.trim()) return labelViaId.textContent.trim();
      }

      // Fallback: use placeholder if present
      const withPlaceholder = controlEl?.getAttribute('placeholder');
      if (withPlaceholder) return withPlaceholder;
    }

    // 3) Last resort: prettify the controlName (emailAddress -> “Email address”)
    return this.prettify(controlName);
  }

  private prettify(name: string): string {
    // split camelCase / snake_case / kebab-case and capitalize first letter
    const spaced = name
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[-_]/g, ' ')
      .toLowerCase();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }

  private fallbackUnknownError(displayName: string) {
    // You can i18n this if you want:
    return (
      (this.translate.instant('FORM_ERROR.UNKNOWN_ERROR', {
        controlName: displayName,
      }) as string) || `Erreur inconnue sur "${displayName}".`
    );
  }
}
