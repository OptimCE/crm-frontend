import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService, TranslationObject } from '@ngx-translate/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import en from '../../../../../assets/i18n/en.json';
import { ApiResponse } from '../../../../core/dtos/api.response';
import { LocaleService } from '../../../../core/services/language/locale.service';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeDocumentService } from '../../../../shared/services/administrative-document.service';
import { AdministrativeProcedureService } from '../../../../shared/services/administrative-procedure.service';
import { procedureDetail } from '../procedure-fixtures';
import { ProcedureSendDialog } from './procedure-send-dialog';

describe('ProcedureSendDialog', () => {
  let fixture: ComponentFixture<ProcedureSendDialog>;
  let component: ProcedureSendDialog;
  let send: ReturnType<typeof vi.fn>;
  let close: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    send = vi.fn();
    close = vi.fn();
    await TestBed.configureTestingModule({
      imports: [ProcedureSendDialog, TranslateModule.forRoot()],
      providers: [
        { provide: AdministrativeProcedureService, useValue: { send } },
        { provide: AdministrativeDocumentService, useValue: { downloadVersion: vi.fn() } },
        { provide: DynamicDialogRef, useValue: { close } },
        {
          provide: DynamicDialogConfig,
          useValue: { data: { detail: procedureDetail(), regulator: 'BE-WAL-CWAPE' } },
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
  });

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
    const root = fixture.nativeElement as HTMLElement;
    expect(
      root.querySelector('[data-testid="procedure-send-dialog__recipient"]')?.textContent,
    ).toContain('ORES (DSO)');
    expect(
      root.querySelector('[data-testid="procedure-send-dialog__btn--download-22"]'),
    ).not.toBeNull();
    expect(
      root.querySelector('[data-testid="procedure-send-dialog__btn--download-21"]'),
    ).toBeNull();
  });

  it('marks it as sent the way it was done, and closes with the procedure', () => {
    const after = procedureDetail({ step: 'sent', frozen_at: '2026-10-29T10:00:00Z' });
    send.mockReturnValue(of(new ApiResponse(after)));
    const receipt = new File(['From: x'], 'sent.eml', { type: 'message/rfc822' });
    component.sentOn = new Date(2026, 9, 28);
    component.channel = 'online_form';
    component.file.set(receipt);

    component.submit();

    expect(send).toHaveBeenCalledWith(12, {
      sent_on: '2026-10-28',
      channel: 'online_form',
      subject: '[OPT-12] Sharing modification — Op Centre',
      body_text: component.body.trim(),
      file: receipt,
    });
    expect(close).toHaveBeenCalledWith(after);
  });

  it('keeps a refusal about the procedure in the dialog', () => {
    send.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { data: 'Not ready to be sent', error_code: 2379 },
          }),
      ),
    );
    component.submit();
    fixture.detectChanges();

    expect(component.formError()).toBe('Not ready to be sent');
    expect(close).not.toHaveBeenCalled();
  });
});
