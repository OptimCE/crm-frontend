/**
 * DTOs for the billing annex (monorepo/billing).
 *
 * Field names are kept snake_case to mirror the backend payloads verbatim
 * (same convention as news.dtos.ts / simulation.dtos.ts). Enum values match the
 * backend IntEnums in billing/shared/const.py. Money/price are decimal strings
 * (Pydantic Decimal) — keep them as `string` and format only for display.
 */

export enum BillingRunStatus {
  PENDING = 0,
  COMPUTING = 1,
  COMPUTED = 2,
  FAILED = 3,
}

export enum InvoiceStatus {
  DRAFT = 0,
  ISSUED = 1,
  SENT = 2,
  PAID = 3,
  OVERDUE = 4,
  CANCELLED = 5,
  RENDER_FAILED = 6,
}

export enum InvoiceType {
  INVOICE = 1,
  CREDIT_NOTE = 2,
  PRODUCER_STATEMENT = 3,
}

export enum TariffKind {
  CONSUMER_SELLING = 1,
  PRODUCER_BUYBACK = 2,
}

export enum TariffScope {
  GLOBAL = 1,
  SEGMENT = 2,
  EAN = 3,
}

export enum BillingDirection {
  CONSUMER = 1,
  PRODUCER = 2,
}

export enum Measure {
  SHARED = 1,
  INJ_SHARED = 2,
}

export enum PaymentMethod {
  BANK_TRANSFER = 1,
  DIRECT_DEBIT = 2,
  CASH = 3,
  OTHER = 4,
}

/** Segment codes for TariffScope.SEGMENT (meter_data.client_type). */
export enum TariffSegment {
  RESIDENTIAL = 1,
  PROFESSIONAL = 2,
  INDUSTRIAL = 3,
}

/** Body for creating a tariff. `price_per_kwh` is a decimal string. */
export interface TariffIn {
  kind: TariffKind;
  scope: TariffScope;
  scope_segment?: number | null;
  scope_ean?: string | null;
  price_per_kwh: string;
  currency?: string;
  valid_from: string;
  valid_to?: string | null;
  label?: string | null;
}

export interface TariffOut {
  id: number;
  id_sharing_operation: number;
  kind: TariffKind;
  scope: TariffScope;
  scope_segment: number | null;
  scope_ean: string | null;
  price_per_kwh: string;
  currency: string;
  valid_from: string;
  valid_to: string | null;
  label: string | null;
}

/** Body for launching a billing run over a closed period. Dates as ISO strings. */
export interface BillingRunRequest {
  period_start: string;
  period_end: string;
}

export interface BillingRunOut {
  id: number;
  id_sharing_operation: number;
  period_start: string;
  period_end: string;
  status: BillingRunStatus;
  regulator: string;
  invoice_count?: number | null;
  created_at?: string | null;
}

export interface InvoiceLineOut {
  id: number;
  ean: string;
  direction: BillingDirection;
  measure: Measure;
  quantity_kwh: string;
  unit_price: string;
  amount: string;
  description: string | null;
}

export interface InvoiceOut {
  id: number;
  id_billing_run: number;
  id_member: number;
  type: InvoiceType;
  status: InvoiceStatus;
  number: string | null;
  currency: string;
  subtotal: string;
  vat_rate: string;
  vat_amount: string;
  total: string;
  structured_comm: string | null;
  issued_at: string | null;
  due_date: string | null;
  /** True once a rendered PDF is attached (gates the download control). */
  pdf_ready: boolean;
  lines?: InvoiceLineOut[] | null;
}

/** Response of the issue action — the assigned legal number + OGM. */
export interface IssueOut {
  id: number;
  number: string;
  status: InvoiceStatus;
  due_date: string | null;
  structured_comm: string | null;
}

/** Response of the PDF (re)generation request — async render kicked off. */
export interface RenderRequestOut {
  id: number;
  status: InvoiceStatus;
  pdf_ready: boolean;
}

/** Body for registering a payment. `amount` is a decimal string. */
export interface PaymentIn {
  amount: string;
  method?: PaymentMethod;
  reference?: string | null;
  paid_on?: string | null;
}

export interface PaymentOut {
  id: number;
  amount: string;
  currency: string;
  method: PaymentMethod;
  reference: string | null;
  paid_at: string;
}

export interface CreditNoteIn {
  reason?: string | null;
}

export interface OverdueSweepOut {
  marked: number;
}

/** Sortable invoice columns (backend allow-list — must stay in sync with billing repository). */
export type InvoiceSortField = 'issued_at' | 'due_date' | 'total' | 'number' | 'status';

export type SortOrder = 'asc' | 'desc';

/** Manager tracking board query. Note: billing uses `limit`, not `page_size`. */
export interface InvoiceQuery {
  status?: InvoiceStatus;
  participant?: number;
  /** Local calendar date (YYYY-MM-DD) — filter on invoice `issued_at`, inclusive. */
  issued_from?: string;
  issued_to?: string;
  sort?: InvoiceSortField;
  order?: SortOrder;
  page: number;
  limit: number;
}

/** Member self-service query (caller-scoped by the auth header server-side). */
export interface MyInvoiceQuery {
  status?: InvoiceStatus;
  issued_from?: string;
  issued_to?: string;
  sort?: InvoiceSortField;
  order?: SortOrder;
  page: number;
  limit: number;
}
