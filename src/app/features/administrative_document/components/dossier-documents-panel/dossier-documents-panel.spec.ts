import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { DialogService } from 'primeng/dynamicdialog';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';

import { ApiResponse } from '../../../../core/dtos/api.response';
import { LocaleService } from '../../../../core/services/language/locale.service';
import { RealtimeService } from '../../../../core/services/realtime/realtime.service';
import { REALTIME_TOPICS, RealtimeEvent } from '../../../../core/services/realtime/realtime.types';
import { RenderState } from '../../../../shared/dtos/administrative-document.dtos';
import { ProcedureDetailOut } from '../../../../shared/dtos/administrative-procedure.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeDocumentService } from '../../../../shared/services/administrative-document.service';
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

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byTestId = (id: string): HTMLElement | null =>
    root().querySelector(`[data-testid="${id}"]`);

  beforeEach(async () => {
    dialogClose = new Subject();
    dialogOpen = vi.fn().mockReturnValue({ onClose: dialogClose, destroy: vi.fn() });
    renderStatus = vi.fn();
    events = new Subject<RealtimeEvent>();
    openSnackBar = vi.fn();
    await TestBed.configureTestingModule({
      imports: [Host, TranslateModule.forRoot()],
      providers: [
        {
          provide: AdministrativeDocumentService,
          useValue: { renderStatus, downloadVersion: vi.fn() },
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
    expect(byTestId('dossier-documents-panel__btn--generate-21')).not.toBeNull();
    expect(byTestId('dossier-documents-panel__btn--upload-21')).not.toBeNull();
    expect(byTestId('dossier-documents-panel__btn--download-21')).toBeNull();
    expect(byTestId('dossier-documents-panel__btn--download-22')).not.toBeNull();
  });

  it('keeps only download once the procedure is frozen', () => {
    fixture.componentInstance.detail.set(procedureDetail({ frozen_at: '2026-10-29T10:00:00Z' }));
    fixture.detectChanges();
    expect(byTestId('dossier-documents-panel__btn--generate-22')).toBeNull();
    expect(byTestId('dossier-documents-panel__btn--upload-22')).toBeNull();
    expect(byTestId('dossier-documents-panel__btn--download-22')).not.toBeNull();
  });

  it('hands the procedure an upload returned to the page', () => {
    byTestId('dossier-documents-panel__btn--upload-21')?.querySelector('button')?.click();
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
    byTestId('dossier-documents-panel__btn--generate-21')?.querySelector('button')?.click();
    expect(dialogOpen.mock.calls[0][0]).toBe(GenerateDialog);
    dialogClose.next(true);
    fixture.detectChanges();
    expect(byTestId('dossier-documents-panel__tag--render-21')).not.toBeNull();

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
    expect(byTestId('dossier-documents-panel__tag--render-21')).toBeNull();
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
});
