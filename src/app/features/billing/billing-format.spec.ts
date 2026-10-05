import { formatMoney, formatPrice } from './billing-format';

/** French thousands separator (narrow no-break space) and the space before "€". */
const NNBSP = String.fromCharCode(0x202f);
const NBSP = String.fromCharCode(0xa0);

describe('formatMoney', () => {
  it("writes an amount the way the reader's language does", () => {
    // BUG: `Intl.NumberFormat(undefined, …)` is the BROWSER's locale, so the
    // amount on an invoice changed with the machine, never with the language
    // chosen in the app.
    expect(formatMoney('1234.5', 'fr', 'EUR')).toBe(`1${NNBSP}234,50${NBSP}€`);
    expect(formatMoney('1234.5', 'nl', 'EUR')).toBe(`€${NBSP}1.234,50`);
    expect(formatMoney('1234.5', 'de', 'EUR')).toBe(`1.234,50${NBSP}€`);
    expect(formatMoney('1234.5', 'en', 'EUR')).toBe('€1,234.50');
  });

  it('defaults to euros', () => {
    expect(formatMoney('10', 'fr')).toBe(`10,00${NBSP}€`);
  });

  it('leaves an absent amount blank and an unreadable one as it came', () => {
    expect(formatMoney(null, 'fr')).toBe('');
    expect(formatMoney(undefined, 'fr')).toBe('');
    expect(formatMoney('', 'fr')).toBe('');
    expect(formatMoney('n/a', 'fr')).toBe('n/a');
  });
});

describe('formatPrice', () => {
  it("writes a per-kWh price with two to five decimals, in the reader's language", () => {
    expect(formatPrice('0.12345', 'fr')).toBe('0,12345 EUR/kWh');
    expect(formatPrice('0.1', 'en')).toBe('0.10 EUR/kWh');
    expect(formatPrice('0.1', 'de', 'CHF')).toBe('0,10 CHF/kWh');
  });

  it('leaves an absent price blank and an unreadable one as it came', () => {
    expect(formatPrice(null, 'fr')).toBe('');
    expect(formatPrice('n/a', 'fr')).toBe('n/a');
  });
});
