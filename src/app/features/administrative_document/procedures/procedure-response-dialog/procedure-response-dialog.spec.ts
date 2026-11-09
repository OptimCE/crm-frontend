import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService, TranslationObject } from '@ngx-translate/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';

import fr from '../../../../../assets/i18n/fr.json';
import { ApiResponse } from '../../../../core/dtos/api.response';
import { LocaleService } from '../../../../core/services/language/locale.service';
import {
  ChangeSubjectType,
  CorrespondenceProposalOut,
  DeadlineKind,
  DeadlineParty,
  RegulatoryStatus,
} from '../../../../shared/dtos/administrative-procedure.dtos';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeProcedureService } from '../../../../shared/services/administrative-procedure.service';
import { procedureDetail } from '../procedure-fixtures';
import { ProcedureResponseDialog } from './procedure-response-dialog';

function proposal(overrides: Partial<CorrespondenceProposalOut> = {}): CorrespondenceProposalOut {
  return {
    type: 'incomplete_notice',
    labels: { fr: 'Demande de compléments' },
    direction: 'inbound',
    from_step: 'sent',
    to_step: 'incomplete',
    to_step_labels: { fr: 'Incomplet' },
    transition_allowed: true,
    deadlines_started: [
      {
        code: 'lapse',
        labels: { fr: 'Compléments avant caducité' },
        due_date: '2027-04-29',
        party: DeadlineParty.COMMUNITY,
        kind: DeadlineKind.LAPSE,
      },
    ],
    deadlines_met: [],
    ...overrides,
  };
}

describe('ProcedureResponseDialog', () => {
  let fixture: ComponentFixture<ProcedureResponseDialog>;
  let component: ProcedureResponseDialog;
  let previewResponse: ReturnType<typeof vi.fn>;
  let recordResponse: ReturnType<typeof vi.fn>;
  let close: ReturnType<typeof vi.fn>;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byTestId = (id: string): HTMLElement | null =>
    root().querySelector(`[data-testid="${id}"]`);

  beforeEach(async () => {
    previewResponse = vi.fn().mockReturnValue(of(new ApiResponse(proposal())));
    recordResponse = vi.fn();
    close = vi.fn();
    // Sent: a request for additional information is recorded now.
    const detail = procedureDetail({ step: 'sent', frozen_at: '2026-10-20T10:00:00Z' });
    await TestBed.configureTestingModule({
      imports: [ProcedureResponseDialog, TranslateModule.forRoot()],
      providers: [
        { provide: AdministrativeProcedureService, useValue: { previewResponse, recordResponse } },
        { provide: DynamicDialogRef, useValue: { close } },
        { provide: DynamicDialogConfig, useValue: { data: { detail } } },
        { provide: LocaleService, useValue: { locale: signal('fr') } },
        { provide: SnackbarNotification, useValue: { openSnackBar: vi.fn() } },
      ],
    }).compileComponents();
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('fr', fr as unknown as TranslationObject);
    translate.use('fr');

    fixture = TestBed.createComponent(ProcedureResponseDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function choose(type: string): void {
    component.type = type;
    component.occurredOn = new Date(2026, 9, 29);
    component.onInputsChange();
    fixture.detectChanges();
  }

  it('cannot be recorded before the consequence is known', () => {
    expect(component.canSubmit()).toBe(false);
  });

  it('shows what recording it will do BEFORE confirming, from a dry run', () => {
    choose('incomplete_notice');

    expect(previewResponse).toHaveBeenCalledWith(12, {
      type: 'incomplete_notice',
      occurred_on: '2026-10-29',
    });
    expect(recordResponse).not.toHaveBeenCalled();
    expect(byTestId('procedure-response-dialog__will-move')?.textContent).toContain(
      "La démarche passera à l'étape « Incomplet ».",
    );
    expect(byTestId('procedure-response-dialog__will-start')?.textContent).toContain(
      'Compléments avant caducité (La communauté), pour le 29/04/2027',
    );
    expect(component.canSubmit()).toBe(true);
  });

  it('says when it takes effect and what the CRM will show, before confirming', () => {
    previewResponse.mockReturnValue(
      of(
        new ApiResponse(
          proposal({
            effective_date: '2026-11-27',
            effects: [
              {
                subject_type: ChangeSubjectType.METER,
                subject_ref: '541448000000000001',
                regulatory_status: RegulatoryStatus.AUTHORIZED,
                valid_from: '2026-11-27',
                valid_to: null,
              },
            ],
          }),
        ),
      ),
    );

    choose('incomplete_notice');

    expect(byTestId('procedure-response-dialog__will-take-effect')?.textContent).toContain(
      "Prise d'effet prévue le 27/11/2026.",
    );
    const effects = byTestId('procedure-response-dialog__effects')?.textContent ?? '';
    expect(effects).toContain('541448000000000001');
    expect(effects).toContain('Autorisé, effet le 27/11/2026');
  });

  it('refuses one the current step does not allow, and says so', () => {
    previewResponse.mockReturnValue(
      of(new ApiResponse(proposal({ transition_allowed: false, deadlines_started: [] }))),
    );
    choose('incomplete_notice');

    expect(byTestId('procedure-response-dialog__consequence')?.textContent).toContain(
      "ne correspond pas à l'étape actuelle",
    );
    expect(component.canSubmit()).toBe(false);
  });

  it('keeps only the latest answer when the type changes mid-flight', () => {
    const first = new Subject<ApiResponse<CorrespondenceProposalOut>>();
    previewResponse.mockReturnValueOnce(first);
    choose('incomplete_notice');
    previewResponse.mockReturnValueOnce(
      of(new ApiResponse(proposal({ type: 'receipt', to_step: null }))),
    );
    choose('receipt');

    first.next(new ApiResponse(proposal()));
    fixture.detectChanges();

    expect(component.proposal()?.type).toBe('receipt');
  });

  it('records it with the message and closes with the procedure as it now is', () => {
    choose('incomplete_notice');
    const after = procedureDetail({ step: 'incomplete' });
    recordResponse.mockReturnValue(of(new ApiResponse(after)));
    component.subject = '  Compléments demandés ';
    component.externalRef = 'PA0042';

    component.submit();

    expect(recordResponse).toHaveBeenCalledWith(12, {
      type: 'incomplete_notice',
      occurred_on: '2026-10-29',
      subject: 'Compléments demandés',
      body_text: null,
      external_ref: 'PA0042',
      file: null,
    });
    expect(close).toHaveBeenCalledWith(after);
  });

  it('lists the types the step allows first, the others disabled', () => {
    expect(component.typeOptions.map((o) => [o.value, o.disabled])).toEqual([
      ['receipt', false],
      ['incomplete_notice', true],
    ]);
  });
});
