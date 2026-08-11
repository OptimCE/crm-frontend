/**
 * Frontend mirror of `administrative-document/domain/statemachine.py`.
 *
 * NOTE: the backend is authoritative — it answers 409 ILLEGAL_TRANSITION and 422
 * MISSING_TRANSITION_CONTEXT regardless of what this file says. This table
 * exists so an illegal action is never *rendered* in the first place. Keep the
 * two in lockstep; `administrative-document-transitions.spec.ts` re-transcribes
 * the Python tables as fixtures so drift fails loudly.
 *
 * Nothing else in the feature may hardcode a status pair.
 */

import {
  DocumentStatus,
  DossierStatus,
  SubjectType,
} from '../../shared/dtos/administrative-document.dtos';

const DOCUMENT_EDGES: Readonly<Record<DocumentStatus, readonly DocumentStatus[]>> = {
  [DocumentStatus.DRAFT]: [DocumentStatus.READY, DocumentStatus.OBSOLETE],
  [DocumentStatus.READY]: [DocumentStatus.SENT, DocumentStatus.DRAFT, DocumentStatus.OBSOLETE],
  [DocumentStatus.SENT]: [
    DocumentStatus.ACKNOWLEDGED,
    DocumentStatus.READY,
    DocumentStatus.OBSOLETE,
  ],
  [DocumentStatus.ACKNOWLEDGED]: [DocumentStatus.OBSOLETE, DocumentStatus.SENT],
  [DocumentStatus.OBSOLETE]: [],
};

const DOSSIER_EDGES: Readonly<Record<DossierStatus, readonly DossierStatus[]>> = {
  [DossierStatus.IN_PREPARATION]: [DossierStatus.SUBMITTED, DossierStatus.LAPSED],
  [DossierStatus.SUBMITTED]: [
    DossierStatus.COMPLETE,
    DossierStatus.IN_PREPARATION,
    DossierStatus.LAPSED,
  ],
  [DossierStatus.COMPLETE]: [DossierStatus.CLOSED, DossierStatus.SUBMITTED],
  [DossierStatus.CLOSED]: [],
  [DossierStatus.LAPSED]: [DossierStatus.IN_PREPARATION],
};

/** `${subject}:${from}:${to}` — string keys avoid tuple identity problems in a Set. */
function edgeKey(subject: SubjectType, from: number, to: number): string {
  return `${subject}:${from}:${to}`;
}

/**
 * Edges that walk the lifecycle backwards. Travelling one is legitimate — it is
 * how a mistake is corrected — but it is always journaled as corrective and
 * always requires a reason.
 */
const CORRECTIVE_EDGES: ReadonlySet<string> = new Set<string>([
  edgeKey(SubjectType.DOCUMENT, DocumentStatus.READY, DocumentStatus.DRAFT),
  edgeKey(SubjectType.DOCUMENT, DocumentStatus.SENT, DocumentStatus.READY),
  edgeKey(SubjectType.DOCUMENT, DocumentStatus.ACKNOWLEDGED, DocumentStatus.SENT),
  edgeKey(SubjectType.DOSSIER, DossierStatus.SUBMITTED, DossierStatus.IN_PREPARATION),
  edgeKey(SubjectType.DOSSIER, DossierStatus.COMPLETE, DossierStatus.SUBMITTED),
  edgeKey(SubjectType.DOSSIER, DossierStatus.LAPSED, DossierStatus.IN_PREPARATION),
]);

/** The statuses reachable in one step. Empty for a terminal status. */
export function allowedTargets(subject: SubjectType, from: number): readonly number[] {
  const table: Record<number, readonly number[]> =
    subject === SubjectType.DOCUMENT ? DOCUMENT_EDGES : DOSSIER_EDGES;
  return table[from] ?? [];
}

export function isCorrective(subject: SubjectType, from: number, to: number): boolean {
  return CORRECTIVE_EDGES.has(edgeKey(subject, from, to));
}

/** True when no further action is possible (CLOSED, OBSOLETE). */
export function isTerminal(subject: SubjectType, from: number): boolean {
  return allowedTargets(subject, from).length === 0;
}

/**
 * Versions may only be added while the document is still editable. A sent or
 * acknowledged document must be rolled back first — the backend answers 409
 * VERSION_NOT_ALLOWED (2333) otherwise.
 */
export function canUploadVersion(status: DocumentStatus): boolean {
  return status === DocumentStatus.DRAFT || status === DocumentStatus.READY;
}

// ---------------------------------------------------------------------------
// Field descriptors — what a transition must collect before it can be recorded
// ---------------------------------------------------------------------------

export type TransitionFieldKey =
  | 'submission_date'
  | 'acknowledged_date'
  | 'authority_file_ref'
  | 'reason'
  | 'result'
  | 'note';

export interface TransitionFieldOption {
  readonly labelKey: string;
  readonly value: string;
}

export interface TransitionField {
  readonly key: TransitionFieldKey;
  readonly kind: 'date' | 'text' | 'textarea' | 'select';
  readonly required: boolean;
  readonly labelKey: string;
  readonly maxLength?: number;
  readonly options?: readonly TransitionFieldOption[];
}

