/**
 * DTOs for the espace administratif's procedures engine: the `/admin` routes of
 * the administrative-document annex (`administrative-document/api/admin/schemas.py`).
 *
 * Field names stay snake_case, as in administrative-document.dtos.ts. Integer
 * enums mirror `administrative-document/shared/const.py`; the engine's common
 * statuses are integers, while a regulator plugin's own vocabulary (steps,
 * response types, deadline and piece codes) is a free string that arrives with
 * its labels in four languages. The client never hardcodes a regulator's code:
 * a second regulator must not need a frontend change.
 *
 * Dates: `*_date`, `due_date`, `today` are bare `YYYY-MM-DD`; `*_at` are ISO
 * datetimes. See administrative-document.dtos.ts for how to format each.
 */

import { RegulatoryStatus } from './regulatory-status.dtos';

export { RegulatoryStatus };

/** A label per language (fr, en, nl, de), from the regulator's catalogue. */
export type Labels = Partial<Record<string, string>>;

// ---------------------------------------------------------------------------
// Enums (mirror administrative-document/shared/const.py)
// ---------------------------------------------------------------------------

/** The engine's common status, `dossier.status`. 3 and 4 are retired July codes. */
export enum ProcedureStatus {
  DRAFT = 1,
  SENT = 2,
  LAPSED = 5,
  READY = 6,
  IN_FORCE = 7,
  REFUSED = 8,
  CANCELLED = 9,
}

/** A piece's status. "Generating" is never one: it lives in the render slot. */
export enum ProcedureDocumentStatus {
  READY = 2,
  OBSOLETE = 5,
  MISSING = 6,
  STALE = 7,
  SIGNED = 8,
  REJECTED = 9,
}

/** Where a piece comes from. */
export enum DocumentKind {
  GENERATED = 1,
  COLLECTED = 2,
  RECEIVED = 3,
}

/** What a version is for (`document_version.stage`). */
export enum VersionStage {
  /** A working render, stamped with the regulator's watermark. */
  DRAFT = 1,
  /** What is sent: an unstamped render of a reviewed draft, or an upload. */
  FINAL = 2,
  /** A pre-filled form a participant signs; the signed upload is the final. */
  TO_SIGN = 3,
}

/** Why a render holds a piece's slot. */
export enum RenderPurpose {
  RENDER = 1,
  /** Regenerate an existing version and compare its bytes; no version comes of it. */
  VERIFY = 2,
}

/** What regenerating a version from its snapshot gave. */
export enum CheckOutcome {
  IDENTICAL = 1,
  DIFFERENT = 2,
  FAILED = 3,
}

export enum ChangeStatus {
  PENDING = 1,
  ATTACHED = 2,
  DEFERRED = 3,
  EXCLUDED = 4,
  CANCELLED = 5,
  APPLIED = 6,
  REFUSED = 7,
}

export enum ChangeSubjectType {
  METER = 1,
  KEY = 2,
  MEMBER = 3,
  OPERATION = 4,
  COMMUNITY = 5,
}

/** Who a deadline binds. */
export enum DeadlineParty {
  COMMUNITY = 1,
  GRD = 2,
  REGULATOR = 3,
}

export enum DeadlineKind {
  SUBMISSION = 1,
  RESPONSE = 2,
  LAPSE = 3,
  EFFECT = 4,
}

/** Same codes as the July `DeadlineStatus`. */
export enum ProcedureDeadlineStatus {
  OPEN = 1,
  MET = 2,
  MISSED = 3,
  CANCELLED = 4,
}

export enum CorrespondenceDirection {
  OUTBOUND = 1,
  INBOUND = 2,
}

export enum OpenedBy {
  SYSTEM = 1,
  USER = 2,
  MIGRATION = 3,
}

export type Bucket = 'todo' | 'waiting' | 'planned' | 'done';

/** The dashboard's order, which is also the spec's. */
export const BUCKETS: readonly Bucket[] = ['todo', 'waiting', 'planned', 'done'];

