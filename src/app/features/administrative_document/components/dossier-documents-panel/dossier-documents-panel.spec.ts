import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { DialogService } from 'primeng/dynamicdialog';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';

import { ApiResponse } from '../../../../core/dtos/api.response';
import { LocaleService } from '../../../../core/services/language/locale.service';
import { RealtimeService } from '../../../../core/services/realtime/realtime.service';
import { REALTIME_TOPICS, RealtimeEvent } from '../../../../core/services/realtime/realtime.types';
import { RenderState } from '../../../../shared/dtos/administrative-document.dtos';
import {
  CheckOutcome,
  ProcedureDetailOut,
  ProcedureDocumentStatus,
  RenderPurpose,
  VersionStage,
} from '../../../../shared/dtos/administrative-procedure.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeDocumentService } from '../../../../shared/services/administrative-document.service';
import { AdministrativeProcedureService } from '../../../../shared/services/administrative-procedure.service';
import { SignatureService } from '../../../../shared/services/signature.service';
import { procedureDetail } from '../../procedures/procedure-fixtures';
import { DossierDocumentsPanel } from './dossier-documents-panel';
import { GenerateDialog } from '../generate-dialog/generate-dialog';
import { UploadVersionDialog } from '../upload-version-dialog/upload-version-dialog';

@Component({
  selector: 'app-panel-host',
  standalone: true,
  imports: [DossierDocumentsPanel],
  template:
    '<app-dossier-documents-panel [detail]="detail()" (changed)="changed = $event" (stale)="stale = stale + 1" />',
})
class Host {
  readonly detail = signal<ProcedureDetailOut>(procedureDetail());
  changed: ProcedureDetailOut | null = null;
  stale = 0;
}

