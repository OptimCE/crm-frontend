/**
 * Projection of a render payload into review-form sections.
 *
 * The backend decides which keys a doc_type carries (`members` for the
 * notification annex, `participants` + `installations` + `storage` for the
 * sharing one, scalars only for the AcroForm documents), so the form derives its
 * shape from the payload rather than hardcoding a layout per document type. A
 * new doc_type then renders correctly with no frontend change.
 *
 * Pure — no Angular, no HTTP — so the whole projection is unit-tested directly.
 */

import { PrefillData } from '../../shared/dtos/administrative-document.dtos';

export type ScalarValue = string | number | boolean | null;
export type TableRow = Record<string, ScalarValue>;

/** A group of scalar fields — the form's identity header. */
export interface PrefillField {
  key: string;
  value: ScalarValue;
}

/** A repeating sheet: one editable table. */
export interface PrefillTable {
  key: string;
  columns: string[];
  rows: TableRow[];
}

export interface PrefillForm {
  fields: PrefillField[];
  tables: PrefillTable[];
}

function isScalar(value: unknown): value is ScalarValue {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function isRowArray(value: unknown): value is TableRow[] {
  return (
    Array.isArray(value) &&
    value.every((row) => typeof row === 'object' && row !== null && !Array.isArray(row))
  );
}

/**
 * Column order comes from the FIRST row, then any key later rows add.
 *
 * The backend emits every column on every row in a stable order, so this is
 * normally just "the first row's keys" — but a reviewer-supplied row could
 * introduce one, and dropping it would silently discard what they typed.
 */
export function columnsOf(rows: TableRow[]): string[] {
  const columns: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) columns.push(key);
    }
  }
  return columns;
}

/** Split a payload into scalar fields and repeating tables, preserving order. */
export function toPrefillForm(data: PrefillData): PrefillForm {
  const fields: PrefillField[] = [];
  const tables: PrefillTable[] = [];

  for (const [key, value] of Object.entries(data ?? {})) {
    if (isRowArray(value)) {
      tables.push({ key, columns: columnsOf(value), rows: value.map((row) => ({ ...row })) });
    } else if (isScalar(value)) {
      fields.push({ key, value });
    }
    // Anything else (a nested object, an array of scalars) is not editable as a
    // form control. It is carried through untouched by `toPayload` below rather
    // than being shown and mangled.
  }

  return { fields, tables };
}

/**
 * Rebuild the payload from the edited form.
 *
 * `original` is threaded through so keys the form cannot represent survive the
 * round trip: dropping them would silently strip data from the filing.
 *
 * Empty strings become `null` — the backend and the renderers treat "absent" as
 * null, and an empty string would write a blank cell that is not the same thing.
 */
export function toPayload(form: PrefillForm, original: PrefillData): PrefillData {
  const payload: PrefillData = {};

  for (const [key, value] of Object.entries(original ?? {})) {
    if (!isRowArray(value) && !isScalar(value)) payload[key] = value;
  }
  for (const field of form.fields) {
    payload[field.key] = field.value === '' ? null : field.value;
  }
  for (const table of form.tables) {
    payload[table.key] = table.rows.map((row) => {
      const cleaned: TableRow = {};
      for (const column of table.columns) {
        const cell = row[column];
        cleaned[column] = cell === '' || cell === undefined ? null : cell;
      }
      return cleaned;
    });
  }

  return payload;
}

/** A blank row for a table, so "add row" produces the same shape as the rest. */
export function blankRow(table: PrefillTable): TableRow {
  return Object.fromEntries(table.columns.map((column) => [column, null]));
}

/**
 * i18n key for a payload key.
 *
 * Falls back to the raw key: ngx-translate echoes an unknown key back, so a
 * field the translations have not caught up with renders as its own name rather
 * than blank. On a regulatory form, a visible-but-untranslated label beats an
 * invisible one.
 */
export function prefillLabelKey(key: string): string {
  return `ADMINISTRATIVE_DOCUMENT.PREFILL.FIELDS.${key.toUpperCase()}`;
}

export function prefillTableLabelKey(key: string): string {
  return `ADMINISTRATIVE_DOCUMENT.PREFILL.TABLES.${key.toUpperCase()}`;
}
