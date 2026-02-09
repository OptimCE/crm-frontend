import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function eanValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) {
      return null; // No value means no validation error
    }

    const ean = /^[0-9]{13}$/;
    const isValid = ean.test(control.value.trim());

    return isValid ? null : { invalidEan: true };
  };
}
