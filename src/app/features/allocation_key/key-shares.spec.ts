import { formatShare, sumsToOne } from './key-shares';

describe('sumsToOne', () => {
  it('accepts 70 % + 20 % + 10 %, which floating point adds up to just under 1', () => {
    const sum = 0.7 + 0.2 + 0.1;
    // The case the strict `sum !== 1` check rejected.
    expect(sum).not.toBe(1);
    expect(sumsToOne(sum)).toBe(true);
  });

  it('accepts exactly 1', () => {
    expect(sumsToOne(1)).toBe(true);
  });

  it('accepts the same 0.999 – 1.001 band as the backend', () => {
    expect(sumsToOne(0.999)).toBe(true);
    expect(sumsToOne(1.001)).toBe(true);
  });

  it('rejects sums outside that band', () => {
    expect(sumsToOne(0.998)).toBe(false);
    expect(sumsToOne(1.002)).toBe(false);
    expect(sumsToOne(0.6)).toBe(false);
  });
});

describe('formatShare', () => {
  it('shows whole percentages without floating-point noise', () => {
    // 0.07 * 100 is 7.000000000000001, 0.29 * 100 is 28.999999999999996.
    expect(formatShare(0.07)).toBe('7%');
    expect(formatShare(0.29)).toBe('29%');
    expect(formatShare(0.57)).toBe('57%');
    expect(formatShare(0.5)).toBe('50%');
    expect(formatShare(1)).toBe('100%');
    expect(formatShare(0)).toBe('0%');
  });

  it('keeps the decimals a user typed, with a dot the grid can parse back', () => {
    expect(formatShare(0.3333)).toBe('33.33%');
    expect(formatShare(0.33333)).toBe('33.333%');
  });

  it('rounds an equal split to four decimals', () => {
    expect(formatShare(1 / 7)).toBe('14.2857%');
  });
});
