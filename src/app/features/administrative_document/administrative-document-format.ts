/**
 * Presentation helpers for the administrative-document annex: enum → i18n key,
 * enum → p-tag severity, date formatting, journal projection, and API error
 * extraction. Kept pure so both templates and specs can use them.
 *
 * Label functions return translation KEYS — pipe them through `translate`.
 */

import { HttpErrorResponse } from '@angular/common/http';

import { ApiResponse } from '../../core/dtos/api.response';
import {
  DeadlineStatus,
  DocOrigin,
  DocumentOut,
  DocumentStatus,
  DossierStatus,
  DossierType,
  Region,
  RenderState,
  StatusEventOut,
  SubjectType,
} from '../../shared/dtos/administrative-document.dtos';

export type TagSeverity = 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast';

const PREFIX = 'ADMINISTRATIVE_DOCUMENT';

// ---------------------------------------------------------------------------
// Enum → i18n key (reverse-enum trick: `Enum[value]` yields the member name,
// so the i18n leaf names must match the TS enum member names exactly)
// ---------------------------------------------------------------------------

export function dossierTypeLabelKey(type: DossierType): string {
  return `${PREFIX}.DOSSIER_TYPE.${DossierType[type]}`;
}

export function dossierStatusLabelKey(status: DossierStatus): string {
  return `${PREFIX}.DOSSIER_STATUS.${DossierStatus[status]}`;
}

export function documentStatusLabelKey(status: DocumentStatus): string {
  return `${PREFIX}.DOCUMENT_STATUS.${DocumentStatus[status]}`;
}

export function docOriginLabelKey(origin: DocOrigin): string {
  return `${PREFIX}.DOC_ORIGIN.${DocOrigin[origin]}`;
}

export function deadlineStatusLabelKey(status: DeadlineStatus): string {
  return `${PREFIX}.DEADLINE_STATUS.${DeadlineStatus[status]}`;
}

export function regionLabelKey(region: Region): string {
  return `${PREFIX}.REGION.${Region[region]}`;
}

// ---------------------------------------------------------------------------
// Free-string types (doc_type / deadline_type are open registries, not enums)
// ---------------------------------------------------------------------------

/** Seeded values; a community may add more without a frontend deploy. */
const KNOWN_DOC_TYPES = new Set([
  'annex6_notification',
  'annex6_sharing_form',
  'annex8_sworn_declaration',
  'dso_agreement_community',
  'dso_agreement_building',
  'annual_participant_list',
]);

const KNOWN_DEADLINE_TYPES = new Set([
  'completeness_check',
  'lapse',
  'modification_notification',
  'annual_report',
]);

/**
 * i18n key for a document type, falling back to the raw value.
 *
 * `doc_type` is a free string bounded to 64 chars — the registry is deliberately
 * data-driven and will grow. ngx-translate echoes an unknown key back unchanged,
 * so an unseeded value renders as itself rather than as an empty cell. Never
 * throw and never render blank here.
 */
export function docTypeLabelKey(docType: string): string {
  return KNOWN_DOC_TYPES.has(docType) ? `${PREFIX}.DOC_TYPE.${docType.toUpperCase()}` : docType;
}

/** i18n key for a deadline type, falling back to the raw value. */
export function deadlineTypeLabelKey(deadlineType: string): string {
  return KNOWN_DEADLINE_TYPES.has(deadlineType)
    ? `${PREFIX}.DEADLINE_TYPE.${deadlineType.toUpperCase()}`
    : deadlineType;
}

// ---------------------------------------------------------------------------
// Severities
// ---------------------------------------------------------------------------

export function dossierStatusSeverity(status: DossierStatus): TagSeverity {
  switch (status) {
    case DossierStatus.COMPLETE:
      return 'success';
    case DossierStatus.SUBMITTED:
      return 'info';
    case DossierStatus.LAPSED:
      return 'danger';
    case DossierStatus.CLOSED:
      return 'contrast';
    case DossierStatus.IN_PREPARATION:
    default:
      return 'secondary';
  }
}

export function documentStatusSeverity(status: DocumentStatus): TagSeverity {
  switch (status) {
    case DocumentStatus.ACKNOWLEDGED:
      return 'success';
    case DocumentStatus.SENT:
      return 'info';
    case DocumentStatus.READY:
      return 'warn';
    case DocumentStatus.OBSOLETE:
      return 'contrast';
    case DocumentStatus.DRAFT:
    default:
      return 'secondary';
  }
}

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

