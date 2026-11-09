import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService, TranslationObject } from '@ngx-translate/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import fr from '../../../../../assets/i18n/fr.json';
import { ApiResponse } from '../../../../core/dtos/api.response';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeProcedureService } from '../../../../shared/services/administrative-procedure.service';
import { procedureDetail } from '../procedure-fixtures';
import { threadLine } from '../procedure-format';
import { ProcedureEffectiveDateDialog } from './procedure-effective-date-dialog';

describe('ProcedureEffectiveDateDialog (phase 4)', () => {
  let fixture: ComponentFixture<ProcedureEffectiveDateDialog>;
  let component: ProcedureEffectiveDateDialog;
  let correctEffectiveDate: ReturnType<typeof vi.fn>;
  let close: ReturnType<typeof vi.fn>;

  const detail = procedureDetail({
    step: 'amendment_signed',
    effective_date: '2026-11-27',
    effective_date_correctable: true,
  });
  const byTestId = (id: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);

  beforeEach(async () => {
    correctEffectiveDate = vi.fn();
    close = vi.fn();
    await TestBed.configureTestingModule({
      imports: [ProcedureEffectiveDateDialog, TranslateModule.forRoot()],
      providers: [
        { provide: AdministrativeProcedureService, useValue: { correctEffectiveDate } },
        { provide: DynamicDialogRef, useValue: { close } },
        { provide: DynamicDialogConfig, useValue: { data: { detail } } },
        { provide: SnackbarNotification, useValue: { openSnackBar: vi.fn() } },
      ],
    }).compileComponents();
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('fr', fr as unknown as TranslationObject);
    translate.use('fr');

    fixture = TestBed.createComponent(ProcedureEffectiveDateDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('starts from the effect date counted', () => {
    expect(component.on).toEqual(new Date(2026, 10, 27));
  });

  it('asks for a reason before sending anything', () => {
    component.submit();
    fixture.detectChanges();

    expect(correctEffectiveDate).not.toHaveBeenCalled();
    expect(byTestId('procedure-effective-date-dialog__error')?.textContent).toContain(
      'Indiquez la date et le motif',
    );
  });

  it('sends the date and the reason, and hands the detail back', () => {
    const updated = { ...detail, effective_date: '2026-12-04' };
    correctEffectiveDate.mockReturnValue(of(new ApiResponse(updated)));
    component.on = new Date(2026, 11, 4);
    component.reason = '  Avenant reçu le 7  ';

    component.submit();

    expect(correctEffectiveDate).toHaveBeenCalledWith(detail.id, {
      on: '2026-12-04',
      reason: 'Avenant reçu le 7',
    });
    expect(close).toHaveBeenCalledWith(updated);
  });

  it('says so when the effect is no longer to come', () => {
    correctEffectiveDate.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: {
              error_code: 2397,
              data: "La date d'effet ne se corrige que tant qu'elle est à venir",
            },
          }),
      ),
    );
    component.reason = 'Avenant';

    component.submit();
    fixture.detectChanges();

    expect(byTestId('procedure-effective-date-dialog__error')?.textContent).toContain('tant qu');
    expect(close).not.toHaveBeenCalled();
  });

  it('the thread says from which day to which, with the reason', () => {
    const line = threadLine(
      {
        at: '2026-11-02T10:00:00Z',
        kind: 'effective_date',
        actor: 'user-1',
        from_step: null,
        to_step: null,
        reason: 'Avenant reçu le 7',
        id_correspondence: null,
        type: null,
        direction: null,
        subject: null,
        has_file: false,
        id_document: null,
        version_no: null,
        effective_date: '2026-12-04',
        previous_effective_date: '2026-11-27',
      },
      detail,
      'fr',
    );
    expect(line.icon).toBe('pi pi-calendar');
    expect(line.text).toEqual({
      key: 'ADMINISTRATIVE_DOCUMENT.PROCEDURES.THREAD.EFFECTIVE_DATE',
      params: { from: '27/11/2026', to: '04/12/2026' },
    });
    expect(line.note).toBe('Avenant reçu le 7');
  });
});
