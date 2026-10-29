/**
 * Presentation helpers for the administrative-document annex's generation and
 * filings: render state → i18n key and p-tag severity, date formatting, and API
 * error extraction. Kept pure so both templates and specs can use them.
 *
 * Label functions return translation KEYS — pipe them through `translate`.
 */

import { formatDate } from '@angular/common';

import { RenderState } from '../../shared/dtos/administrative-document.dtos';

export type TagSeverity = 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast';

const PREFIX = 'ADMINISTRATIVE_DOCUMENT';

/**
 * File extension for a media type, or '' when unknown.
 *
 * Only used as a last resort when a download response carries no usable
 * Content-Disposition: a saved file with no extension is one the operating
 * system cannot open, which is indistinguishable from a failed download.
 */
export function extensionForMimeType(mimeType: string | null | undefined): string {
  if (!mimeType) return '';
  const base = mimeType.split(';')[0].trim();
  return (
    {
      'application/pdf': '.pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'text/html': '.html',
    }[base] ?? ''
  );
}

// ---------------------------------------------------------------------------
// Render state (reverse-enum trick: `RenderState[value]` yields the member
// name, so the i18n leaf names must match the TS enum member names exactly)
// ---------------------------------------------------------------------------

export function renderStateLabelKey(state: RenderState): string {
  return `${PREFIX}.RENDER_STATE.${RenderState[state]}`;
}

export function renderStateSeverity(state: RenderState): TagSeverity {
  return state === RenderState.FAILED ? 'danger' : 'info';
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/**
 * Local calendar date (`YYYY-MM-DD`) for the API — avoids the UTC shift
 * `toISOString()` causes, which can post the previous day.
 */
export function toApiDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** A bare API calendar date: exactly `YYYY-MM-DD`, no time part. */
const API_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Format a bare `YYYY-MM-DD` for display WITHOUT going through `new Date()`.
 *
 * Angular's `| date` pipe parses a date-only string as UTC midnight, which
 * renders as the previous day for anyone in a negative UTC offset. Belgium is
 * UTC+1/+2 so the bug is invisible locally and only shows up in production.
 *
 * Anything that is not a bare date is returned untouched. Counting dashes is
 * not enough for that: `not-a-date` and `2026-09-21T08:00:00Z` both split into
 * three parts and would come back reversed into nonsense. A timestamp is an
 * instant, not a day: write it with `formatApiDay`.
 */
export function formatApiDate(value: string | null | undefined): string {
  if (!value) return '';
  if (!API_DATE_PATTERN.test(value)) return value;
  const [y, m, d] = value.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * How `formatApiDay` writes a day. CLDR's medium date names the month in every
 * language but German, so an English reader never gets en-US's "10/2/26".
 */
const API_DAY_FORMAT = 'mediumDate';

/**
 * The day an API timestamp falls on, in the reader's language: "2 oct. 2026",
 * "Oct 2, 2026", "2 okt 2026", "02.10.2026".
 *
 * For `*_at` values such as a version's `created_at`
 * (`2026-10-02T16:29:17.519196Z`), which `formatApiDate` hands back untouched.
 * They are instants, so `formatDate` converts them to the reader's own day
 * first: 23:30 UTC is already the next day in Brussels.
 *
 * Pass `LocaleService.locale()`, read in the template, so a language switch
 * rewrites the date along with the sentence around it.
 *
 * A bare `YYYY-MM-DD` has no instant to convert: it keeps `formatApiDate`'s
 * rendering and is never parsed. Anything unparseable comes back as it was, as
 * there — a raw value on screen beats a template that throws.
 */
export function formatApiDay(value: string | null | undefined, locale: string): string {
  if (!value) return '';
  if (API_DATE_PATTERN.test(value)) return formatApiDate(value);
  try {
    return formatDate(value, API_DAY_FORMAT, locale);
  } catch {
    return value;
  }
}

/** Parse a bare `YYYY-MM-DD` into a local Date, for seeding a p-datepicker. */
export function parseApiDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parts = value.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d);
}

/** Human-readable byte size for a stored version. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

// ---------------------------------------------------------------------------
// API error extraction
// ---------------------------------------------------------------------------

// Moved to `shared/utils` so the live-data annex (and its service) can use it
// too; re-exported so this feature's call sites keep their import. This feature
// depends on those messages (413 FILE_TOO_LARGE, 409 RENDER_ALREADY_IN_FLIGHT,
// 422 TEMPLATE_NOT_REGISTERED).
export { extractApiErrorCode, extractApiErrorMessage } from '../../shared/utils/api-error.utils';

/** Domain error codes the UI branches on (administrative-document/shared/custom_errors.py). */
export const ERROR_CODE = {
  INVALID_FILE: 2334,
  FILE_TOO_LARGE: 2335,
  GENERATION_NOT_ALLOWED: 2360,
  TEMPLATE_NOT_REGISTERED: 2361,
  RENDER_ALREADY_IN_FLIGHT: 2364,
  TOO_MANY_ROWS: 2365,
} as const;

/** One cell of a filed row: the regulator's field name and the value filed. */
export interface FilingRowField {
  /** The snapshot key, e.g. `ean` or `code_postal`. */
  key: string;
  /** Translation key for the label, with the raw key as the ngx fallback. */
  labelKey: string;
  /** Already stringified — the member reads this, it is never computed on. */
  value: string;
}

/**
 * Keys of a filed row that are internal rather than filed content.
 *
 * `_id_member` is the identity the snapshot carries so the backend can find a
 * member's own rows. It is not something the regulator asked for and not
 * something a member can act on, so it never reaches the screen.
 */
const FILING_INTERNAL_KEYS = new Set(['_id_member']);

/**
 * Turn one filed row into label/value pairs, dropping blanks.
 *
 * Deliberately generic over the keys. They are the regulator's own form
 * vocabulary and differ per document type, so binding named fields would mean a
 * frontend change every time a form is added — and the CWaPE catalogue already
 * has eleven. A key with no translation renders its raw name, which is worse
 * than a label but far better than hiding a value that was filed.
 *
 * A blank cell is omitted rather than shown as "—": on a regulatory filing the
 * interesting statement is what WAS declared, and a screen of empty rows buries
 * it.
 */
export function filingRowFields(row: Record<string, unknown>): FilingRowField[] {
  return Object.entries(row)
    .filter(([key]) => !FILING_INTERNAL_KEYS.has(key))
    .map(([key, value]) => ({
      key,
      labelKey: `ADMINISTRATIVE_DOCUMENT.MY_FILINGS.FIELDS.${key.toUpperCase()}`,
      value: filingValue(value),
    }))
    .filter((field) => field.value !== '');
}

function filingValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? '✓' : '';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.trim();
  // An object or array in a filed cell is a data problem, not something to
  // render as "[object Object]" to a member.
  return '';
}
