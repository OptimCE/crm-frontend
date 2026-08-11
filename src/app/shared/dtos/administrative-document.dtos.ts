/**
 * DTOs for the administrative-document annex (monorepo/administrative-document).
 *
 * Field names are kept snake_case to mirror the backend payloads verbatim (same
 * convention as billing.dtos.ts). Enum values match the backend IntEnums in
 * administrative-document/shared/const.py.
 *
 * Two date conventions coexist and must not be mixed up:
 * - `*_date` fields (due_date, submission_date, …) are bare calendar dates
 *   `YYYY-MM-DD`. Format them with `formatApiDate`, never the `| date` pipe.
 * - `*_at` fields (created_at, occurred_at, …) are ISO datetimes and may go
 *   through `| date`.
 */

// ---------------------------------------------------------------------------
// Enums (mirror administrative-document/shared/const.py)
// ---------------------------------------------------------------------------

/** Regulatory region. Resolved backend-side from `community.regulator`. */
export enum Region {
  WAL = 1,
  BRU = 2,
  VLA = 3,
}

/** Administrative dossier kinds (spec §5.3). */
export enum DossierType {
  CREATION_NOTIFICATION = 1,
  MODIFICATION = 2,
  ANNUAL_REPORT = 3,
  SHARING_AUTHORIZATION = 4,
  SHARING_MODIFICATION = 5,
  CESSATION = 6,
}

export enum DossierStatus {
  IN_PREPARATION = 1,
  SUBMITTED = 2,
  COMPLETE = 3,
  CLOSED = 4,
  LAPSED = 5,
}

export enum DocumentStatus {
  DRAFT = 1,
  READY = 2,
  SENT = 3,
  ACKNOWLEDGED = 4,
  OBSOLETE = 5,
}

/** How a document's versions are produced. */
export enum DocOrigin {
  GENERATED = 1,
  UPLOADED = 2,
}

/**
 * State of an IN-FLIGHT generation.
 *
 * Deliberately not a DocumentStatus: that is the regulatory lifecycle, journaled
 * and validated by the backend. A render is technical and may be retried, so a
 * generated document stays DRAFT until a human marks it ready.
 *
 * There is no SUCCEEDED member — a successful render deletes its row, so
 * `render_state: null` means "idle, or it just landed".
 */
export enum RenderState {
  PENDING = 1,
  FAILED = 2,
}

/** What a status_event row is about. */
export enum SubjectType {
  DOCUMENT = 1,
  DOSSIER = 2,
}

export enum DeadlineStatus {
  OPEN = 1,
  MET = 2,
  MISSED = 3,
  CANCELLED = 4,
}

/** `context.result` supplied when acknowledging a document. */
export type AcknowledgementResult = 'complete' | 'incomplete';

// ---------------------------------------------------------------------------
// Sort / query primitives
// ---------------------------------------------------------------------------

/**
 * The backend looks `sort` up in an allow-list and SILENTLY falls back to its
 * default on a miss (200 OK, wrong order). These literal unions turn a typo
 * into a compile error instead. Transcribed from
 * api/administrative_document/repository.py `_DOSSIER_SORT_COLUMNS` /
 * `_DEADLINE_SORT_COLUMNS`.
 */
export type DossierSortField =
  | 'id'
  | 'created_at'
  | 'updated_at'
  | 'submitted_at'
  | 'dossier_type'
  | 'status';

export type DeadlineSortField = 'due_date' | 'created_at' | 'id';

export type SortOrder = 'asc' | 'desc';

// ---------------------------------------------------------------------------
// Sharing operations (read-only mirror of the CRM)
// ---------------------------------------------------------------------------

/** A sharing operation a dossier can be filed for. */
export interface SharingOperationOut {
  id: number;
  name: string;
}

// ---------------------------------------------------------------------------
// Dossiers
// ---------------------------------------------------------------------------

