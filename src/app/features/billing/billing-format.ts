/**
 * Presentation helpers for the billing annex: enum → i18n key / p-tag severity,
 * and decimal-string money formatting. Kept pure so both templates and specs can
 * use them. Label functions return translation KEYS — pipe them through translate.
 */
import {
  BillingRunStatus,
  InvoiceStatus,
  InvoiceType,
  PaymentMethod,
  TariffKind,
  TariffScope,
} from '../../shared/dtos/billing.dtos';

export type TagSeverity = 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast';

export function invoiceStatusLabelKey(status: InvoiceStatus): string {
  return `BILLING.INVOICE_STATUS.${InvoiceStatus[status]}`;
}

export function invoiceStatusSeverity(status: InvoiceStatus): TagSeverity {
  switch (status) {
    case InvoiceStatus.PAID:
      return 'success';
    case InvoiceStatus.ISSUED:
    case InvoiceStatus.SENT:
      return 'info';
    case InvoiceStatus.OVERDUE:
    case InvoiceStatus.RENDER_FAILED:
      return 'danger';
    case InvoiceStatus.CANCELLED:
    case InvoiceStatus.CREDITED:
    case InvoiceStatus.DRAFT:
    default:
      return 'secondary';
  }
}

export function invoiceTypeLabelKey(type: InvoiceType): string {
  return `BILLING.INVOICE_TYPE.${InvoiceType[type]}`;
}

/**
 * True only for a document the member pays: a consumer INVOICE.
 *
 * A PRODUCER_STATEMENT is the community paying the producer, and a CREDIT_NOTE
 * cancels an invoice. Both are numbered and issued like an invoice and go
 * through the same statuses, so the status does not tell who pays whom. Only
 * the type does. (Billing backends before 2026-10-08 also gave both a due date
 * and a structured communication.) An unknown type counts as not payable:
 * telling a member to pay something they may be owed is the worse mistake.
 *
 * The invoice lists take a `type` filter now; keep this check on the rows
 * anyway, because an older backend ignores the filter.
 */
export function memberPays(type: InvoiceType): boolean {
  return type === InvoiceType.INVOICE;
}

/**
 * What a document the member does not pay means to them, as an i18n key, or
 * null for a bill (it needs no such label).
 */
export function settlementLabelKey(type: InvoiceType): string | null {
  switch (type) {
    case InvoiceType.INVOICE:
      return null;
    case InvoiceType.CREDIT_NOTE:
      return 'BILLING.MEMBER_VIEW.IN_YOUR_FAVOUR';
    case InvoiceType.PRODUCER_STATEMENT:
      return 'BILLING.MEMBER_VIEW.TO_RECEIVE';
    default:
      return null;
  }
}

export function runStatusLabelKey(status: BillingRunStatus): string {
  return `BILLING.RUN_STATUS.${BillingRunStatus[status]}`;
}

export function runStatusSeverity(status: BillingRunStatus): TagSeverity {
  switch (status) {
    case BillingRunStatus.COMPUTED:
      return 'success';
    case BillingRunStatus.FAILED:
      return 'danger';
    case BillingRunStatus.PENDING:
    case BillingRunStatus.COMPUTING:
    default:
      return 'info';
  }
}

export function tariffKindLabelKey(kind: TariffKind): string {
  return `BILLING.TARIFF_KIND.${TariffKind[kind]}`;
}

export function tariffScopeLabelKey(scope: TariffScope): string {
  return `BILLING.TARIFF_SCOPE.${TariffScope[scope]}`;
}

export function paymentMethodLabelKey(method: PaymentMethod): string {
  return `BILLING.PAYMENT_METHOD.${PaymentMethod[method]}`;
}

/** True while a run is still being computed (poll until this is false). */
export function isRunPending(status: BillingRunStatus): boolean {
  return status === BillingRunStatus.PENDING || status === BillingRunStatus.COMPUTING;
}

/**
 * Format a decimal-string amount as money, in the reader's language.
 *
 * `locale` is the app's language (LocaleService.locale), REQUIRED so no caller
 * can fall back to the browser's locale, which is what `undefined` meant here:
 * the same invoice read "€1,234.50" or "1 234,50 €" depending on the machine,
 * never on the language chosen in the app.
 */
export function formatMoney(
  amount: string | null | undefined,
  locale: string,
  currency = 'EUR',
): string {
  if (amount == null || amount === '') return '';
  const value = Number(amount);
  if (Number.isNaN(value)) return String(amount);
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
}

/** Local calendar date (`YYYY-MM-DD`) for the API — avoids the UTC shift `toISOString` causes. */
export function toApiDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Format a per-kWh price with higher precision (kept as a decimal string
 * upstream), in the reader's language - see `formatMoney` for `locale`.
 */
export function formatPrice(
  price: string | null | undefined,
  locale: string,
  currency = 'EUR',
): string {
  if (price == null || price === '') return '';
  const value = Number(price);
  if (Number.isNaN(value)) return String(price);
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 5,
  }).format(value)} ${currency}/kWh`;
}