export function renderStateLabelKey(state: RenderState): string {
  return `${PREFIX}.RENDER_STATE.${RenderState[state]}`;
}

export function renderStateSeverity(state: RenderState): TagSeverity {
  return state === RenderState.FAILED ? 'danger' : 'info';
}

export function deadlineStatusSeverity(status: DeadlineStatus): TagSeverity {
  switch (status) {
    case DeadlineStatus.MET:
      return 'success';
    case DeadlineStatus.MISSED:
      return 'danger';
    case DeadlineStatus.CANCELLED:
      return 'contrast';
    case DeadlineStatus.OPEN:
    default:
      return 'info';
  }
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
 * three parts and would come back reversed into nonsense.
 */
export function formatApiDate(value: string | null | undefined): string {
  if (!value) return '';
  if (!API_DATE_PATTERN.test(value)) return value;
  const [y, m, d] = value.split('-');
  return `${d}/${m}/${y}`;
}

/** Parse a bare `YYYY-MM-DD` into a local Date, for seeding a p-datepicker. */
export function parseApiDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parts = value.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d);
}

/** True when an open deadline's due date is in the past (local calendar day). */
export function isOverdue(dueDate: string, today: Date = new Date()): boolean {
  const due = parseApiDate(dueDate);
  if (!due) return false;
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return due.getTime() < midnight.getTime();
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

/** First 12 characters of a content hash — enough to eyeball, short enough to fit. */
export function shortSha(sha: string | null | undefined): string {
  return sha ? sha.slice(0, 12) : '';
}

// ---------------------------------------------------------------------------
// API error extraction
// ---------------------------------------------------------------------------

/**
 * Pull the backend's message out of a failed request.
 *
 * The house one-liner is `error instanceof ApiResponse ? error.data : null`, but
 * `ApiResponse` is only ever thrown from `.spec.ts` files — at runtime an
 * HttpClient failure is an `HttpErrorResponse`, so that branch never fires and
 * every backend message degrades to a generic toast. This feature depends on
 * those messages (409 ILLEGAL_TRANSITION, 409 VERSION_NOT_ALLOWED, 413
 * FILE_TOO_LARGE, 409 DUPLICATE_EXTERNAL_REF, 422 SHARING_OPERATION_NOT_FOUND),
 * so handle both shapes.
 */
export function extractApiErrorMessage(error: unknown): string | null {
  if (error instanceof ApiResponse) {
    return typeof error.data === 'string' ? error.data : null;
  }
  if (error instanceof HttpErrorResponse) {
    const body = error.error as { data?: unknown } | null;
    if (body && typeof body.data === 'string') return body.data;
  }
  return null;
}

/** The backend's numeric `error_code`, for branching on a specific failure. */
export function extractApiErrorCode(error: unknown): number | null {
  if (error instanceof ApiResponse) {
    return typeof error.error_code === 'number' ? error.error_code : null;
  }
  if (error instanceof HttpErrorResponse) {
    const body = error.error as { error_code?: unknown } | null;
    if (body && typeof body.error_code === 'number') return body.error_code;
  }
  return null;
}

/** Domain error codes the UI branches on (administrative-document/shared/custom_errors.py). */
export const ERROR_CODE = {
  DUPLICATE_EXTERNAL_REF: 2305,
  SHARING_OPERATION_NOT_FOUND: 2307,
  ILLEGAL_TRANSITION: 2320,
  MISSING_TRANSITION_CONTEXT: 2321,
  VERSION_NOT_ALLOWED: 2333,
  INVALID_FILE: 2334,
  FILE_TOO_LARGE: 2335,
  GENERATION_NOT_ALLOWED: 2360,
  TEMPLATE_NOT_REGISTERED: 2361,
  PREFILL_FAILED: 2363,
  RENDER_ALREADY_IN_FLIGHT: 2364,
  TOO_MANY_ROWS: 2365,
} as const;

// ---------------------------------------------------------------------------
// Journal projection
// ---------------------------------------------------------------------------

export interface TimelineFact {
  readonly labelKey: string;
  readonly value: string;
  /** True for `reason` — the "why" of a correction, rendered prominently. */
  readonly emphasis: boolean;
}

export interface TimelineEntry {
  readonly id: number;
  readonly occurredAt: string;
  readonly subjectKind: 'dossier' | 'document';
  readonly subjectIcon: string;
  readonly subjectLabel: string;
  readonly subjectLabelIsKey: boolean;
  /** Null on the birth event, where from_status is null. */
  readonly fromLabelKey: string | null;
  readonly toLabelKey: string;
  readonly severity: TagSeverity;
  readonly isCorrective: boolean;
  readonly actor: string | null;
  readonly facts: readonly TimelineFact[];
  readonly rawContext: Record<string, unknown>;
}

const CONTEXT_LABEL_KEYS: Record<string, string> = {
  submission_date: `${PREFIX}.TIMELINE.CONTEXT.SUBMISSION_DATE`,
  acknowledged_date: `${PREFIX}.TIMELINE.CONTEXT.ACKNOWLEDGED_DATE`,
  authority_file_ref: `${PREFIX}.TIMELINE.CONTEXT.AUTHORITY_FILE_REF`,
  result: `${PREFIX}.TIMELINE.CONTEXT.RESULT`,
  reason: `${PREFIX}.TIMELINE.CONTEXT.REASON`,
  note: `${PREFIX}.TIMELINE.CONTEXT.NOTE`,
};

const DATE_CONTEXT_KEYS = new Set(['submission_date', 'acknowledged_date']);

function formatContextValue(key: string, value: unknown): string {
  if (DATE_CONTEXT_KEYS.has(key) && typeof value === 'string') return formatApiDate(value);
  if (typeof value === 'string') return value.slice(0, 200);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value).slice(0, 200);
}

