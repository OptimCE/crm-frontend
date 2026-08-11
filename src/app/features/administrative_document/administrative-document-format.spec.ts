import { HttpErrorResponse } from '@angular/common/http';

import { ApiResponse } from '../../core/dtos/api.response';
import {
  DeadlineStatus,
  DocOrigin,
  DocumentOut,
  DocumentStatus,
  DossierStatus,
  DossierType,
  StatusEventOut,
  SubjectType,
} from '../../shared/dtos/administrative-document.dtos';
import {
  deadlineStatusSeverity,
  deadlineTypeLabelKey,
  docTypeLabelKey,
  documentStatusLabelKey,
  documentStatusSeverity,
  dossierStatusLabelKey,
  dossierStatusSeverity,
  dossierTypeLabelKey,
  extensionForMimeType,
  extractApiErrorCode,
  extractApiErrorMessage,
  formatApiDate,
  formatBytes,
  isOverdue,
  parseApiDate,
  toApiDate,
  toTimelineEntries,
} from './administrative-document-format';

describe('label keys', () => {
  it('derives the key from the enum member name', () => {
    expect(dossierTypeLabelKey(DossierType.CREATION_NOTIFICATION)).toBe(
      'ADMINISTRATIVE_DOCUMENT.DOSSIER_TYPE.CREATION_NOTIFICATION',
    );
    expect(dossierStatusLabelKey(DossierStatus.LAPSED)).toBe(
      'ADMINISTRATIVE_DOCUMENT.DOSSIER_STATUS.LAPSED',
    );
    expect(documentStatusLabelKey(DocumentStatus.ACKNOWLEDGED)).toBe(
      'ADMINISTRATIVE_DOCUMENT.DOCUMENT_STATUS.ACKNOWLEDGED',
    );
  });
});

describe('free-string type labels', () => {
  it('maps a seeded document type to an i18n key', () => {
    expect(docTypeLabelKey('annex6_notification')).toBe(
      'ADMINISTRATIVE_DOCUMENT.DOC_TYPE.ANNEX6_NOTIFICATION',
    );
  });

  it('falls back to the raw value for an unseeded type', () => {
    // The registry is data-driven and grows without a frontend deploy, so an
    // unknown value must render as itself rather than as an empty cell.
    expect(docTypeLabelKey('general_assembly_minutes')).toBe('general_assembly_minutes');
  });

  it('maps a seeded deadline type and falls back otherwise', () => {
    expect(deadlineTypeLabelKey('completeness_check')).toBe(
      'ADMINISTRATIVE_DOCUMENT.DEADLINE_TYPE.COMPLETENESS_CHECK',
    );
    expect(deadlineTypeLabelKey('some_new_rule')).toBe('some_new_rule');
  });
});

describe('severities', () => {
  it('gives every status a severity, including unknown values', () => {
    expect(dossierStatusSeverity(DossierStatus.COMPLETE)).toBe('success');
    expect(dossierStatusSeverity(DossierStatus.LAPSED)).toBe('danger');
    expect(documentStatusSeverity(DocumentStatus.ACKNOWLEDGED)).toBe('success');
    expect(deadlineStatusSeverity(DeadlineStatus.MISSED)).toBe('danger');
    expect(deadlineStatusSeverity(DeadlineStatus.OPEN)).toBe('info');
    expect(dossierStatusSeverity(99 as DossierStatus)).toBe('secondary');
  });
});

describe('dates', () => {
  it('serialises a Date as a LOCAL calendar date', () => {
    // 23:30 local on the 5th must stay the 5th; toISOString() would roll it
    // forward to the 6th in a positive-offset zone.
    expect(toApiDate(new Date(2026, 2, 5, 23, 30))).toBe('2026-03-05');
  });

  it('returns null for no date', () => {
    expect(toApiDate(null)).toBeNull();
    expect(toApiDate(undefined)).toBeNull();
  });

  it('formats a bare API date without a Date round-trip', () => {
    expect(formatApiDate('2026-09-21')).toBe('21/09/2026');
  });

  it('passes through anything that is not a bare date', () => {
    expect(formatApiDate('')).toBe('');
    expect(formatApiDate(null)).toBe('');
    expect(formatApiDate('not-a-date')).toBe('not-a-date');
  });

  it('round-trips through parseApiDate at local midnight', () => {
    const parsed = parseApiDate('2026-09-21');
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(8);
    expect(parsed?.getDate()).toBe(21);
    expect(toApiDate(parsed)).toBe('2026-09-21');
  });

  it('detects an overdue due date against a fixed today', () => {
    const today = new Date(2026, 8, 21);
    expect(isOverdue('2026-09-20', today)).toBe(true);
    expect(isOverdue('2026-09-21', today)).toBe(false); // due today is not yet overdue
    expect(isOverdue('2026-09-22', today)).toBe(false);
  });
});

