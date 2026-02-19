import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function numRegistreBeValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) {
      return null; // No value means no validation error
    }

    const numRegRegex =
      /^[0-9]{2}\.(0[1-9]|1[0-2])\.(0[1-9]|[1-2][0-9]|3[0-1])-[0-9]{3}\.[0-9]{2}$/gm;
    const isValid = numRegRegex.test(control.value.trim());

    return isValid ? null : { invalidNumReg: true };
  };
}
