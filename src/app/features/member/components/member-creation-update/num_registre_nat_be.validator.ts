import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// YY MM DD, a 3-digit serial and 2 check digits, once spaces, dots and dashes
// are taken out. The checksum itself is not verified.
const NUM_REG_DIGITS = /^([0-9]{2})(0[1-9]|1[0-2])(0[1-9]|[1-2][0-9]|3[0-1])([0-9]{3})([0-9]{2})$/;

function dottedNumRegistreBe(value: string): string | null {
  const parts = NUM_REG_DIGITS.exec(value.replace(/[\s.-]/g, ''));
  return parts ? `${parts[1]}.${parts[2]}.${parts[3]}-${parts[4]}.${parts[5]}` : null;
}

/**
 * A Belgian national register number written as the eID card prints it,
 * `YY.MM.DD-SSS.CC` (e.g. `85.07.30-033.28`), whether it was typed that way, as
 * the 11 bare digits or grouped with spaces. Any other value comes back
 * unchanged: rejecting it is `numRegistreBeValidator`'s job.
 */
export function normalizeNumRegistreBe(value: string): string {
  return dottedNumRegistreBe(value) ?? value;
}

/**
 * Accepts every spelling `normalizeNumRegistreBe` understands, so save the
 * value through it.
 */
export function numRegistreBeValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) {
      return null; // No value means no validation error
    }

    if (typeof control.value !== 'string') {
      return { invalidNumReg: true };
    }

    return dottedNumRegistreBe(control.value) ? null : { invalidNumReg: true };
  };
}