export interface DossierOut {
  id: number;
  dossier_type: DossierType;
  status: DossierStatus;
  region: Region;
  /** Required: a community files one dossier per sharing operation. */
  id_sharing_operation: number;
  title: string | null;
  external_ref: string | null;
  submitted_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DossierDetailOut extends DossierOut {
  documents: DocumentOut[];
  deadlines: DeadlineOut[];
}

export interface DossierIn {
  dossier_type: DossierType;
  /** Required by the backend; a missing/foreign id yields 422 (code 2307). */
  id_sharing_operation: number;
  title?: string | null;
  external_ref?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * PATCH body. The backend applies each field only when it is not null, so a
 * key must be OMITTED to leave it unchanged — sending null does NOT clear it.
 */
export interface DossierPatch {
  title?: string;
  external_ref?: string;
  metadata?: Record<string, unknown>;
}

export interface DossierQuery {
  page: number;
  limit: number;
  status?: DossierStatus;
  dossier_type?: DossierType;
  id_sharing_operation?: number;
  sort?: DossierSortField;
  order?: SortOrder;
}

// ---------------------------------------------------------------------------
// Documents and versions
// ---------------------------------------------------------------------------

export interface DocumentOut {
  id: number;
  id_dossier: number;
  /** Free string, bounded to 64 chars. Seeded values come from the template registry. */
  doc_type: string;
  origin: DocOrigin;
  status: DocumentStatus;
  title: string | null;
  current_version_id: number | null;
  version_count: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentDetailOut extends DocumentOut {
  versions: DocumentVersionOut[];
}

export interface DocumentVersionOut {
  id: number;
  version_no: number;
  content_sha256: string | null;
  content_type: string | null;
  byte_size: number | null;
  original_filename: string | null;
  id_template: number | null;
  generated_by: string | null;
  /**
   * The frozen render input. Null for uploaded versions; for generated ones it
   * is exactly what was sent to the renderer, so an old version still shows the
   * data it was filed with even after the CRM has moved on.
   */
  data_snapshot_json: Record<string, unknown> | null;
  docgen_request_id: string | null;
  created_at: string;
}

export interface DocumentIn {
  doc_type: string;
  title?: string | null;
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
  status: DocumentStatus;
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

/** Generic transition; `context` carries whatever the target status requires. */
export interface TransitionIn {
  to_status: number;
  context: Record<string, unknown>;
}

export interface MarkSentIn {
  submission_date: string;
  note?: string | null;
}

export interface AcknowledgeIn {
  acknowledged_date: string;
  authority_file_ref: string;
  result: AcknowledgementResult;
  note?: string | null;
}

/**
 * A traced corrective transition. History is appended to, never rewritten.
 *
 * `reason` is mandatory on every corrective edge; `context` carries the target
 * status' own requirements on top — rolling a document back *to* SENT still
 * needs the submission date it is being restored to.
 */
export interface RollbackIn {
  to_status: number;
  reason: string;
  context: Record<string, unknown>;
}

/** One immutable entry of the status journal. */
export interface StatusEventOut {
  id: number;
  subject_type: SubjectType;
  subject_id: number;
  from_status: number | null;
  to_status: number;
  is_corrective: boolean;
  /** Opaque Keycloak `sub`; null for system-originated events. */
  actor_id: string | null;
  occurred_at: string;
  context: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Deadlines
// ---------------------------------------------------------------------------

export interface DeadlineOut {
  id: number;
  id_dossier: number;
  /** Free string; seeded values are the region's deadline rule types. */
  deadline_type: string;
  due_date: string;
  status: DeadlineStatus;
  recurring: boolean;
  derived_from_event_id: number | null;
  id_deadline_rule: number | null;
  resolved_at: string | null;
  created_at: string;
}

/** Only MET and CANCELLED are caller-settable; MISSED is derived by the sweep. */
export interface DeadlineResolveIn {
  status: DeadlineStatus.MET | DeadlineStatus.CANCELLED;
}

export interface DeadlineSweepOut {
  missed: number;
  rolled: number;
}

export interface DeadlineQuery {
  page: number;
  limit: number;
  status?: DeadlineStatus;
  deadline_type?: string;
  dossier_id?: number;
  id_sharing_operation?: number;
  sort?: DeadlineSortField;
  order?: SortOrder;
}

// ---------------------------------------------------------------------------
// Template registry (read-only here; drives the document-type picker)
// ---------------------------------------------------------------------------

export interface TemplateOut {
  id: number;
  id_community: number | null;
  region: Region;
  doc_type: string;
  version: number;
  valid_from: string;
  valid_to: string | null;
  file_ref: string | null;
  output_format: string;
  label: string | null;
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
  dossier_type: DossierType;
  status: DossierStatus;
  title: string | null;
  external_ref: string | null;
  submitted_at: string | null;
}

export interface MyFilingDocumentOut {
  id: number;
  doc_type: string;
  status: DocumentStatus;
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