describe('DossierDocumentsPanel (a procedure’s pieces)', () => {
  let fixture: ComponentFixture<Host>;
  let dialogClose: Subject<unknown>;
  let dialogOpen: ReturnType<typeof vi.fn>;
  let renderStatus: ReturnType<typeof vi.fn>;
  let events: Subject<RealtimeEvent>;
  let openSnackBar: ReturnType<typeof vi.fn>;
  let regenerate: ReturnType<typeof vi.fn>;
  let verify: ReturnType<typeof vi.fn>;
  let requestSignature: ReturnType<typeof vi.fn>;
  let downloadArtifact: ReturnType<typeof vi.fn>;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byTestId = (id: string): HTMLElement | null =>
    root().querySelector(`[data-testid="${id}"]`);

  beforeEach(async () => {
    dialogClose = new Subject();
    dialogOpen = vi.fn().mockReturnValue({ onClose: dialogClose, destroy: vi.fn() });
    renderStatus = vi.fn();
    events = new Subject<RealtimeEvent>();
    openSnackBar = vi.fn();
    regenerate = vi.fn();
    verify = vi.fn();
    requestSignature = vi.fn();
    downloadArtifact = vi.fn();
    await TestBed.configureTestingModule({
      imports: [Host, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: SignatureService, useValue: { downloadArtifact } },
        {
          provide: AdministrativeDocumentService,
          useValue: { renderStatus, downloadVersion: vi.fn() },
        },
        {
          provide: AdministrativeProcedureService,
          useValue: { regenerate, verify, requestSignature },
        },
        { provide: RealtimeService, useValue: { live: signal(true), on: () => events } },
        { provide: LocaleService, useValue: { locale: signal('fr') } },
        { provide: SnackbarNotification, useValue: { openSnackBar } },
      ],
    })
      .overrideComponent(DossierDocumentsPanel, {
        set: {
          providers: [
            { provide: DialogService, useValue: { open: dialogOpen } },
            ErrorMessageHandler,
          ],
        },
      })
      .compileComponents();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('offers generate and upload before sending, download where there is a version', () => {
    expect(byTestId('dossier-documents-panel__btn--generate-0')).not.toBeNull();
    expect(byTestId('dossier-documents-panel__btn--upload-0')).not.toBeNull();
    expect(byTestId('dossier-documents-panel__btn--download-0')).toBeNull();
    expect(byTestId('dossier-documents-panel__btn--download-1')).not.toBeNull();
  });

  it('keeps only download once the procedure is frozen', () => {
    fixture.componentInstance.detail.set(procedureDetail({ frozen_at: '2026-10-29T10:00:00Z' }));
    fixture.detectChanges();
    expect(byTestId('dossier-documents-panel__btn--generate-1')).toBeNull();
    expect(byTestId('dossier-documents-panel__btn--upload-1')).toBeNull();
    expect(byTestId('dossier-documents-panel__btn--download-1')).not.toBeNull();
  });

  it('hands the procedure an upload returned to the page', () => {
    byTestId('dossier-documents-panel__btn--upload-0')?.querySelector('button')?.click();
    const [component, config] = dialogOpen.mock.calls[0] as [unknown, { data: unknown }];
    expect(component).toBe(UploadVersionDialog);
    expect(config.data).toEqual({
      dossierId: 12,
      pieceId: 21,
      title: 'Formulaire de modification',
    });

    const after = procedureDetail({ pieces_ready: 1 });
    dialogClose.next(after);
    expect(fixture.componentInstance.changed).toBe(after);
  });

  it('watches a queued render and asks again as soon as the annex says it ended', () => {
    byTestId('dossier-documents-panel__btn--generate-0')?.querySelector('button')?.click();
    expect(dialogOpen.mock.calls[0][0]).toBe(GenerateDialog);
    dialogClose.next(true);
    fixture.detectChanges();
    expect(byTestId('dossier-documents-panel__tag--render-0')).not.toBeNull();

    renderStatus.mockReturnValue(
      of(new ApiResponse({ document_id: 21, render_state: null, current_version_id: 91 })),
    );
    // A hint about another piece is not this one's.
    events.next({
      v: 1,
      id: 'x',
      topic: REALTIME_TOPICS.ADMIN_DOCUMENT_READY,
      at: '',
      scope: { community_id: 1 },
      ref: { kind: 'document', id: '99' },
      hint: { status: 'ready' },
    });
    expect(renderStatus).not.toHaveBeenCalled();

    events.next({
      v: 1,
      id: 'y',
      topic: REALTIME_TOPICS.ADMIN_DOCUMENT_READY,
      at: '',
      scope: { community_id: 1 },
      ref: { kind: 'document', id: '21' },
      hint: { status: 'ready' },
    });
    fixture.detectChanges();

    expect(renderStatus).toHaveBeenCalledWith(21);
    expect(fixture.componentInstance.stale).toBe(1);
    expect(byTestId('dossier-documents-panel__tag--render-0')).toBeNull();
  });

  it('shows a failed render without moving the piece', () => {
    const panel = fixture.debugElement.children[0].componentInstance as DossierDocumentsPanel;
    panel.renderStates.set(new Map([[21, RenderState.PENDING]]));
    renderStatus.mockReturnValue(
      of(
        new ApiResponse({
          document_id: 21,
          render_state: RenderState.FAILED,
          render_error: { message: 'template missing' },
          current_version_id: null,
        }),
      ),
    );
    events.next({
      v: 1,
      id: 'z',
      topic: REALTIME_TOPICS.ADMIN_DOCUMENT_READY,
      at: '',
      scope: { community_id: 1 },
      ref: { kind: 'document', id: '21' },
      hint: { status: 'failed' },
    });
    expect(openSnackBar).toHaveBeenCalledWith('template missing', expect.anything());
    expect(fixture.componentInstance.stale).toBe(1);
  });

  // ---- phase 2: drafts, finals, one click, verification ---------------------

  const withPiece = (
    index: number,
    piece: Partial<ProcedureDetailOut['pieces'][number]>,
    rest = {},
  ) => {
    const detail = procedureDetail(rest);
    detail.pieces[index] = { ...detail.pieces[index], ...piece };
    return detail;
  };

  it('says what the current version is: a stamped draft here', () => {
    expect(byTestId('dossier-documents-panel__tag--stage-1')?.textContent).toContain(
      'ADMINISTRATIVE_DOCUMENT.PROCEDURES.VERSION_STAGE.1',
    );
    expect(byTestId('dossier-documents-panel__tag--stage-0')).toBeNull(); // no version yet
  });

  it('regenerates a stale piece in one click, and watches the render', () => {
    fixture.componentInstance.detail.set(withPiece(1, { status: ProcedureDocumentStatus.STALE }));
    fixture.detectChanges();
    regenerate.mockReturnValue(
      of(new ApiResponse({ requested: [22], needs_review: [], in_flight: [] })),
    );

    byTestId('dossier-documents-panel__btn--regenerate-1')?.querySelector('button')?.click();
    fixture.detectChanges();

    expect(regenerate).toHaveBeenCalledWith(12, [22]);
    expect(byTestId('dossier-documents-panel__tag--render-1')).not.toBeNull();
    expect(dialogOpen).not.toHaveBeenCalled();
  });

  it('regenerates every stale piece from the banner', () => {
    fixture.componentInstance.detail.set(withPiece(1, { status: ProcedureDocumentStatus.STALE }));
    fixture.detectChanges();
    regenerate.mockReturnValue(
      of(new ApiResponse({ requested: [22], needs_review: [], in_flight: [] })),
    );

    byTestId('dossier-documents-panel__btn--regenerate-stale')?.querySelector('button')?.click();

    expect(regenerate).toHaveBeenCalledWith(12, undefined);
  });

  it('opens the review form when a piece cannot be regenerated in one click', () => {
    fixture.componentInstance.detail.set(withPiece(1, { status: ProcedureDocumentStatus.STALE }));
    fixture.detectChanges();
    regenerate.mockReturnValue(
      of(new ApiResponse({ requested: [], needs_review: [22], in_flight: [] })),
    );

    byTestId('dossier-documents-panel__btn--regenerate-1')?.querySelector('button')?.click();

    expect(dialogOpen.mock.calls[0][0]).toBe(GenerateDialog);
  });

  it('opens the review form when the CRM cannot fill the piece (blocked): it says why', () => {
    fixture.componentInstance.detail.set(withPiece(1, { status: ProcedureDocumentStatus.STALE }));
    fixture.detectChanges();
    regenerate.mockReturnValue(
      of(new ApiResponse({ requested: [], needs_review: [], in_flight: [], blocked: [22] })),
    );

    byTestId('dossier-documents-panel__btn--regenerate-1')?.querySelector('button')?.click();

    expect(dialogOpen.mock.calls[0][0]).toBe(GenerateDialog);
  });

  it('does not offer one click for an uploaded piece: there is nothing to carry over', () => {
    const detail = withPiece(1, { status: ProcedureDocumentStatus.STALE });
    detail.pieces[1].current_version = { ...detail.pieces[1].current_version!, generated: false };
    fixture.componentInstance.detail.set(detail);
    fixture.detectChanges();

    expect(byTestId('dossier-documents-panel__btn--regenerate-1')).toBeNull();
    expect(byTestId('dossier-documents-panel__btn--generate-1')).not.toBeNull();
  });

  it('watches a render the server says is in flight, after a reload', () => {
    fixture.componentInstance.detail.set(
      withPiece(1, {
        render: {
          state: RenderState.PENDING,
          purpose: RenderPurpose.RENDER,
          stage: VersionStage.FINAL,
          requested_at: '2026-10-30T10:00:00Z',
          error: null,
        },
      }),
    );
    fixture.detectChanges();

    expect(byTestId('dossier-documents-panel__tag--render-1')).not.toBeNull();
    expect(
      byTestId('dossier-documents-panel__btn--generate-1')?.querySelector('button')?.disabled,
    ).toBe(true);
  });

  it('verifies a sent final and shows the outcome', () => {
    const final = withPiece(
      1,
      {
        current_version: {
          ...procedureDetail().pieces[1].current_version!,
          stage: VersionStage.FINAL,
        },
        last_check: {
          outcome: CheckOutcome.IDENTICAL,
          checked_at: '2026-10-30T10:00:00Z',
          content_sha256: 'abc',
        },
      },
      { frozen_at: '2026-10-29T10:00:00Z' },
    );
    fixture.componentInstance.detail.set(final);
    fixture.detectChanges();
    verify.mockReturnValue(of(new ApiResponse({ docgen_request_id: 'r-1' })));

    expect(byTestId('dossier-documents-panel__tag--check-1')?.textContent).toContain(
      'ADMINISTRATIVE_DOCUMENT.PROCEDURES.CHECK_OUTCOME.1',
    );
    byTestId('dossier-documents-panel__btn--verify-1')?.querySelector('button')?.click();
    fixture.detectChanges();

    expect(verify).toHaveBeenCalledWith(12, 22, 90);
    expect(byTestId('dossier-documents-panel__tag--render-1')).not.toBeNull();
  });

  it('offers no verification of a draft', () => {
    expect(byTestId('dossier-documents-panel__btn--verify-1')).toBeNull();
  });

  it('names the participant of a per-member piece', () => {
    fixture.componentInstance.detail.set(withPiece(0, { member_name: 'Alice Dupont' }));
    fixture.detectChanges();

    expect(byTestId('dossier-documents-panel__row--0')?.textContent).toContain(
      'Formulaire de modification — Alice Dupont',
    );
  });

  // ---- the electronic signature (the signature annexe) ------------------------

  const REQUEST_ID = '1b4e28ba-2fa1-11d2-883f-0016d3cca427';

  it('offers « Demander la signature » on a signable piece with nothing asked yet', () => {
    expect(byTestId('dossier-documents-panel__button--request-signature-0')).toBeNull();
    fixture.componentInstance.detail.set(withPiece(0, { signature_requestable: true }));
    fixture.detectChanges();
    expect(byTestId('dossier-documents-panel__button--request-signature-0')).not.toBeNull();
    expect(byTestId('dossier-documents-panel__signature-status-0')).toBeNull();
  });

  it('asks the annex, then reads the procedure again', () => {
    fixture.componentInstance.detail.set(withPiece(0, { signature_requestable: true }));
    fixture.detectChanges();
    requestSignature.mockReturnValue(of(new ApiResponse({ status: 'requested' })));

    byTestId('dossier-documents-panel__button--request-signature-0')
      ?.querySelector('button')
      ?.click();

    expect(requestSignature).toHaveBeenCalledWith(12, 21);
    expect(fixture.componentInstance.stale).toBe(1);
    expect(openSnackBar).toHaveBeenCalled();
  });

  it('offers nothing more while a request is under way or done, and again once it ended', () => {
    const at = '2026-11-03T10:00:00Z';
    for (const status of ['requested', 'open', 'signed'] as const) {
      fixture.componentInstance.detail.set(
        withPiece(0, {
          signature_requestable: true,
          signature: { status, request_id: REQUEST_ID, reason: null, updated_at: at },
        }),
      );
      fixture.detectChanges();
      expect(byTestId('dossier-documents-panel__button--request-signature-0')).toBeNull();
    }
    for (const status of ['declined', 'expired', 'cancelled', 'failed'] as const) {
      fixture.componentInstance.detail.set(
        withPiece(0, {
          signature_requestable: true,
          signature: { status, request_id: REQUEST_ID, reason: null, updated_at: at },
        }),
      );
      fixture.detectChanges();
      expect(byTestId('dossier-documents-panel__button--request-signature-0')).not.toBeNull();
    }
  });

  it('says where the signature stands, with the decline reason, and links to its follow-up', () => {
    fixture.componentInstance.detail.set(
      withPiece(0, {
        signature: {
          status: 'declined',
          request_id: REQUEST_ID,
          reason: 'Mauvais compteur',
          updated_at: '2026-11-03T10:00:00Z',
        },
      }),
    );
    fixture.detectChanges();
    expect(byTestId('dossier-documents-panel__signature-status-0')?.textContent).toContain(
      'SIGNATURE.PIECE.STATUS.DECLINED',
    );
    expect(
      byTestId('dossier-documents-panel__link--signature-follow-0')?.getAttribute('href'),
    ).toBe(`/signatures/requests/${REQUEST_ID}`);
    expect(byTestId('dossier-documents-panel__button--signature-evidence-0')).toBeNull();
  });

  it('downloads the evidence of a signed piece from the signature annex', () => {
    fixture.componentInstance.detail.set(
      withPiece(0, {
        signature: {
          status: 'signed',
          request_id: REQUEST_ID,
          reason: null,
          updated_at: '2026-11-03T10:00:00Z',
        },
      }),
    );
    fixture.detectChanges();
    expect(byTestId('dossier-documents-panel__signature-status-0')?.textContent).toContain(
      'SIGNATURE.PIECE.STATUS.SIGNED',
    );
    downloadArtifact.mockReturnValue(new Subject());
    byTestId('dossier-documents-panel__button--signature-evidence-0')
      ?.querySelector('button')
      ?.click();
    expect(downloadArtifact).toHaveBeenCalledWith(REQUEST_ID, 'evidence-pdf');
  });
});
