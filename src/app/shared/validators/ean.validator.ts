import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * An EAN is exactly 18 digits.
 *
 * It is the Belgian DSO's connection identifier and the primary key of a meter
 * everywhere in the platform. Belgian energy EANs start `54144x`, but that
 * prefix is deliberately NOT required here: it is a convention of the issuing
 * DSOs, not part of what makes a string an EAN, and every functional fixture in
 * crm-backend uses a non-54 EAN.
 *
 * No GS1 mod-10 check digit either. `541448200000000001` — the EAN the dev
 * seed, the e2e specs and the RESA test workbooks are all built on — fails
 * mod-10 (its check digit would be 8), so a checksum here would reject the
 * platform's own data.
 *
 * Exported because it is used twice: as a form validator on the meter-creation
 * dialog, and as a guard on a server-supplied EAN heading into a `routerLink`
 * (`features/administrative_document/administrative-document-warnings.ts`).
 */
export const EAN_PATTERN = /^[0-9]{18}$/;

/**
 * Rejects anything that is not an 18-digit EAN, after trimming.
 *
 * An empty value is treated as valid; pair with `Validators.required` when the
 * field is mandatory. On failure the error key is `invalidEan`, which the
 * template must map through `[customErrors]` — `app-error-handler` has no
 * built-in message for it and throws on an unmapped key.
 *
 * Note this trims before testing, so the control accepts a pasted value with
 * surrounding whitespace. Callers must trim before sending, and crm-backend
 * normalises again on the DTO — see `modules/meters/shared/ean.ts` there.
 */
export function eanValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string | null | undefined;
    if (!value) {
      return null; // No value means no validation error
    }

    return EAN_PATTERN.test(value.trim()) ? null : { invalidEan: true };
  };
}
