/**
 * The signature annexe's REST contract (`/signature/*` behind the gateway).
 * Mirrors `signature/service/views.py` (read models) and
 * `signature/api/signer/schemas.py` (bodies). Every response is the usual
 * `{data, error_code}` envelope.
 */

export type SignatureRequestStatus =
  | 'PREPARING'
  | 'OPEN'
  | 'COMPLETING'
  | 'COMPLETED'
  | 'DECLINED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'FAILED';

export type SignerStatus = 'WAITING' | 'INVITED' | 'VIEWED' | 'SIGNING' | 'SIGNED' | 'DECLINED';

export type SignerCapacity = 'SELF' | 'LEGAL_REPRESENTATIVE' | 'COMMUNITY_ADMIN';

export type SignMethod = 'TYPED' | 'DRAWN';

export type SigningOrder = 'PARALLEL' | 'SEQUENTIAL';

export type SignatureFieldType = 'DATE' | 'INITIALS' | 'CHECKBOX' | 'TEXT';

export type SignatureArtifact = 'final' | 'evidence-pdf' | 'evidence-json';

/**
 * Where something sits on the document: a 0-based page and a rectangle in PDF
 * points, `[x1, y1, x2, y2]`, measured from the page's bottom-left corner.
 */
export interface SignatureSlot {
  page: number;
  rect: [number, number, number, number];
}

export interface SignatureRequestSummary {
  id: string;
  /** Eight characters, for a human to quote. */
  reference: string;
  id_community: number;
  community: string | null;
  title: string;
  locale: string;
  source_service: string;
  source_ref: string;
  status: SignatureRequestStatus;
  signing_order: SigningOrder;
  created_at: string | null;
  expires_at: string | null;
  closed_at: string | null;
  failure_code: string | null;
  current_revision: number;
  /** COMPLETED: the signed PDF and the evidence can be downloaded. */
  has_artifacts: boolean;
}

export interface SignerView {
  id: string;
  position: number;
  id_member: number | null;
  capacity: SignerCapacity;
  display_name: string;
  /** The company's name for a legal representative, else null. */
  member_label: string | null;
  role_label: string | null;
  status: SignerStatus;
  method: SignMethod | null;
  slot: SignatureSlot | null;
  invited_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
}

/** `GET /me/requests`: one row per slot the user may sign, newest first. */
export interface MySignatureRow {
  request: SignatureRequestSummary;
  signer: SignerView;
  pending: boolean;
  /** Pending AND invited or viewed: the user can sign it now. */
  your_turn: boolean;
}

export interface SignatureFieldView {
  name: string;
  type: SignatureFieldType;
  label: string | null;
  required: boolean;
  slot: SignatureSlot | null;
  value: string | null;
}

/** One of the caller's own slots on the request, with what signing it takes. */
export interface MySignatureSlot {
  signer_id: string;
  consent_version: string;
  /** The exact statement to show, in the request's language. */
  consent_text: string;
  fields: SignatureFieldView[];
}

export interface SignatureRequestDetail {
  request: SignatureRequestSummary;
  signers: (SignerView & { mine: boolean })[];
  progress: { signed: number; total: number };
  document: { revision: number; sha256: string; kind: string } | null;
  my_slots: MySignatureSlot[];
  /** A manager or admin of the request's community: timeline, remind, cancel. */
  can_follow: boolean;
}

/** The current revision, as displayed, and the SHA-256 the browser computed over it. */
export interface SignatureDocument {
  bytes: ArrayBuffer;
  sha256: string;
  /** `X-Document-Revision`, when the gateway passed it on. */
  revision: number | null;
}

export interface SignIn {
  method: SignMethod;
  typed_name: string | null;
  /** `data:image/png;base64,...` */
  image_png: string;
  /** CHECKBOX as 'true'/'false'; DATE fields are never sent (the server writes the date). */
  fields: Record<string, string>;
  consent_version: string;
  consent_accepted: true;
  document_sha256: string;
}

export type SignatureEventType =
  | 'request.created'
  | 'document.prepared'
  | 'signer.invited'
  | 'signer.viewed'
  | 'signer.reauthenticated'
  | 'signer.signed'
  | 'signer.declined'
  | 'request.reminded'
  | 'request.completed'
  | 'request.cancelled'
  | 'request.expired'
  | 'request.failed';

export interface SignatureEvent {
  seq: number;
  /** One of {@link SignatureEventType}, or a type newer than this front. */
  type: string;
  at: string;
  signer: { position: number; display_name: string } | null;
  document_sha256: string | null;
  payload: Record<string, unknown>;
}

export interface SignatureTimeline {
  /** The hash chain over the event log: `ok` false names the first broken event. */
  chain: { ok: boolean; events: number; head: string | null; broken_at: number | null };
  events: SignatureEvent[];
}

export interface CommunitySignatureRequest extends SignatureRequestSummary {
  progress: { signed: number; total: number };
  last_reminded_at: string | null;
}

export interface CommunitySignatureRequests {
  total: number;
  items: CommunitySignatureRequest[];
}

export interface CommunitySignatureQuery {
  status?: string;
  source?: string;
  limit?: number;
  offset?: number;
}

/** Error codes the screens branch on (`signature/core/errors`). */
export const SIGNATURE_ERRORS = {
  STEP_UP_REQUIRED: 2510,
  DOCUMENT_CHANGED: 2511,
  SLOT_NOT_OPEN: 2512,
  REQUEST_CLOSED: 2513,
  CONSENT_REQUIRED: 2514,
  FIELD_REQUIRED: 2515,
  FIELD_INVALID: 2516,
  IMAGE_INVALID: 2517,
  TYPED_NAME_REQUIRED: 2518,
  TOO_MANY_REQUESTS: 2520,
  REMINDED_RECENTLY: 2530,
} as const;
