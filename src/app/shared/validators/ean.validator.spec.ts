import { FormControl } from '@angular/forms';
import { EAN_PATTERN, eanValidator } from './ean.validator';

describe('eanValidator', () => {
  const validator = eanValidator();

  it('should return null for empty value', () => {
    const ctrl = new FormControl('');
    expect(validator(ctrl)).toBeNull();
  });

  it('should return null for null value', () => {
    const ctrl = new FormControl(null);
    expect(validator(ctrl)).toBeNull();
  });

  it('should return null for a valid 18-digit EAN', () => {
    const ctrl = new FormControl('541448200000000001');
    expect(validator(ctrl)).toBeNull();
  });

  it('should return invalidEan error for non-numeric EAN', () => {
    const ctrl = new FormControl('12345678901234567A');
    expect(validator(ctrl)).toEqual({ invalidEan: true });
  });

  it('should return invalidEan error for EAN with wrong length', () => {
    const ctrl = new FormControl('12345');
    expect(validator(ctrl)).toEqual({ invalidEan: true });
  });

  it('should return invalidEan error for EAN with 17 digits', () => {
    const ctrl = new FormControl('54144820000000001');
    expect(validator(ctrl)).toEqual({ invalidEan: true });
  });

  // The rule this whole change exists to make true: 13 digits was never an EAN.
  it('should return invalidEan error for a 13-digit EAN', () => {
    const ctrl = new FormControl('1234567890123');
    expect(validator(ctrl)).toEqual({ invalidEan: true });
  });

  it('should return invalidEan error for EAN with 19 digits', () => {
    const ctrl = new FormControl('5414482000000000011');
    expect(validator(ctrl)).toEqual({ invalidEan: true });
  });

  it('should trim whitespace and validate', () => {
    const ctrl = new FormControl('  541448200000000001  ');
    expect(validator(ctrl)).toBeNull();
  });
});

describe('EAN_PATTERN', () => {
  // Exported and used directly by administrative-document-warnings to gate a
  // routerLink, so it is asserted here rather than only through the validator.
  it('accepts exactly 18 digits', () => {
    expect(EAN_PATTERN.test('541448200000000001')).toBe(true);
  });

  it('rejects 13 digits, 17, 19 and non-digits', () => {
    expect(EAN_PATTERN.test('1234567890123')).toBe(false);
    expect(EAN_PATTERN.test('54144820000000001')).toBe(false);
    expect(EAN_PATTERN.test('5414482000000000011')).toBe(false);
    expect(EAN_PATTERN.test('12345678901234567A')).toBe(false);
  });

  it('does not trim on its own — callers must', () => {
    expect(EAN_PATTERN.test(' 541448200000000001 ')).toBe(false);
  });
});
