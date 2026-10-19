import de from '../../../assets/i18n/de.json';
import en from '../../../assets/i18n/en.json';
import fr from '../../../assets/i18n/fr.json';
import nl from '../../../assets/i18n/nl.json';
import { InvoiceStatus, InvoiceType } from '../../shared/dtos/billing.dtos';
import {
  formatMoney,
  formatPrice,
  invoiceStatusLabelKey,
  invoiceStatusSeverity,
  memberPays,
  settlementLabelKey,
} from './billing-format';

const LOCALES: Record<string, unknown> = { fr, en, nl, de };

/** The string a dotted i18n key points at in a locale bundle, or undefined. */
function lookup(bundle: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle);
}

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

describe('memberPays', () => {
  it('is true for a consumer invoice only', () => {
    expect(memberPays(InvoiceType.INVOICE)).toBe(true);
  });

  it('is false for a producer statement, which the community pays to the member', () => {
    // BUG: "Mes factures à payer" listed DP-2026-00019, a payout, as a bill to pay.
    expect(memberPays(InvoiceType.PRODUCER_STATEMENT)).toBe(false);
  });

  it('is false for a credit note, which cancels an invoice', () => {
    expect(memberPays(InvoiceType.CREDIT_NOTE)).toBe(false);
  });

  it('is false for a type this build does not know', () => {
    expect(memberPays(99 as InvoiceType)).toBe(false);
  });
});

describe('settlementLabelKey', () => {
  it('labels what the member receives instead of what they pay', () => {
    expect(settlementLabelKey(InvoiceType.PRODUCER_STATEMENT)).toBe(
      'BILLING.MEMBER_VIEW.TO_RECEIVE',
    );
    expect(settlementLabelKey(InvoiceType.CREDIT_NOTE)).toBe('BILLING.MEMBER_VIEW.IN_YOUR_FAVOUR');
  });

  it('gives a bill no label', () => {
    expect(settlementLabelKey(InvoiceType.INVOICE)).toBeNull();
    expect(settlementLabelKey(99 as InvoiceType)).toBeNull();
  });

  it('has a translation in every locale for every label', () => {
    for (const type of [InvoiceType.PRODUCER_STATEMENT, InvoiceType.CREDIT_NOTE]) {
      const key = settlementLabelKey(type) as string;
      for (const [lang, bundle] of Object.entries(LOCALES)) {
        expect(typeof lookup(bundle, key), `${lang}: ${key}`).toBe('string');
      }
    }
  });
});

describe('invoice status presentation', () => {
  it('labels every status the backend can return, in every locale', () => {
    const statuses = Object.values(InvoiceStatus).filter(
      (value): value is InvoiceStatus => typeof value === 'number',
    );
    expect(statuses).toContain(InvoiceStatus.CREDITED);
    for (const status of statuses) {
      const key = invoiceStatusLabelKey(status);
      for (const [lang, bundle] of Object.entries(LOCALES)) {
        expect(typeof lookup(bundle, key), `${lang}: ${key}`).toBe('string');
      }
    }
  });

  it('shows a credited invoice as settled, not as something still to act on', () => {
    expect(invoiceStatusLabelKey(InvoiceStatus.CREDITED)).toBe('BILLING.INVOICE_STATUS.CREDITED');
    expect(invoiceStatusSeverity(InvoiceStatus.CREDITED)).toBe('secondary');
  });
});