const FIELD_SUBMISSION_DATE: TransitionField = {
  key: 'submission_date',
  kind: 'date',
  required: true,
  labelKey: 'ADMINISTRATIVE_DOCUMENT.TRANSITION.FIELDS.SUBMISSION_DATE',
};

const FIELD_ACKNOWLEDGED_DATE: TransitionField = {
  key: 'acknowledged_date',
  kind: 'date',
  required: true,
  labelKey: 'ADMINISTRATIVE_DOCUMENT.TRANSITION.FIELDS.ACKNOWLEDGED_DATE',
};

const FIELD_AUTHORITY_FILE_REF: TransitionField = {
  key: 'authority_file_ref',
  kind: 'text',
  required: true,
  labelKey: 'ADMINISTRATIVE_DOCUMENT.TRANSITION.FIELDS.AUTHORITY_FILE_REF',
  maxLength: 128,
};

const FIELD_RESULT: TransitionField = {
  key: 'result',
  kind: 'select',
  required: false,
  labelKey: 'ADMINISTRATIVE_DOCUMENT.TRANSITION.FIELDS.RESULT',
  options: [
    { labelKey: 'ADMINISTRATIVE_DOCUMENT.ACK_RESULT.COMPLETE', value: 'complete' },
    { labelKey: 'ADMINISTRATIVE_DOCUMENT.ACK_RESULT.INCOMPLETE', value: 'incomplete' },
  ],
};

const FIELD_NOTE: TransitionField = {
  key: 'note',
  kind: 'textarea',
  required: false,
  labelKey: 'ADMINISTRATIVE_DOCUMENT.TRANSITION.FIELDS.NOTE',
  maxLength: 512,
};

const FIELD_REASON: TransitionField = {
  key: 'reason',
  kind: 'textarea',
  required: true,
  labelKey: 'ADMINISTRATIVE_DOCUMENT.TRANSITION.FIELDS.REASON',
  maxLength: 512,
};

/** Mirrors TRANSITION_REQUIREMENTS + CORRECTIVE_REQUIREMENTS exactly. */
export function requiredFields(
  subject: SubjectType,
  from: number,
  to: number,
): readonly TransitionField[] {
  const fields: TransitionField[] = [];
  // `to` arrives as a plain number (allowedTargets spans both status enums), so
  // narrow it to the enum that matches the subject before comparing.
  const docTarget = to as DocumentStatus;
  const dossierTarget = to as DossierStatus;

  if (subject === SubjectType.DOCUMENT && docTarget === DocumentStatus.SENT) {
    fields.push(FIELD_SUBMISSION_DATE);
  }
  if (subject === SubjectType.DOCUMENT && docTarget === DocumentStatus.ACKNOWLEDGED) {
    fields.push(FIELD_ACKNOWLEDGED_DATE, FIELD_AUTHORITY_FILE_REF);
  }
  if (subject === SubjectType.DOSSIER && dossierTarget === DossierStatus.SUBMITTED) {
    fields.push(FIELD_SUBMISSION_DATE);
  }
  if (isCorrective(subject, from, to)) {
    fields.push(FIELD_REASON);
  }
  return fields;
}

/**
 * The required fields plus the optional extras the endpoint accepts. This is
 * what drives dialog rendering; an empty result means the transition can be
 * confirmed inline with no form at all.
 */
export function transitionFields(
  subject: SubjectType,
  from: number,
  to: number,
): readonly TransitionField[] {
  const fields: TransitionField[] = [...requiredFields(subject, from, to)];
  const docTarget = to as DocumentStatus;
  if (subject === SubjectType.DOCUMENT && docTarget === DocumentStatus.SENT) {
    fields.push(FIELD_NOTE);
  }
  if (subject === SubjectType.DOCUMENT && docTarget === DocumentStatus.ACKNOWLEDGED) {
    fields.push(FIELD_RESULT, FIELD_NOTE);
  }
  return fields;
}

// ---------------------------------------------------------------------------
// Endpoint routing
// ---------------------------------------------------------------------------

/**
 * Which endpoint records this edge. A discriminated union so the caller's
 * switch is exhaustiveness-checked by the compiler.
 */
export type TransitionCall =
  | { readonly kind: 'mark-ready' }
  | { readonly kind: 'mark-sent' }
  | { readonly kind: 'acknowledge' }
  | { readonly kind: 'rollback'; readonly toStatus: number }
  | { readonly kind: 'transition'; readonly toStatus: number };

export function resolveTransitionCall(
  subject: SubjectType,
  from: number,
  to: number,
): TransitionCall {
  // Corrective edges always go through the rollback endpoint: it is the one
  // that demands a reason. (is_corrective itself is derived server-side from
  // the edge, not from which endpoint recorded it.) Note that the rollback body
  // still needs a `context` whenever the target status has its own
  // requirements — see `requiredFields` above.
  if (isCorrective(subject, from, to)) {
    return { kind: 'rollback', toStatus: to };
  }
  if (subject === SubjectType.DOCUMENT) {
    const docTarget = to as DocumentStatus;
    if (docTarget === DocumentStatus.READY) return { kind: 'mark-ready' };
    if (docTarget === DocumentStatus.SENT) return { kind: 'mark-sent' };
    if (docTarget === DocumentStatus.ACKNOWLEDGED) return { kind: 'acknowledge' };
  }
  return { kind: 'transition', toStatus: to };
}
