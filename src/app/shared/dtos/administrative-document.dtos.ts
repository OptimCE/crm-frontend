/**
 * DTOs for the administrative-document routes outside `/admin`: a piece's
 * generation, the member's filings, the community's operations. The procedures
 * themselves are administrative-procedure.dtos.ts.
 *
 * Field names are kept snake_case to mirror the backend payloads verbatim (same
 * convention as billing.dtos.ts).
 *
 * Two date conventions coexist and must not be mixed up:
 * - `*_date` fields are bare calendar dates `YYYY-MM-DD`. Format them with
 *   `formatApiDate`, never the `| date` pipe.
 * - `*_at` fields (created_at, …) are ISO datetimes: `| localeDate`, or
 *   `formatApiDay` for the day alone. Never `formatApiDate`, which hands them
 *   back raw.
 */

/**
 * State of an IN-FLIGHT generation.
 *
 * Deliberately not a piece status: that is the procedure's, journaled and
 * validated by the backend. A render is technical and may be retried; the piece
 * becomes READY when the render lands.
 *
 * There is no SUCCEEDED member — a successful render deletes its row, so
 * `render_state: null` means "idle, or it just landed".
 */
export enum RenderState {
  PENDING = 1,
  FAILED = 2,
}

// ---------------------------------------------------------------------------
// Sharing operations (read-only mirror of the CRM)
// ---------------------------------------------------------------------------

/** A sharing operation of the community. */
export interface SharingOperationOut {
  id: number;
  name: string;
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/**
 * The render payload, as the CRM currently sees it.
 *
 * Scalars are the form's identity header; the array keys (`members`,
 * `participants`, `installations`, `storage`) are the repeating sheets. Which
 * keys are present depends on the doc_type, so the review form derives its
 * sections from the payload rather than hardcoding them.
 */
export type PrefillData = Record<string, unknown>;

/**
 * One thing the reviewer should fix in the CRM before filing.
 *
 * Machine-readable rather than a sentence: the client renders the text from
 * `code` in its own four locales, and turns `subject_type`/`subject_id` into a
 * link to the record that is wrong — so the correction lands in the CRM instead
 * of being typed over in the dialog and frozen into an immutable snapshot.
 */
export interface PrefillWarning {
  code: string;
  subject_type: 'meter' | 'member' | 'community';
  /** EAN, member id, or null for a community-level field. Always a string. */
  subject_id: string | null;
  /** Interpolation values, notably `field` for the snapshot key concerned. */
  params: Record<string, string>;
}

export interface PrefillOut {
  data: PrefillData;
  /** Things to fix before filing — e.g. an EAN with no member attribution. */
  warnings: PrefillWarning[];
}

/**
 * The reviewed payload.
 *
 * A submitted array REPLACES the derived one rather than merging row-by-row: a
 * participant the reviewer deleted must stay deleted.
 */
export interface GenerateIn {
  data: PrefillData;
  /** Render with the form in force today, not the one the piece was pinned to. */
  upgrade_template?: boolean;
}

export interface GenerateAccepted {
  document_id: number;
  docgen_request_id: string;
  render_state: RenderState;
}

export interface RenderStatusOut {
  document_id: number;
  /** null = nothing in flight (never generated, or the render just landed). */
  render_state: RenderState | null;
  render_error: { code?: string; message?: string; permanent?: boolean } | null;
  requested_at: string | null;
  current_version_id: number | null;
  /** The piece's ProcedureDocumentStatus. */
  status: number;
}

// ---------------------------------------------------------------------------
// "What has been filed about me" — the member-facing read
//
// A distinct shape from DocumentDetailOut on purpose. That one carries the WHOLE
// `data_snapshot_json`, which names every participant of the community; these
// rows are filtered server-side to the caller's own (decision B4), so the rest
// of the community never reaches the browser at all.
// ---------------------------------------------------------------------------

export interface MyFilingDossierOut {
  id: number;
  /** The engine's common status (ProcedureStatus). */
  status: number;
  family: string;
  /** The regulator's step code. */
  step: string;
  title: string | null;
  external_ref: string | null;
  submitted_at: string | null;
}

export interface MyFilingDocumentOut {
  id: number;
  doc_type: string;
  /** ProcedureDocumentStatus. */
  status: number;
  title: string | null;
}

export interface MyFilingVersionOut {
  id: number;
  version_no: number;
  /** When the snapshot was frozen — the "as of this date" the member is shown. */
  created_at: string;
}

/**
 * The caller's own rows, per snapshot block.
 *
 * Values are free-form because the keys are the regulator's form vocabulary
 * (`nom`, `code_postal`, `part_allouee`, …) and differ per document type. The
 * UI renders them as label/value pairs rather than binding named fields, so a
 * new form does not need a frontend change to be readable.
 */
export interface MyFilingRowsOut {
  members: Record<string, unknown>[];
  participants: Record<string, unknown>[];
  installations: Record<string, unknown>[];
  storage: Record<string, unknown>[];
}

export interface MyFilingOut {
  dossier: MyFilingDossierOut;
  document: MyFilingDocumentOut;
  template_label: string | null;
  version: MyFilingVersionOut;
  my_rows: MyFilingRowsOut;
}
