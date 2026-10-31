import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService, TranslationObject } from '@ngx-translate/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { throwError } from 'rxjs';
import { vi } from 'vitest';

import fr from '../../../../../assets/i18n/fr.json';
import { LocaleService } from '../../../../core/services/language/locale.service';
import { ProcedureStatus } from '../../../../shared/dtos/administrative-procedure.dtos';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeProcedureService } from '../../../../shared/services/administrative-procedure.service';
import { MODIF_LABELS, procedureDetail } from '../procedure-fixtures';
import { ProcedureTransitionDialog } from './procedure-transition-dialog';

describe('ProcedureTransitionDialog', () => {
  let fixture: ComponentFixture<ProcedureTransitionDialog>;
  let component: ProcedureTransitionDialog;
  let transition: ReturnType<typeof vi.fn>;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byTestId = (id: string): HTMLElement | null =>
    root().querySelector(`[data-testid="${id}"]`);

  beforeEach(async () => {
    transition = vi.fn();
    // Signed: the only edge left is the one into force (normally the effect job's).
    const base = procedureDetail();
    const detail = procedureDetail({
      step: 'amendment_signed',
      timeline: [
        ...base.timeline,
        {
          code: 'in_force',
          status: ProcedureStatus.IN_FORCE,
          bucket: 'done',
          labels: MODIF_LABELS,
          current: false,
          visited: false,
        },
      ],
      transitions: [{ to_step: 'in_force', labels: { fr: 'En vigueur' }, automatic: true }],
    });
    await TestBed.configureTestingModule({
      imports: [ProcedureTransitionDialog, TranslateModule.forRoot()],
      providers: [
        { provide: AdministrativeProcedureService, useValue: { transition } },
        { provide: DynamicDialogRef, useValue: { close: vi.fn() } },
        { provide: DynamicDialogConfig, useValue: { data: { detail } } },
        { provide: LocaleService, useValue: { locale: signal('fr') } },
        { provide: SnackbarNotification, useValue: { openSnackBar: vi.fn() } },
      ],
    }).compileComponents();
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('fr', fr as unknown as TranslationObject);
    translate.use('fr');

    fixture = TestBed.createComponent(ProcedureTransitionDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('into force, asks for the effect date and says the CRM goes first', () => {
    component.toStep = 'in_force';
    fixture.detectChanges();

    expect(root().textContent).toContain("Date de prise d'effet");
    expect(byTestId('procedure-transition-dialog__hint--in-force')?.textContent).toContain(
      "Le CRM est mis à jour d'abord",
    );
  });

  it('lists the meters the core refused, and stays open', () => {
    transition.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: {
              data: 'Le CRM refuse la prise d’effet',
              error_code: 2391,
              conflicts: ['541448000000000001'],
            },
          }),
      ),
    );
    component.toStep = 'in_force';
    component.reason = 'GRD confirmed by phone';

    component.submit();
    fixture.detectChanges();

    expect(component.conflicts()).toEqual(['541448000000000001']);
    expect(byTestId('procedure-transition-dialog__conflicts')?.textContent).toContain(
      '541448000000000001',
    );
    expect(component.submitting()).toBe(false);
  });
});