describe('extensionForMimeType', () => {
  // Only a fallback — the backend names every download — but a saved file with
  // no extension is one the OS cannot open, which reads as a broken download.
  it('resolves the formats generation produces', () => {
    expect(extensionForMimeType('application/pdf')).toBe('.pdf');
    expect(
      extensionForMimeType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    ).toBe('.xlsx');
    expect(
      extensionForMimeType(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    ).toBe('.docx');
  });

  it('ignores media-type parameters', () => {
    expect(extensionForMimeType('text/html; charset=utf-8')).toBe('.html');
  });

  it('adds nothing for an unknown or absent type', () => {
    expect(extensionForMimeType('application/octet-stream')).toBe('');
    expect(extensionForMimeType(null)).toBe('');
    expect(extensionForMimeType(undefined)).toBe('');
    expect(extensionForMimeType('')).toBe('');
  });
});

describe('formatBytes', () => {
  it('scales through the units', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('renders nothing when the size is unknown', () => {
    expect(formatBytes(null)).toBe('');
  });
});

describe('API error extraction', () => {
  it('reads the message from a real HttpErrorResponse', () => {
    // This is the shape that actually reaches a component at runtime.
    const error = new HttpErrorResponse({
      error: { data: 'This status change is not allowed', error_code: 2320 },
      status: 409,
    });
    expect(extractApiErrorMessage(error)).toBe('This status change is not allowed');
    expect(extractApiErrorCode(error)).toBe(2320);
  });

  it('still reads an ApiResponse, which is what specs throw', () => {
    const error = new ApiResponse('boom', 2333);
    expect(extractApiErrorMessage(error)).toBe('boom');
    expect(extractApiErrorCode(error)).toBe(2333);
  });

  it('degrades to null rather than throwing on an unexpected shape', () => {
    expect(extractApiErrorMessage(new Error('network'))).toBeNull();
    expect(extractApiErrorCode(undefined)).toBeNull();
    expect(extractApiErrorMessage(new HttpErrorResponse({ error: null }))).toBeNull();
  });
});

describe('toTimelineEntries', () => {
  const doc: DocumentOut = {
    id: 7,
    id_dossier: 1,
    doc_type: 'annex6_notification',
    origin: DocOrigin.UPLOADED,
    status: DocumentStatus.SENT,
    title: null,
    current_version_id: 3,
    version_count: 1,
    created_at: '2026-03-01T10:00:00Z',
    updated_at: '2026-03-05T10:00:00Z',
  };
  const documentsById = new Map<number, DocumentOut>([[7, doc]]);

  const event = (over: Partial<StatusEventOut>): StatusEventOut => ({
    id: 1,
    subject_type: SubjectType.DOSSIER,
    subject_id: 1,
    from_status: null,
    to_status: DossierStatus.IN_PREPARATION,
    is_corrective: false,
    actor_id: 'user-1',
    occurred_at: '2026-03-01T10:00:00Z',
    context: {},
    ...over,
  });

  it('orders oldest-first or newest-first on request', () => {
    const events = [event({ id: 1 }), event({ id: 2 }), event({ id: 3 })];
    expect(toTimelineEntries(events, documentsById, 'D', false).map((e) => e.id)).toEqual([
      1, 2, 3,
    ]);
    expect(toTimelineEntries(events, documentsById, 'D', true).map((e) => e.id)).toEqual([3, 2, 1]);
  });

  it('re-sorts defensively rather than trusting the payload order', () => {
    const events = [event({ id: 3 }), event({ id: 1 }), event({ id: 2 })];
    expect(toTimelineEntries(events, documentsById, 'D', false).map((e) => e.id)).toEqual([
      1, 2, 3,
    ]);
  });

  it('renders the birth event with no from-status', () => {
    const [entry] = toTimelineEntries([event({ from_status: null })], documentsById, 'D', false);
    expect(entry.fromLabelKey).toBeNull();
    expect(entry.toLabelKey).toBe('ADMINISTRATIVE_DOCUMENT.DOSSIER_STATUS.IN_PREPARATION');
  });

  it('labels a document event from its type when it has no title', () => {
    const [entry] = toTimelineEntries(
      [
        event({
          subject_type: SubjectType.DOCUMENT,
          subject_id: 7,
          to_status: DocumentStatus.SENT,
        }),
      ],
      documentsById,
      'D',
      false,
    );
    expect(entry.subjectKind).toBe('document');
    expect(entry.subjectLabel).toBe('ADMINISTRATIVE_DOCUMENT.DOC_TYPE.ANNEX6_NOTIFICATION');
    expect(entry.subjectLabelIsKey).toBe(true);
  });

  it('prefers a document title over its type', () => {
    const titled = new Map<number, DocumentOut>([[7, { ...doc, title: 'Annexe 6 signée' }]]);
    const [entry] = toTimelineEntries(
      [event({ subject_type: SubjectType.DOCUMENT, subject_id: 7 })],
      titled,
      'D',
      false,
    );
    expect(entry.subjectLabel).toBe('Annexe 6 signée');
    expect(entry.subjectLabelIsKey).toBe(false);
  });

  it('falls back to #id for a document missing from the payload', () => {
    const [entry] = toTimelineEntries(
      [event({ subject_type: SubjectType.DOCUMENT, subject_id: 999 })],
      documentsById,
      'D',
      false,
    );
    expect(entry.subjectLabel).toBe('#999');
  });

  it('flattens known context keys into labelled facts', () => {
    const [entry] = toTimelineEntries(
      [event({ context: { submission_date: '2026-09-07', authority_file_ref: 'CWAPE-1' } })],
      documentsById,
      'D',
      false,
    );
    const byLabel = new Map(entry.facts.map((f) => [f.labelKey, f.value]));
    expect(byLabel.get('ADMINISTRATIVE_DOCUMENT.TIMELINE.CONTEXT.SUBMISSION_DATE')).toBe(
      '07/09/2026',
    );
    expect(byLabel.get('ADMINISTRATIVE_DOCUMENT.TIMELINE.CONTEXT.AUTHORITY_FILE_REF')).toBe(
      'CWAPE-1',
    );
  });

  it('surfaces an unknown context key instead of dropping it', () => {
    // An evidentiary journal must never hide something it recorded.
    const [entry] = toTimelineEntries(
      [event({ context: { some_future_key: 'value' } })],
      documentsById,
      'D',
      false,
    );
    expect(entry.facts).toEqual([{ labelKey: 'some_future_key', value: 'value', emphasis: false }]);
  });

  it('hides the internal `created` marker', () => {
    const [entry] = toTimelineEntries(
      [event({ context: { created: true } })],
      documentsById,
      'D',
      false,
    );
    expect(entry.facts).toEqual([]);
  });

  it('emphasises the reason on a corrective entry', () => {
    const [entry] = toTimelineEntries(
      [event({ is_corrective: true, context: { reason: 'wrong annex' } })],
      documentsById,
      'D',
      false,
    );
    expect(entry.isCorrective).toBe(true);
    expect(entry.facts[0]).toEqual({
      labelKey: 'ADMINISTRATIVE_DOCUMENT.TIMELINE.CONTEXT.REASON',
      value: 'wrong annex',
      emphasis: true,
    });
  });

  it('keeps a null actor null so the view can render "system"', () => {
    const [entry] = toTimelineEntries([event({ actor_id: null })], documentsById, 'D', false);
    expect(entry.actor).toBeNull();
  });

  it('tolerates a missing context object', () => {
    const raw = { ...event({}), context: undefined } as unknown as StatusEventOut;
    const [entry] = toTimelineEntries([raw], documentsById, 'D', false);
    expect(entry.facts).toEqual([]);
    expect(entry.rawContext).toEqual({});
  });
});