/**
 * What the procedure waits for, generic across regulators. Unknown codes from a
 * newer backend read as `none`.
 */
export type NextActionCode =
  | 'complete_documents'
  | 'send'
  | 'record_response'
  | 'confirm_baseline'
  | 'none';

/** Who receives a procedure: the operation's reference GRD, or the regulator. */
export type Recipient = 'grd_ref' | 'regulator';

export type SendChannel = 'email' | 'online_form' | 'post';

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

/** `GET /admin/summary`: the navigation's badge. */
export interface AdminSummaryOut {
  /** Procedures whose next action is the community's (bucket todo). */
  todo: number;
  /** Deadlines past due: missed ones, and third parties' late answers. */
  overdue: number;
}

/** `GET /admin/changes/{id}`: a change and where it was filed, for the toast. */
export interface ChangeSummaryOut {
  id: number;
  kind: string;
  subject_type: number;
  subject_ref: string;
  /** ChangeStatus: 2 attached. */
  status: number;
  id_dossier: number | null;
  procedure_code: string | null;
  procedure_labels: Record<string, string> | null;
  /** ProcedureStatus: 1 draft, 6 ready. */
  procedure_status: number | null;
  recipient: string | null;
  grd_ref: string | null;
  id_sharing_operation: number | null;
  operation_name: string | null;
}

export interface ProcedureModuleStatusOut {
  active: boolean;
  regulator: string | null;
  /** False: the community's regulator has no plugin, so nothing is tracked. */
  supported: boolean;
  tracking_since: string | null;
  baseline: 'pending' | 'confirmed' | null;
  id_baseline_dossier: number | null;
}

// ---------------------------------------------------------------------------
// Dashboard and lists
// ---------------------------------------------------------------------------

export interface NextActionOut {
  /** A NextActionCode; a newer backend's other code reads as `none` (primaryAction). */
  code: string;
  labels: Labels | null;
}

export interface ProcedureDeadlineOut {
  id: number;
  id_dossier: number;
  procedure_code: string;
  procedure_labels: Labels;
  /** The catalogue rule's code (grd_control, lapse, submission, ...). */
  code: string;
  labels: Labels | null;
  due_date: string;
  party: DeadlineParty | null;
  kind: DeadlineKind | null;
  status: ProcedureDeadlineStatus;
  /** Working days from today, counted server-side; negative once past. */
  due_in_working_days: number | null;
  overdue: boolean;
  id_sharing_operation: number | null;
  operation_name: string | null;
}

export interface ProcedureItemOut {
  id: number;
  code: string;
  version: number;
  family: string;
  purpose: string;
  labels: Labels;
  status: ProcedureStatus;
  step: string;
  step_labels: Labels;
  bucket: Bucket;
  variant: string | null;
  /** A Recipient. */
  recipient: string;
  id_sharing_operation: number | null;
  operation_name: string | null;
  grd_ref: string | null;
  external_ref: string | null;
  next_action: NextActionOut;
  next_action_due: string | null;
  due_in_working_days: number | null;
  overdue: boolean;
  changes_count: number;
  pieces_ready: number;
  pieces_required: number;
  updated_at: string;
}

export interface InboxOut {
  today: string;
  /** The three soonest open deadlines. */
  banner: ProcedureDeadlineOut[];
  groups: Record<Bucket, ProcedureItemOut[]>;
}

export interface InboxQuery {
  operation_id?: number;
  grd?: string;
  bucket?: Bucket;
}

export interface ProcedureListQuery {
  page: number;
  limit: number;
  status?: ProcedureStatus;
  code?: string;
  operation_id?: number;
}

