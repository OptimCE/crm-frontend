import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import {
  DocOrigin,
  DocumentOut,
  DocumentStatus,
  DossierStatus,
  StatusEventOut,
  SubjectType,
} from '../../../../shared/dtos/administrative-document.dtos';
import { DossierTimeline } from './dossier-timeline';

/**
 * Render smoke test. `detectChanges()` JIT-compiles the template, so an unknown
 * element or a bad binding fails here — never add NO_ERRORS_SCHEMA, which is
 * exactly the check we want.
 */
const doc: DocumentOut = {
  id: 7,
  id_dossier: 1,
  doc_type: 'annex6_notification',
  origin: DocOrigin.UPLOADED,
  status: DocumentStatus.SENT,
  title: null,
  current_version_id: null,
  version_count: 1,
  created_at: '2026-03-01T10:00:00Z',
  updated_at: '2026-03-05T10:00:00Z',
};

function event(over: Partial<StatusEventOut> = {}): StatusEventOut {
  return {
    id: 1,
    subject_type: SubjectType.DOSSIER,
    subject_id: 1,
    from_status: null,
    to_status: DossierStatus.IN_PREPARATION,
    is_corrective: false,
    actor_id: 'auth-user-1',
    occurred_at: '2026-03-01T10:00:00Z',
    context: {},
    ...over,
  };
}

describe('DossierTimeline', () => {
  let fixture: ComponentFixture<DossierTimeline>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DossierTimeline, TranslateModule.forRoot()],
    }).compileComponents();
    fixture = TestBed.createComponent(DossierTimeline);
    element = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the empty state when there is no history', () => {
    fixture.componentRef.setInput('events', []);
    fixture.detectChanges();
    expect(element.querySelector('[data-testid="dossier-timeline__empty--message"]')).toBeTruthy();
  });

  it('renders one entry per journal event', () => {
    fixture.componentRef.setInput('events', [event({ id: 1 }), event({ id: 2 })]);
    fixture.componentRef.setInput('dossierLabel', 'Dossier A');
    fixture.detectChanges();
    const entries = element.querySelectorAll('[data-testid^="dossier-timeline__entry--"]');
    expect(entries.length).toBe(2);
  });

  it('shows the correction marker and the reason on a corrective entry', () => {
    fixture.componentRef.setInput('events', [
      event({ id: 3, is_corrective: true, context: { reason: 'wrong annex' } }),
    ]);
    fixture.detectChanges();
    expect(element.textContent).toContain('wrong annex');
  });

  it('defaults to newest-first and can be reversed', () => {
    fixture.componentRef.setInput('events', [event({ id: 1 }), event({ id: 2 })]);
    fixture.detectChanges();
    expect(fixture.componentInstance.entries()[0].id).toBe(2);

    fixture.componentInstance.toggleOrder();
    fixture.detectChanges();
    expect(fixture.componentInstance.entries()[0].id).toBe(1);
  });

  it('labels a document event from the document map', () => {
    fixture.componentRef.setInput('events', [
      event({ subject_type: SubjectType.DOCUMENT, subject_id: 7, to_status: DocumentStatus.SENT }),
    ]);
    fixture.componentRef.setInput('documentsById', new Map([[7, doc]]));
    fixture.detectChanges();
    expect(fixture.componentInstance.entries()[0].subjectKind).toBe('document');
  });
});
