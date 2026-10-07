import { FormControl } from '@angular/forms';
import { normalizeNumRegistreBe, numRegistreBeValidator } from './num_registre_nat_be.validator';

describe('numRegistreBeValidator', () => {
  const validator = numRegistreBeValidator();

  it('should return null for empty value', () => {
    expect(validator(new FormControl(''))).toBeNull();
  });

  it('should return null for null value', () => {
    expect(validator(new FormControl(null))).toBeNull();
  });

  it('should return null for the dotted form printed on the eID card', () => {
    expect(validator(new FormControl('85.07.30-033.28'))).toBeNull();
  });

  // What the wizard's placeholder used to suggest: digits only.
  it('should return null for the 11 bare digits', () => {
    expect(validator(new FormControl('85073003328'))).toBeNull();
  });

  it('should return null for digits grouped with spaces, dots or dashes', () => {
    expect(validator(new FormControl('85 07 30 033 28'))).toBeNull();
    expect(validator(new FormControl('850730-033-28'))).toBeNull();
    expect(validator(new FormControl('  85.07.30-033.28  '))).toBeNull();
  });

  // The old placeholder itself.
  it('should return invalidNumReg error for 9 digits', () => {
    expect(validator(new FormControl('123456789'))).toEqual({ invalidNumReg: true });
  });

  it('should return invalidNumReg error for 10 or 12 digits', () => {
    expect(validator(new FormControl('8507300332'))).toEqual({ invalidNumReg: true });
    expect(validator(new FormControl('850730033281'))).toEqual({ invalidNumReg: true });
  });

  it('should return invalidNumReg error for an impossible month or day', () => {
    expect(validator(new FormControl('85.13.30-033.28'))).toEqual({ invalidNumReg: true });
    expect(validator(new FormControl('85.07.32-033.28'))).toEqual({ invalidNumReg: true });
    expect(validator(new FormControl('85130003328'))).toEqual({ invalidNumReg: true });
  });

  it('should return invalidNumReg error for letters or other separators', () => {
    expect(validator(new FormControl('85.07.30-O33.28'))).toEqual({ invalidNumReg: true });
    expect(validator(new FormControl('85/07/30-033.28'))).toEqual({ invalidNumReg: true });
  });

  it('should return invalidNumReg error for a value that is not text', () => {
    expect(validator(new FormControl(85073003328))).toEqual({ invalidNumReg: true });
  });
});

describe('normalizeNumRegistreBe', () => {
  it('writes every accepted spelling in the dotted form', () => {
    for (const typed of ['85073003328', '85 07 30 033 28', '850730-033-28', ' 85.07.30-033.28 ']) {
      expect(normalizeNumRegistreBe(typed)).toBe('85.07.30-033.28');
    }
  });

  it('keeps the dotted form as it is', () => {
    expect(normalizeNumRegistreBe('85.07.30-033.28')).toBe('85.07.30-033.28');
  });

  // Nothing is lost: the validator, not this function, is what rejects it.
  it('returns a value the validator rejects unchanged', () => {
    expect(normalizeNumRegistreBe('123456789')).toBe('123456789');
    expect(normalizeNumRegistreBe('BE0123456789')).toBe('BE0123456789');
    expect(normalizeNumRegistreBe('')).toBe('');
  });
});