/** `from` / `to` bound the agenda; without them it lists every open deadline. */
export interface ProcedureDeadlineQuery {
  from?: string;
  to?: string;
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export interface ProcedureStepOut {
  code: string;
  status: ProcedureStatus;
  /** A Bucket. */
  bucket: string;
  labels: Labels;
  current: boolean;
  visited: boolean;
}

export interface TransitionOptionOut {
  to_step: string;
  labels: Labels;
  automatic: boolean;
}

export interface ResponseTypeOut {
  code: string;
  direction: 'inbound' | 'outbound';
  counterparty: string;
  to_step: string | null;
  labels: Labels;
  /** Recording it now is possible: its step change is allowed from here. */
  applicable_now: boolean;
}

export interface ChangeOut {
  id: number;
  /** meter_added, meter_removed, key_changed, ... */
  kind: string;
  subject_type: ChangeSubjectType;
  /** The EAN, or the key's id. */
  subject_ref: string;
  status: ChangeStatus;
  detected_at: string;
  id_member: number | null;
  grd: string | null;
  injection_status: number | null;
  effective_date: string | null;
  excluded_reason: string | null;
  /** What the core shows of its subject (its regulatory_link_status row); absent: none yet. */
  regulatory_status?: RegulatoryStatus | null;
  valid_from?: string | null;
  /** Its last day in the operation. */
  valid_to?: string | null;
  /** The refused change it refiles. */
  refiled_from?: number | null;
  /** The procedure this refused change was refiled into. */
  refiled_into?: number | null;
  /** A refused change: is the CRM still so (meter in the operation, key current)? */
  in_operation?: boolean | null;
}

/** Why the core refused the procedure's effects, kept until they land. */
export interface EffectErrorOut {
  /** `sync`: the badges; `in_force`: the effect date (retried each day). */
  kind: 'sync' | 'in_force';
  code: 'exclude' | 'unavailable';
  /** The EANs tracked in another operation. */
  subjects: string[];
  at: string;
}

/** A refused (or lapsed) procedure's offer: withdraw in the CRM, or correct and refile. */
export interface RefusalOut {
  /** The changes that can still be refiled. */
  changes: number[];
  id_sharing_operation: number | null;
  /** The family's open draft a refile would join. */
  draft_id: number | null;
}

export interface RefileIn {
  /** All the refusable changes when omitted. */
  change_ids?: number[];
}

export interface RefileOut {
  /** The draft they were filed into. */
  id_dossier: number;
  changes: number[];
}

/** A piece's current version: what is downloaded, and what would be sent. */
export interface PieceVersionOut {
  id: number;
  version_no: number;
  stage: VersionStage;
  created_at: string;
  content_sha256: string | null;
  original_filename: string | null;
  /** Rendered by OptimCE, so it can be verified. */
  generated: boolean;
}

/** A render holding the piece's slot: in flight, or failed. */
export interface PieceRenderOut {
  /** RenderState: 1 pending, 2 failed. */
  state: number;
  purpose: RenderPurpose;
  stage: VersionStage;
  requested_at: string;
  error: { code?: string | null; message?: string | null } | null;
}

/** The last regeneration of the current version from its snapshot. */
export interface PieceCheckOut {
  outcome: CheckOutcome;
  checked_at: string;
  content_sha256: string | null;
}

/** Where the piece's latest request to the signature annexe stands. */
export type PieceSignatureStatus =
  | 'requested'
  | 'open'
  | 'signed'
  | 'declined'
  | 'expired'
  | 'cancelled'
  | 'failed';

/** The piece's latest request to the signature annexe (`signature` on a piece). */
export interface PieceSignatureOut {
  status: PieceSignatureStatus;
  /** The annexe's request: its follow-up page, its evidence. Null until it accepted it. */
  request_id: string | null;
  /** Why it was declined or failed. */
  reason: string | null;
  updated_at: string;
}

/** `POST .../documents/{id}/signature-request` (202). */
export interface SignatureRequestedOut {
  status: 'requested';
  idempotency_key?: string;
}

export interface PieceOut {
  id: number;
  /** The catalogue requirement's code (sharing_modification, ...). */
  code: string;
  labels: Labels | null;
  kind: DocumentKind | null;
  required: boolean;
  status: ProcedureDocumentStatus;
  id_member: number | null;
  /** Who a per-member piece is for. */
  member_name: string | null;
  condition: Record<string, unknown> | null;
  current_version_id: number | null;
  versions: number;
  /** The registered template the piece renders with; null when nothing can render it. */
  template: string | null;
  template_version: number | null;
  /** A newer version of the form is in force; the piece keeps its own unless upgraded. */
  template_superseded: boolean;
  current_version: PieceVersionOut | null;
  render: PieceRenderOut | null;
  last_check: PieceCheckOut | null;
  /**
   * The signature annexe (2026-11-03). Optional: an annex older than the
   * feature sends neither, which reads as « nothing asked, nothing to ask ».
   */
  signature?: PieceSignatureOut | null;
  /** A manager can ask the participant to sign it in the app now. */
  signature_requestable?: boolean;
}

export interface ThreadEntryOut {
  at: string;
  /**
   * `inbound`: a mail the reception address attached here, to qualify.
   * `effective_date`: the effect date corrected by hand (with its reason).
   */
  kind: 'step' | 'correspondence' | 'version' | 'inbound' | 'effective_date';
  /** A Keycloak subject, or `system:*`. Never rendered as is. */
  actor: string | null;
  from_step: string | null;
  to_step: string | null;
  reason: string | null;
  id_correspondence: number | null;
  /** The response type's code. */
  type: string | null;
  direction: CorrespondenceDirection | null;
  subject: string | null;
  has_file: boolean;
  id_document: number | null;
  version_no: number | null;
  id_inbound_mail?: number | null;
  /** `effective_date`: from that day to this one. */
  effective_date?: string | null;
  previous_effective_date?: string | null;
}

/** `GET /admin/inbound-address`: the community's reception address. */
/** How often the summary email goes out (`digest_setting`). */
export type DigestCadence = 'working_days' | 'weekly' | 'biweekly' | 'monthly';

/** The community's summary email, as an admin saves it. */
export interface DigestSettingIn {
  enabled: boolean;
  cadence: DigestCadence;
  /** ISO weekday, 1 Monday … 7 Sunday; null for working days. */
  weekday: number | null;
  /** Every two weeks: the first send (ISO date), one of `first_dates`. */
  first_on: string | null;
  /** CRM user ids, admins or managers of the community. */
  recipient_ids: number[];
}

/** GET /admin/digest-settings: off by default. */
export interface DigestSettingOut extends DigestSettingIn {
  /** The recipients who turned it off in their profile. */
  opted_out: number[];
  /** The next scheduled send while it is on (ISO date). */
  next_on: string | null;
  /** Per ISO weekday (index 0 Monday), the two dates every two weeks may start on. */
  first_dates: string[][];
  updated_at: string | null;
  updated_by: string | null;
}

export interface InboundAddressOut {
  /** False: no reception address on this instance. */
  enabled: boolean;
  address: string | null;
}

export enum InboundMailStatus {
  UNMATCHED = 1,
  ATTACHED = 2,
  RECORDED = 3,
  DISCARDED = 4,
}

export interface InboundAttachmentOut {
  id: number;
  filename: string;
  content_type: string;
  byte_size: number;
  content_sha256: string;
}

/** A mail the reception address received. */
export interface InboundMailOut {
  id: number;
  status: InboundMailStatus;
  from_address: string | null;
  subject: string | null;
  sent_at: string | null;
  received_at: string;
  body_text: string | null;
  id_dossier: number | null;
  /** `reference` ([OPT-<id>]), `external_ref`, `manual`. */
  match_reason: string | null;
  /** A response type the procedure offers from its step. */
  suggested_response: string | null;
  id_correspondence: number | null;
  byte_size: number;
  attachments: InboundAttachmentOut[];
}

export interface SendPreviewOut {
  /** `[OPT-<id>]`: the tag that ties a reply back to this procedure. */
  reference: string;
  /** A ready subject line per language. */
  subjects: Labels;
  /** A Recipient. */
  recipient: string;
  grd_ref: string | null;
  channel: string;
}

export interface ProcedureDetailOut extends ProcedureItemOut {
  channel: string;
  /** `operation` or `community`. */
  scope: string;
  opened_by: OpenedBy | null;
  requested_effective_date: string | null;
  effective_date: string | null;
  /** An effect still to come: its date may be corrected by hand. */
  effective_date_correctable?: boolean;
  /** Set once sent: no change and no new version of a sent piece after it. */
  frozen_at: string | null;
  /** The core refused an effect; the procedure stays where it was. */
  effect_error: EffectErrorOut | null;
  timeline: ProcedureStepOut[];
  transitions: TransitionOptionOut[];
  response_types: ResponseTypeOut[];
  changes: ChangeOut[];
  pieces: PieceOut[];
  deadlines: ProcedureDeadlineOut[];
  thread: ThreadEntryOut[];
  send_preview: SendPreviewOut;
  /** Every supplied piece is final and nothing renders: it can be sent. */
  finals_ready: boolean;
  /** A piece has a fiche de saisie (`GET .../entry-sheet`). */
  has_entry_sheet: boolean;
  /** Set on a refused (or lapsed) procedure that still has something to refile. */
  refusal?: RefusalOut | null;
  /** Mails the reception address attached here, to qualify. */
  inbound?: InboundMailOut[];
}

export interface EntryFieldOut {
  key: string;
  labels: Labels;
  value: unknown;
}

export interface EntrySectionOut {
  labels: Labels;
  fields: EntryFieldOut[];
}

/** A form piece's values in the order of the regulator's form (fiche de saisie). */
export interface EntrySheetOut {
  piece_id: number;
  code: string;
  labels: Labels;
  /** The version the values come from; null before the piece is generated. */
  version: PieceVersionOut | null;
  sections: EntrySectionOut[];
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

/** `step:<code>` or `response:<code>`: the event that starts or meets a clock. */
export type CatalogueEventRef = string;

/** One legal delay, as the catalogue states it (engine/catalogue.py DeadlineRule). */
export interface CatalogueRuleOut {
  code: string;
  kind: 'relative' | 'annual';
  anchor: CatalogueEventRef | null;
  offset: { value: number; unit: 'working_days' | 'calendar_days' | 'months' } | null;
  party: 'community' | 'grd' | 'regulator';
  deadline_kind: 'submission' | 'response' | 'lapse' | 'effect';
  closes_on: CatalogueEventRef[];
  /** Null: every variant. */
  variants: string[] | null;
  labels: Labels;
}

export interface CatalogueResponseTypeOut {
  code: string;
  direction: 'inbound' | 'outbound';
  counterparty: string;
  to_step: string | null;
  variants: string[] | null;
  labels: Labels;
}

export interface ProcedureDefinitionOut {
  code: string;
  version: number;
  valid_from: string;
  valid_to: string | null;
  in_force: boolean;
  /** `filing` for what a community sends; `baseline` for the starting state. */
  purpose: string;
  /** `operation` or `community`. */
  scope: string;
  /** A Recipient. */
  recipient: string;
  channel: string;
  family: string;
  labels: Labels;
  variants: string[];
  default_variant: string | null;
  initial_step: string;
  response_types: CatalogueResponseTypeOut[];
  deadline_rules: CatalogueRuleOut[];
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export interface ProcedureCreateIn {
  code: string;
  /** Required for an operation-scope type. */
  id_sharing_operation?: number | null;
  requested_effective_date?: string | null;
}

export interface ChangeExcludeIn {
  reason: string;
}

/** `POST /admin/dossiers/{id}/effective-date`: the effect date by hand, with its reason. */
export interface EffectiveDateIn {
  /** `YYYY-MM-DD`: the day the change takes effect, as the GRD says. */
  on: string;
  reason: string;
}

export interface ProcedureTransitionIn {
  to_step: string;
  reason: string;
  /** The day it happened; today if omitted. */
  on?: string | null;
}

/** The finals asked of the renderer (piece ids); each landing comes in realtime. */
export interface FinalizeOut {
  requested: number[];
  in_flight: number[];
}

/** `needs_review`: the review form is the way (an upload, an older render). */
export interface RegenerateOut {
  requested: number[];
  needs_review: number[];
  in_flight: number[];
}

export interface VerifyAccepted {
  docgen_request_id: string;
}

/** "Mark as sent": the sending as it was done. Sent as multipart. */
export interface SendIn {
  sent_on: string;
  channel: SendChannel;
  subject?: string | null;
  body_text?: string | null;
  /** The .eml sent, or the online form's receipt. */
  file?: File | null;
}

/** A response. Sent as multipart; `dry_run` writes nothing. */
export interface CorrespondenceIn {
  type: string;
  occurred_on: string;
  subject?: string | null;
  body_text?: string | null;
  external_ref?: string | null;
  file?: File | null;
  /** Record it from a received mail: its .eml as the file. */
  inbound_mail_id?: number | null;
}

export interface ProposalDeadlineOut {
  code: string;
  labels: Labels | null;
  due_date: string;
  party: DeadlineParty;
  kind: DeadlineKind;
}

/** What recording a response would do, before it is recorded. */
export interface CorrespondenceProposalOut {
  type: string;
  labels: Labels;
  direction: 'inbound' | 'outbound';
  from_step: string;
  to_step: string | null;
  to_step_labels: Labels | null;
  /** ProcedureStatus of the step it moves to. */
  to_status?: ProcedureStatus | null;
  transition_allowed: boolean;
  deadlines_started: ProposalDeadlineOut[];
  /** The rule codes this response meets. */
  deadlines_met: string[];
  /** The effect date it would set (the 20th working day...). */
  effective_date?: string | null;
  /** What the CRM would show differently. */
  effects?: EffectPreviewOut[];
}

/** What the core would show of a subject once the response is recorded. */
export interface EffectPreviewOut {
  subject_type: ChangeSubjectType;
  subject_ref: string;
  regulatory_status: RegulatoryStatus;
  valid_from: string | null;
  valid_to: string | null;
}

// ---------------------------------------------------------------------------
// Starting state (baseline)
// ---------------------------------------------------------------------------

export type BaselineChoice = 'active' | 'not_notified' | 'in_progress' | 'ended';

export interface BaselineItemOut {
  /** Send it back with the item's choice. */
  key: string;
  /**
   * `procedure`: a procedure the baseline asks about (phase 4): was it already
   * done (`active`), not yet (`not_notified`), or sent and waiting
   * (`in_progress`)? Once per operation, or once for the community (no operation).
   */
  subject_type: 'meter' | 'key' | 'procedure';
  /** The EAN, the key's id, the operation's or the community's. */
  subject_ref: string;
  id_sharing_operation: number | null;
  /** A procedure asked about: its code and its name in four languages. */
  procedure_code?: string | null;
  procedure_labels?: Labels | null;
  operation_name: string | null;
  /** `present` on a first activation; `added`/`removed` on a reactivation. */
  change: 'present' | 'added' | 'removed';
  choices: BaselineChoice[];
  default_choice: BaselineChoice;
  /** A key's name. */
  label: string | null;
  id_member: number | null;
  grd: string | null;
  injection_status: number | null;
  start_date: string | null;
  /**
   * A meter's own status in the CRM: 1 active, 3 waiting for the GRD, 4 for the
   * manager. A waiting meter called active needs its effective date.
   */
  crm_status?: number | null;
  /** Once confirmed: what was chosen. */
  chosen: BaselineChoice | null;
  effective_date: string | null;
  sent_date: string | null;
}

export interface BaselineOut {
  status: 'not_supported' | 'pending' | 'confirmed';
  regulator: string | null;
  kind: 'first' | 'reactivation' | null;
  taken_at: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  /** The baseline procedure. */
  id_dossier: number | null;
  items: BaselineItemOut[];
}

export interface BaselineChoiceIn {
  key: string;
  choice: BaselineChoice;
  /** Active: since when, if known. Ended: since when. */
  effective_date?: string | null;
  /** In progress: the day it was sent (required). */
  sent_date?: string | null;
}

export interface BaselineConfirmIn {
  /** An item left out takes its default choice. */
  choices: BaselineChoiceIn[];
}
