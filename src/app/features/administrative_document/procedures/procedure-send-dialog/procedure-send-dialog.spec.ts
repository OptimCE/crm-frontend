import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService, TranslationObject } from '@ngx-translate/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import en from '../../../../../assets/i18n/en.json';
import { ApiResponse } from '../../../../core/dtos/api.response';
import { LocaleService } from '../../../../core/services/language/locale.service';
import { RealtimeService } from '../../../../core/services/realtime/realtime.service';
import { REALTIME_TOPICS, RealtimeEvent } from '../../../../core/services/realtime/realtime.types';
import { RenderState } from '../../../../shared/dtos/administrative-document.dtos';
import {
  EntrySheetOut,
  ProcedureDetailOut,
  RenderPurpose,
  VersionStage,
} from '../../../../shared/dtos/administrative-procedure.dtos';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeDocumentService } from '../../../../shared/services/administrative-document.service';
import { AdministrativeProcedureService } from '../../../../shared/services/administrative-procedure.service';
import { procedureDetail } from '../procedure-fixtures';
import { ProcedureSendDialog } from './procedure-send-dialog';

/** Annex 6, rendered as its final: what a procedure looks like once the finals landed. */
function finalized(overrides: Partial<ProcedureDetailOut> = {}): ProcedureDetailOut {
  const detail = procedureDetail({ finals_ready: true, ...overrides });
  detail.pieces[1] = {
    ...detail.pieces[1],
    current_version: { ...detail.pieces[1].current_version!, stage: VersionStage.FINAL },
  };
  return detail;
}

const SHEET: EntrySheetOut = {
  piece_id: 22,
  code: 'community_modification',
  labels: { fr: 'Modification', en: 'Change to an energy community' },
  version: null,
  sections: [
    {
      labels: { fr: 'Référence', en: 'Reference' },
      fields: [
        { key: 'cwape_reference_digits', labels: { en: 'CWaPE reference' }, value: '0042' },
        { key: 'community_box', labels: { en: 'Box' }, value: null },
      ],
    },
  ],
};

