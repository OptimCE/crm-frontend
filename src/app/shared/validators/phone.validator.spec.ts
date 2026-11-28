import { FormControl } from '@angular/forms';
import { phoneValidator } from './phone.validator';

function errorsFor(value: unknown): unknown {
  return phoneValidator()(new FormControl(value));
}

describe('phoneValidator', () => {
  it.each(['', null, undefined])('treats %o as valid (pair with required)', (value) => {
    expect(errorsFor(value)).toBeNull();
  });

  it.each([
    '+32 470 12 34 56',
    '0470 12 34 56',
    '04/123.45.67',
    '+32 (0)2 123 45 67',
    ' 081-22-33-44 ',
  ])('accepts %s', (value) => {
    expect(errorsFor(value)).toBeNull();
  });

  it.each([
    ['too few digits', '1234567'],
    ['more than 15 digits', '+32 470 12 34 56 78 90 12'],
    ['letters', 'appelez-nous'],
    ['a plus sign inside', '02+123 45 67'],
    ['not a string', 470123456],
  ])('refuses %s', (_label, value) => {
    expect(errorsFor(value)).toEqual({ invalidPhone: true });
  });
});
