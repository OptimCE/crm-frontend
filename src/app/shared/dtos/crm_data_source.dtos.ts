/**
 * Shapes shared by the "use the data already in OptimCE" source, which both the
 * allocation-key generation and the simulation annexes offer.
 *
 * Instead of uploading a DSO workbook, the manager picks a sharing operation and
 * a period; the backend reads the quarter-hourly meter readings the platform has
 * already imported. These types describe the pre-flight the UI shows before the
 * run is allowed to start.
 */

/** Where a run's input timeseries came from. Mirrors the backend `DataSource`. */
export enum DataSource {
  FILE = 1,
  CRM = 2,
}

/** Which source the start form is currently configured for. */
export type InputSourceChoice = 'file' | 'crm';

/**
 * A meter missing part of the period. Its gaps are filled with zero and the run
 * is still allowed — this is reported, not blocking.
 */
export interface IncompleteMeterDTO {
  ean: string;
  /** Distinct timestamps this meter actually has. */
  readings: number;
  /** Distinct timestamps across the whole operation. */
  expected: number;
  missing: number;
}

/**
 * A reason the period cannot be used. `message` is already localised by the
 * backend (it holds the same text the eventual 4xx would carry), so the UI
 * renders it directly rather than mapping `error_code` to a key of its own.
 */
export interface PreviewBlockerDTO {
  error_code: number;
  message: string;
  /** Which meters or participants triggered it. */
  detail: string;
}

/** Query string accepted by both `/generation/crm-data-preview` and the simulation one. */
export interface CrmDataPreviewQuery {
  id_sharing_operation: number;
  /** `YYYY-MM-DD`, produced with `toLocalDateString` so no UTC day-shift occurs. */
  period_start: string;
  period_end: string;
}
