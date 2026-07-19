import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validates an IBAN per ISO 13616: structural check plus the mod-97 checksum.
 *
 * Country-agnostic — accepts valid IBANs from Belgium and every other IBAN
 * country. (It replaces an earlier per-country regex validator that wrongly
 * rejected valid 16-char Belgian IBANs; the member and community modules both
 * use this checksum-based validator.)
 *
 * An empty value is treated as valid; pair with `Validators.required` when the
 * field is mandatory. On failure the error key is `invalidIban`, matching the
 * template's existing error handling.
 */
export function ibanValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw: unknown = control.value;
    if (raw === null || raw === undefined || raw === '') {
      return null;
    }
    if (typeof raw !== 'string') {
      return { invalidIban: true };
    }

    const iban = raw.replace(/\s+/g, '').toUpperCase();
    // 2-letter country code + 2 check digits + 11..30 alphanumerics.
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) {
      return { invalidIban: true };
    }

    // Move the first four characters to the end, map letters to numbers
    // (A=10 … Z=35), then take mod 97 iteratively. A valid IBAN yields 1.
    const rearranged = iban.slice(4) + iban.slice(0, 4);
    let remainder = 0;
    for (const ch of rearranged) {
      const mapped = ch >= 'A' && ch <= 'Z' ? (ch.charCodeAt(0) - 55).toString() : ch;
      for (const digit of mapped) {
        remainder = (remainder * 10 + (digit.charCodeAt(0) - 48)) % 97;
      }
    }

    return remainder === 1 ? null : { invalidIban: true };
  };
}