/**
 * Flatten a journal entry's context into displayable facts.
 *
 * Unknown keys fall back to the key itself rather than being dropped: this is an
 * evidentiary journal, so nothing it recorded may silently disappear from view.
 * `created` (set on the birth event) is skipped — it carries no information the
 * "created" rendering doesn't already convey.
 */
function toFacts(context: Record<string, unknown>): TimelineFact[] {
  return Object.entries(context)
    .filter(([key]) => key !== 'created')
    .map(([key, value]) => ({
      labelKey: CONTEXT_LABEL_KEYS[key] ?? key,
      value: formatContextValue(key, value),
      emphasis: key === 'reason',
    }));
}

/**
 * Project the raw journal into renderable entries.
 *
 * The backend returns dossier and document events interleaved, oldest first. We
 * re-sort defensively so the view never depends on backend ordering.
 */
export function toTimelineEntries(
  events: readonly StatusEventOut[],
  documentsById: ReadonlyMap<number, DocumentOut>,
  dossierLabel: string,
  newestFirst: boolean,
): readonly TimelineEntry[] {
  const sorted = [...events].sort((a, b) => (newestFirst ? b.id - a.id : a.id - b.id));

  return sorted.map((event) => {
    const isDocument = event.subject_type === SubjectType.DOCUMENT;
    const document = isDocument ? documentsById.get(event.subject_id) : undefined;

    let subjectLabel: string;
    let subjectLabelIsKey = false;
    if (!isDocument) {
      subjectLabel = dossierLabel;
    } else if (document?.title) {
      subjectLabel = document.title;
    } else if (document) {
      subjectLabel = docTypeLabelKey(document.doc_type);
      subjectLabelIsKey = true;
    } else {
      subjectLabel = `#${event.subject_id}`;
    }

    // Branch rather than pick a function reference: a union of the two label
    // functions collapses its parameter type to `never`.
    const statusLabelKey = (status: number): string =>
      isDocument
        ? documentStatusLabelKey(status as DocumentStatus)
        : dossierStatusLabelKey(status as DossierStatus);

    const severity = isDocument
      ? documentStatusSeverity(event.to_status as DocumentStatus)
      : dossierStatusSeverity(event.to_status as DossierStatus);

    return {
      id: event.id,
      occurredAt: event.occurred_at,
      subjectKind: isDocument ? 'document' : 'dossier',
      subjectIcon: isDocument ? 'pi pi-file' : 'pi pi-folder',
      subjectLabel,
      subjectLabelIsKey,
      fromLabelKey: event.from_status === null ? null : statusLabelKey(event.from_status),
      toLabelKey: statusLabelKey(event.to_status),
      severity,
      isCorrective: event.is_corrective,
      actor: event.actor_id,
      facts: toFacts(event.context ?? {}),
      rawContext: event.context ?? {},
    };
  });
}

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