describe('ProcedureSendDialog', () => {
  let fixture: ComponentFixture<ProcedureSendDialog>;
  let component: ProcedureSendDialog;
  let service: Record<string, ReturnType<typeof vi.fn>>;
  let close: ReturnType<typeof vi.fn>;
  let events: Subject<RealtimeEvent>;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byTestId = (id: string): HTMLElement | null =>
    root().querySelector(`[data-testid="${id}"]`);

  async function create(detail: ProcedureDetailOut = procedureDetail()): Promise<void> {
    service = {
      send: vi.fn(),
      finalize: vi.fn(),
      getProcedure: vi.fn(),
      getEntrySheets: vi.fn().mockReturnValue(of(new ApiResponse([SHEET]))),
      downloadFinals: vi.fn(),
      invalidate: vi.fn(),
    };
    close = vi.fn();
    events = new Subject<RealtimeEvent>();
    await TestBed.configureTestingModule({
      imports: [ProcedureSendDialog, TranslateModule.forRoot()],
      providers: [
        { provide: AdministrativeProcedureService, useValue: service },
        { provide: AdministrativeDocumentService, useValue: { downloadVersion: vi.fn() } },
        { provide: RealtimeService, useValue: { live: signal(true), on: () => events } },
        { provide: DynamicDialogRef, useValue: { close } },
        {
          provide: DynamicDialogConfig,
          useValue: { data: { detail, regulator: 'BE-WAL-CWAPE' } },
        },
        // English on purpose: the subject and body follow the reader's language.
        { provide: LocaleService, useValue: { locale: signal('en') } },
        { provide: SnackbarNotification, useValue: { openSnackBar: vi.fn() } },
      ],
    }).compileComponents();
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', en as unknown as TranslationObject);
    translate.use('en');

    fixture = TestBed.createComponent(ProcedureSendDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  describe('the message', () => {
    beforeEach(() => create());

    it('prepares the subject with the reference a reply must keep', () => {
      expect(component.subject).toBe('[OPT-12] Sharing modification — Op Centre');
    });

    it('prepares the body in the reader’s language, with the pieces to attach', () => {
      expect(component.body).toContain('Sharing modification (operation: Op Centre)');
      expect(component.body).toContain('Please quote the reference [OPT-12]');
      expect(component.body).toContain('- Annex 6');
      expect(component.body).not.toContain('Modification form'); // missing: nothing to attach
    });

    it('names the recipient and lists the pieces ready to attach', () => {
      expect(byTestId('procedure-send-dialog__recipient')?.textContent).toContain('ORES (DSO)');
      expect(byTestId('procedure-send-dialog__btn--download-22')).not.toBeNull();
      expect(byTestId('procedure-send-dialog__btn--download-21')).toBeNull();
    });
  });

  describe('the finals', () => {
    it('come first: drafts cannot be marked as sent', async () => {
      await create();

      expect(byTestId('procedure-send-dialog__btn--finalize')).not.toBeNull();
      expect(byTestId('procedure-send-dialog__btn--zip')).toBeNull();
      expect(
        byTestId('procedure-send-dialog__btn--submit')?.querySelector('button')?.disabled,
      ).toBe(true);
    });

    it('are rendered on request, then offered as one archive', async () => {
      await create();
      service['finalize'].mockReturnValue(of(new ApiResponse({ requested: [22], in_flight: [] })));
      service['getProcedure'].mockReturnValue(of(new ApiResponse(finalized())));

      byTestId('procedure-send-dialog__btn--finalize')?.querySelector('button')?.click();
      fixture.detectChanges();

      expect(service['finalize']).toHaveBeenCalledWith(12);
      expect(service['invalidate']).toHaveBeenCalled();
      expect(byTestId('procedure-send-dialog__btn--zip')).not.toBeNull();
      expect(
        byTestId('procedure-send-dialog__btn--submit')?.querySelector('button')?.disabled,
      ).toBe(false);
    });

    it('in flight are refetched when the annex says one landed', async () => {
      const rendering = procedureDetail();
      rendering.pieces[1] = {
        ...rendering.pieces[1],
        render: {
          state: RenderState.PENDING,
          purpose: RenderPurpose.RENDER,
          stage: VersionStage.FINAL,
          requested_at: '2026-10-30T10:00:00Z',
          error: null,
        },
      };
      await create(rendering);
      service['getProcedure'].mockReturnValue(of(new ApiResponse(finalized())));

      events.next({
        v: 1,
        id: 'x',
        topic: REALTIME_TOPICS.ADMIN_DOCUMENT_READY,
        at: '',
        scope: { community_id: 1 },
        ref: { kind: 'document', id: '22' },
        hint: { status: 'ready' },
      });
      fixture.detectChanges();

      expect(service['getProcedure']).toHaveBeenCalledWith(12);
      expect(component.finalsReady()).toBe(true);
    });

    it('hand back the procedure when the dialog closes unsent', async () => {
      await create();
      service['finalize'].mockReturnValue(of(new ApiResponse({ requested: [22], in_flight: [] })));
      const after = finalized();
      service['getProcedure'].mockReturnValue(of(new ApiResponse(after)));
      component.finalize();

      component.close();

      expect(close).toHaveBeenCalledWith(after);
    });
  });

  describe('the fiche de saisie', () => {
    beforeEach(() => create(finalized({ has_entry_sheet: true })));

    it('shows each value in the form’s order', () => {
      expect(service['getEntrySheets']).toHaveBeenCalledWith(12);
      expect(
        byTestId('procedure-send-dialog__sheet-value--cwape_reference_digits')?.textContent,
      ).toContain('0042');
      expect(byTestId('procedure-send-dialog__sheet-value--community_box')?.textContent).toContain(
        '—',
      );
    });

    it('copies a value, and the whole fiche as text', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      component.copyField(SHEET, SHEET.sections[0].fields[0]);
      component.copySheet(SHEET);
      await Promise.resolve();

      expect(writeText).toHaveBeenNthCalledWith(1, '0042');
      expect(writeText).toHaveBeenNthCalledWith(2, 'Reference\nCWaPE reference: 0042\nBox: ');
    });
  });

  describe('marking as sent', () => {
    beforeEach(() => create(finalized()));

    it('records the sending the way it was done, and closes with the procedure', () => {
      const after = procedureDetail({ step: 'sent', frozen_at: '2026-10-29T10:00:00Z' });
      service['send'].mockReturnValue(of(new ApiResponse(after)));
      const receipt = new File(['From: x'], 'sent.eml', { type: 'message/rfc822' });
      component.sentOn = new Date(2026, 9, 28);
      component.channel = 'online_form';
      component.file.set(receipt);

      component.submit();

      expect(service['send']).toHaveBeenCalledWith(12, {
        sent_on: '2026-10-28',
        channel: 'online_form',
        subject: '[OPT-12] Sharing modification — Op Centre',
        body_text: component.body.trim(),
        file: receipt,
      });
      expect(close).toHaveBeenCalledWith(after);
    });

    it('keeps a refusal about the procedure in the dialog', () => {
      service['send'].mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: { data: 'Generate the final versions first', error_code: 2385 },
            }),
        ),
      );
      component.submit();
      fixture.detectChanges();

      expect(component.formError()).toBe('Generate the final versions first');
      expect(close).not.toHaveBeenCalled();
    });
  });
});
