/**
 * Drift guard for the frontend state-machine mirror.
 *
 * The fixtures below are transcribed by hand from
 * `administrative-document/domain/statemachine.py`. If someone edits the backend
 * tables without updating the mirror, these tests fail — which is the point.
 * Without them the UI would silently render buttons that 409.
 */

import {
  DocumentStatus,
  DossierStatus,
  SubjectType,
} from '../../shared/dtos/administrative-document.dtos';
import {
  allowedTargets,
  canUploadVersion,
  isCorrective,
  isTerminal,
  requiredFields,
  resolveTransitionCall,
  transitionFields,
} from './administrative-document-transitions';

/** Transcribed from DOCUMENT_TRANSITIONS in domain/statemachine.py. */
const BACKEND_DOCUMENT_EDGES: Record<DocumentStatus, DocumentStatus[]> = {
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

/** Transcribed from DOSSIER_TRANSITIONS in domain/statemachine.py. */
const BACKEND_DOSSIER_EDGES: Record<DossierStatus, DossierStatus[]> = {
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

describe('administrative-document transitions — backend parity', () => {
  it('matches the backend document adjacency table exactly', () => {
    for (const [from, expected] of Object.entries(BACKEND_DOCUMENT_EDGES)) {
      const actual = allowedTargets(SubjectType.DOCUMENT, Number(from));
      expect([...actual].sort()).toEqual([...expected].sort());
    }
  });

  it('matches the backend dossier adjacency table exactly', () => {
    for (const [from, expected] of Object.entries(BACKEND_DOSSIER_EDGES)) {
      const actual = allowedTargets(SubjectType.DOSSIER, Number(from));
      expect([...actual].sort()).toEqual([...expected].sort());
    }
  });

  it('marks exactly the six backend corrective edges', () => {
    const corrective: [SubjectType, number, number][] = [
      [SubjectType.DOCUMENT, DocumentStatus.READY, DocumentStatus.DRAFT],
      [SubjectType.DOCUMENT, DocumentStatus.SENT, DocumentStatus.READY],
      [SubjectType.DOCUMENT, DocumentStatus.ACKNOWLEDGED, DocumentStatus.SENT],
      [SubjectType.DOSSIER, DossierStatus.SUBMITTED, DossierStatus.IN_PREPARATION],
      [SubjectType.DOSSIER, DossierStatus.COMPLETE, DossierStatus.SUBMITTED],
      [SubjectType.DOSSIER, DossierStatus.LAPSED, DossierStatus.IN_PREPARATION],
    ];
    for (const [subject, from, to] of corrective) {
      expect(isCorrective(subject, from, to)).toBe(true);
    }
  });

  it('does not mark forward edges as corrective', () => {
    expect(isCorrective(SubjectType.DOCUMENT, DocumentStatus.READY, DocumentStatus.SENT)).toBe(
      false,
    );
    expect(
      isCorrective(SubjectType.DOSSIER, DossierStatus.IN_PREPARATION, DossierStatus.SUBMITTED),
    ).toBe(false);
  });
});

describe('allowedTargets', () => {
  it('never offers the illegal draft → acknowledged jump', () => {
    expect(allowedTargets(SubjectType.DOCUMENT, DocumentStatus.DRAFT)).not.toContain(
      DocumentStatus.ACKNOWLEDGED,
    );
  });

  it('never offers in_preparation → complete', () => {
    expect(allowedTargets(SubjectType.DOSSIER, DossierStatus.IN_PREPARATION)).not.toContain(
      DossierStatus.COMPLETE,
    );
  });

  it('returns nothing for an unknown status rather than throwing', () => {
    expect(allowedTargets(SubjectType.DOCUMENT, 999)).toEqual([]);
  });
});

describe('isTerminal', () => {
  it('treats obsolete documents and closed dossiers as terminal', () => {
    expect(isTerminal(SubjectType.DOCUMENT, DocumentStatus.OBSOLETE)).toBe(true);
    expect(isTerminal(SubjectType.DOSSIER, DossierStatus.CLOSED)).toBe(true);
  });

  it('does not treat a lapsed dossier as terminal — it can be re-opened', () => {
    expect(isTerminal(SubjectType.DOSSIER, DossierStatus.LAPSED)).toBe(false);
  });
});

describe('canUploadVersion', () => {
  it('allows uploads only while the document is still editable', () => {
    expect(canUploadVersion(DocumentStatus.DRAFT)).toBe(true);
    expect(canUploadVersion(DocumentStatus.READY)).toBe(true);
  });

  it('blocks uploads once the document has been filed', () => {
    expect(canUploadVersion(DocumentStatus.SENT)).toBe(false);
    expect(canUploadVersion(DocumentStatus.ACKNOWLEDGED)).toBe(false);
    expect(canUploadVersion(DocumentStatus.OBSOLETE)).toBe(false);
  });
});

describe('requiredFields', () => {
  const keys = (subject: SubjectType, from: number, to: number): string[] =>
    requiredFields(subject, from, to).map((f) => f.key);

  it('requires a submission date to mark a document sent', () => {
    expect(keys(SubjectType.DOCUMENT, DocumentStatus.READY, DocumentStatus.SENT)).toEqual([
      'submission_date',
    ]);
  });

  it('requires a date and an authority reference to acknowledge', () => {
    expect(keys(SubjectType.DOCUMENT, DocumentStatus.SENT, DocumentStatus.ACKNOWLEDGED)).toEqual([
      'acknowledged_date',
      'authority_file_ref',
    ]);
  });

  it('requires a submission date to submit a dossier', () => {
    expect(
      keys(SubjectType.DOSSIER, DossierStatus.IN_PREPARATION, DossierStatus.SUBMITTED),
    ).toEqual(['submission_date']);
  });

  it('requires a reason on every corrective edge', () => {
    expect(keys(SubjectType.DOCUMENT, DocumentStatus.SENT, DocumentStatus.READY)).toEqual([
      'reason',
    ]);
    expect(
      keys(SubjectType.DOSSIER, DossierStatus.SUBMITTED, DossierStatus.IN_PREPARATION),
    ).toEqual(['reason']);
  });

  it('requires nothing for a plain forward edge', () => {
    expect(keys(SubjectType.DOCUMENT, DocumentStatus.DRAFT, DocumentStatus.READY)).toEqual([]);
  });

  it('marks every returned field as required', () => {
    const fields = requiredFields(
      SubjectType.DOCUMENT,
      DocumentStatus.SENT,
      DocumentStatus.ACKNOWLEDGED,
    );
    expect(fields.every((f) => f.required)).toBe(true);
  });
});

describe('transitionFields', () => {
  it('adds the optional note and result on top of the required acknowledge fields', () => {
    const keys = transitionFields(
      SubjectType.DOCUMENT,
      DocumentStatus.SENT,
      DocumentStatus.ACKNOWLEDGED,
    ).map((f) => f.key);
    expect(keys).toEqual(['acknowledged_date', 'authority_file_ref', 'result', 'note']);
  });

  it('is empty for a no-context transition, which is what lets the caller skip the dialog', () => {
    expect(
      transitionFields(SubjectType.DOCUMENT, DocumentStatus.DRAFT, DocumentStatus.READY),
    ).toEqual([]);
  });

  it('bounds the free-text fields to the backend column widths', () => {
    const ack = transitionFields(
      SubjectType.DOCUMENT,
      DocumentStatus.SENT,
      DocumentStatus.ACKNOWLEDGED,
    );
    expect(ack.find((f) => f.key === 'authority_file_ref')?.maxLength).toBe(128);

    const rollback = transitionFields(
      SubjectType.DOCUMENT,
      DocumentStatus.SENT,
      DocumentStatus.READY,
    );
    expect(rollback.find((f) => f.key === 'reason')?.maxLength).toBe(512);
  });
});

describe('resolveTransitionCall', () => {
  it('routes corrective edges to the rollback endpoint', () => {
    expect(
      resolveTransitionCall(SubjectType.DOCUMENT, DocumentStatus.SENT, DocumentStatus.READY),
    ).toEqual({ kind: 'rollback', toStatus: DocumentStatus.READY });
  });

  it('routes the document convenience edges to their own endpoints', () => {
    expect(
      resolveTransitionCall(SubjectType.DOCUMENT, DocumentStatus.DRAFT, DocumentStatus.READY),
    ).toEqual({ kind: 'mark-ready' });
    expect(
      resolveTransitionCall(SubjectType.DOCUMENT, DocumentStatus.READY, DocumentStatus.SENT),
    ).toEqual({ kind: 'mark-sent' });
    expect(
      resolveTransitionCall(SubjectType.DOCUMENT, DocumentStatus.SENT, DocumentStatus.ACKNOWLEDGED),
    ).toEqual({ kind: 'acknowledge' });
  });

  it('falls back to the generic transition endpoint', () => {
    expect(
      resolveTransitionCall(SubjectType.DOCUMENT, DocumentStatus.DRAFT, DocumentStatus.OBSOLETE),
    ).toEqual({ kind: 'transition', toStatus: DocumentStatus.OBSOLETE });
    expect(
      resolveTransitionCall(SubjectType.DOSSIER, DossierStatus.SUBMITTED, DossierStatus.COMPLETE),
    ).toEqual({ kind: 'transition', toStatus: DossierStatus.COMPLETE });
  });

  it('prefers rollback over mark-sent when the edge is corrective', () => {
    // ACKNOWLEDGED → SENT is backwards, so it must NOT be routed to mark-sent.
    expect(
      resolveTransitionCall(SubjectType.DOCUMENT, DocumentStatus.ACKNOWLEDGED, DocumentStatus.SENT),
    ).toEqual({ kind: 'rollback', toStatus: DocumentStatus.SENT });
  });
});
