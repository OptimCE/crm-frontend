import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function eanValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string | null | undefined;
    if (!value) {
      return null; // No value means no validation error
    }

    const ean = /^[0-9]{13}$/;
    const isValid = ean.test(value.trim());

    return isValid ? null : { invalidEan: true };
  };
}
