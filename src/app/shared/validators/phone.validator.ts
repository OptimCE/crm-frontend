import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Plausible phone number: 8 to 15 digits (the E.164 maximum), an optional
 * leading `+`, and the separators people type in Belgium — spaces, dots,
 * slashes, dashes and brackets (`+32 470 12 34 56`, `04/123.45.67`).
 *
 * The backend validates the community's public contact with the SAME
 * expression (`crm-backend/src/modules/communities/shared/public-contact.ts`):
 * keep them identical, or the form accepts what the API then refuses.
 */
export const PUBLIC_PHONE_PATTERN = /^\+?(?:[\s./()-]*\d){8,15}[\s./()-]*$/;

/**
 * Validates a phone number against {@link PUBLIC_PHONE_PATTERN}.
 *
 * An empty value is treated as valid; pair with `Validators.required` when the
 * field is mandatory. On failure the error key is `invalidPhone`.
 */
export function phoneValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw: unknown = control.value;
    if (raw === null || raw === undefined || raw === '') {
      return null;
    }
    if (typeof raw !== 'string') {
      return { invalidPhone: true };
    }
    return PUBLIC_PHONE_PATTERN.test(raw.trim()) ? null : { invalidPhone: true };
  };
}
