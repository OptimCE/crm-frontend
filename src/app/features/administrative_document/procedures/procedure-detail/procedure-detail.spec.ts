import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { TranslateModule, TranslateService, TranslationObject } from '@ngx-translate/core';
import { Confirmation, ConfirmationService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import fr from '../../../../../assets/i18n/fr.json';
import { ApiResponse } from '../../../../core/dtos/api.response';
import { LocaleService } from '../../../../core/services/language/locale.service';
import { RealtimeService } from '../../../../core/services/realtime/realtime.service';
import { REALTIME_TOPICS, RealtimeEvent } from '../../../../core/services/realtime/realtime.types';
import {
  ChangeStatus,
  ProcedureDetailOut,
  ProcedureStatus,
  RegulatoryStatus,
} from '../../../../shared/dtos/administrative-procedure.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeDocumentService } from '../../../../shared/services/administrative-document.service';
import { AdministrativeProcedureService } from '../../../../shared/services/administrative-procedure.service';
import { SignatureService } from '../../../../shared/services/signature.service';
import { modifDefinition, moduleStatus, procedureDetail } from '../procedure-fixtures';
import { ProcedureSendDialog } from '../procedure-send-dialog/procedure-send-dialog';
import { ProcedureDetail } from './procedure-detail';

describe('ProcedureDetail', () => {
  let fixture: ComponentFixture<ProcedureDetail>;
  let service: Record<string, ReturnType<typeof vi.fn>>;
  let dialogOpen: ReturnType<typeof vi.fn>;
  let confirmation: ConfirmationService;
  let events: Subject<RealtimeEvent>;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byTestId = (id: string): HTMLElement | null =>
    root().querySelector(`[data-testid="${id}"]`);

  async function setup(
    detail: ProcedureDetailOut | HttpErrorResponse = procedureDetail(),
    query: Record<string, string> = {},
  ): Promise<void> {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    events = new Subject<RealtimeEvent>();
    service = {
      getProcedure: vi
        .fn()
        .mockReturnValue(
          detail instanceof HttpErrorResponse
            ? throwError(() => detail)
            : of(new ApiResponse(detail)),
        ),
      getStatus: vi.fn().mockReturnValue(of(new ApiResponse(moduleStatus()))),
      listDefinitions: vi.fn().mockReturnValue(of(new ApiResponse([modifDefinition()]))),
      deferChange: vi.fn(),
      refile: vi.fn().mockReturnValue(of(new ApiResponse({ id_dossier: 31, changes: [41] }))),
      invalidate: vi.fn(),
    };
    dialogOpen = vi.fn().mockReturnValue({ onClose: new Subject(), destroy: vi.fn() });
    confirmation = new ConfirmationService();
    vi.spyOn(confirmation, 'confirm').mockImplementation((c: Confirmation) => {
      c.accept?.();
      return confirmation;
    });

    await TestBed.configureTestingModule({
      imports: [ProcedureDetail, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: '12' })),
            snapshot: { queryParamMap: convertToParamMap(query) },
          },
        },
        { provide: AdministrativeProcedureService, useValue: service },
        { provide: AdministrativeDocumentService, useValue: {} },
        // The pieces panel downloads a signed piece's evidence from the signature annexe.
        { provide: SignatureService, useValue: { downloadArtifact: vi.fn() } },
        { provide: RealtimeService, useValue: { live: signal(true), on: () => events } },
        { provide: SnackbarNotification, useValue: { openSnackBar: vi.fn() } },
      ],
    })
      .overrideComponent(ProcedureDetail, {
        set: {
          providers: [
            { provide: DialogService, useValue: { open: dialogOpen } },
            { provide: ConfirmationService, useValue: confirmation },
            ErrorMessageHandler,
          ],
        },
      })
      .compileComponents();
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('fr', fr as unknown as TranslationObject);
    translate.use('fr');
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    // The real one: it registers the CLDR data the page's dates need.
    TestBed.inject(LocaleService);

    fixture = TestBed.createComponent(ProcedureDetail);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('heads with the type, the step, the recipient and the route', async () => {
    await setup();
    expect(byTestId('procedure-detail__title')?.textContent).toContain('Modification du partage');
    expect(byTestId('procedure-detail__tag--step')?.textContent).toContain('Brouillon');
    expect(byTestId('procedure-detail__recipient')?.textContent).toContain('ORES (GRD)');
    expect(byTestId('procedure-detail__route')?.textContent).toContain('Simple');
  });

  it('draws the path with each step’s legal delay, from the catalogue', async () => {
    await setup();
    const sent = byTestId('procedure-detail__step--sent');
    expect(sent?.textContent).toContain('Envoyé');
    expect(sent?.textContent).toContain('Contrôle du GRD : 20 j. ouvr.');
    expect(byTestId('procedure-detail__step--draft')?.getAttribute('aria-current')).toBe('step');
    // A dead end the procedure never took is noise; the path's end is not.
    expect(byTestId('procedure-detail__step--cancelled')).toBeNull();
    expect(byTestId('procedure-detail__step--in_force')).not.toBeNull();
  });

  it('offers ONE primary action, the next one', async () => {
    await setup();
    expect(byTestId('procedure-detail__btn--primary')?.textContent).toContain(
      'Compléter les pièces',
    );
  });

  it('offers none once finished', async () => {
    await setup(procedureDetail({ status: ProcedureStatus.IN_FORCE, step: 'in_force' }));
    expect(byTestId('procedure-detail__btn--primary')).toBeNull();
  });

  it('opens the send dialog a dashboard button asked for, with the procedure', async () => {
    await setup(
      procedureDetail({
        status: ProcedureStatus.READY,
        next_action: { code: 'send', labels: null },
      }),
      { action: 'send' },
    );
    expect(dialogOpen).toHaveBeenCalledTimes(1);
    const [component, config] = dialogOpen.mock.calls[0] as [
      unknown,
      { data: { detail: ProcedureDetailOut; regulator: string } },
    ];
    expect(component).toBe(ProcedureSendDialog);
    expect(config.data.detail.id).toBe(12);
    expect(config.data.regulator).toBe('BE-WAL-CWAPE');
  });

  it('defers a change and shows the procedure the annex returns', async () => {
    await setup();
    const after = procedureDetail({
      changes: [{ ...procedureDetail().changes[0], status: ChangeStatus.DEFERRED }],
    });
    service['deferChange'].mockReturnValue(of(new ApiResponse(after)));

    byTestId('procedure-detail__btn--defer-7')?.querySelector('button')?.click();
    fixture.detectChanges();

    expect(service['deferChange']).toHaveBeenCalledWith(12, 7);
    expect(byTestId('procedure-detail__btn--defer-7')).toBeNull();
    expect(byTestId('procedure-detail__change--7')?.textContent).toContain('Reporté');
  });

  it('takes no defer or exclude once sent, and says it is frozen', async () => {
    await setup(procedureDetail({ frozen_at: '2026-10-29T10:00:00Z' }));
    expect(byTestId('procedure-detail__btn--defer-7')).toBeNull();
    expect(byTestId('procedure-detail__btn--exclude-7')).toBeNull();
    expect(byTestId('procedure-detail__message--frozen')).not.toBeNull();
  });

  it('shows the thread newest first', async () => {
    await setup();
    const kinds = [
      ...root().querySelectorAll('[data-testid^="procedure-detail__thread-entry--"]'),
    ].map((e) => e.getAttribute('data-testid'));
    expect(kinds).toEqual([
      'procedure-detail__thread-entry--correspondence',
      'procedure-detail__thread-entry--step',
    ]);
  });

  it('shows what the CRM shows of each change: its regulatory badge', async () => {
    const base = procedureDetail();
    await setup(
      procedureDetail({
        changes: [
          {
            ...base.changes[0],
            regulatory_status: RegulatoryStatus.LEAVING,
            valid_from: '2025-06-01',
            valid_to: '2026-11-30',
          },
        ],
      }),
    );
    expect(byTestId('procedure-detail__regulatory--7')?.textContent).toContain(
      "Sortie prévue, actif jusqu'au 30/11/2026",
    );
  });

  it('after a refusal, offers to withdraw in the CRM or to correct and refile', async () => {
    const base = procedureDetail();
    await setup(
      procedureDetail({
        status: ProcedureStatus.REFUSED,
        step: 'refused',
        changes: [
          {
            ...base.changes[0],
            kind: 'meter_added',
            status: ChangeStatus.REFUSED,
            regulatory_status: RegulatoryStatus.REFUSED,
            in_operation: true,
          },
        ],
        refusal: { changes: [7], id_sharing_operation: 3, draft_id: null },
      }),
    );

    expect(byTestId('procedure-detail__refusal')?.textContent).toContain('1 élément(s)');
    expect(byTestId('procedure-detail__link--withdraw')?.getAttribute('href')).toBe(
      '/sharing_operations/3',
    );
    expect(byTestId('procedure-detail__regulatory--7')?.textContent).toContain('Refusé');

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    byTestId('procedure-detail__btn--refile')?.querySelector('button')?.click();
    await fixture.whenStable();

    expect(service['refile']).toHaveBeenCalledWith(12);
    expect(navigate).toHaveBeenCalledWith(['/administrative-document/procedures', 31]);
  });

  it('says a change refiled elsewhere, and one withdrawn from the CRM', async () => {
    const base = procedureDetail();
    await setup(
      procedureDetail({
        status: ProcedureStatus.REFUSED,
        step: 'refused',
        changes: [
          {
            ...base.changes[0],
            status: ChangeStatus.REFUSED,
            refiled_into: 31,
            in_operation: false,
          },
        ],
        refusal: null,
      }),
    );

    expect(byTestId('procedure-detail__refusal')).toBeNull();
    expect(byTestId('procedure-detail__link--refiled-7')?.getAttribute('href')).toBe(
      '/administrative-document/procedures/31',
    );
    expect(byTestId('procedure-detail__change--7')?.textContent).toContain('retiré du CRM');
  });

  it('says a blocked effect date, and which meters block it', async () => {
    await setup(
      procedureDetail({
        effect_error: {
          kind: 'in_force',
          code: 'exclude',
          subjects: ['541448000000000009'],
          at: '2026-11-02T05:00:00Z',
        },
      }),
    );
    const message = byTestId('procedure-detail__message--effect-error')?.textContent ?? '';
    expect(message).toContain("La prise d'effet est bloquée");
    expect(message).toContain('541448000000000009');
  });

  it('says a procedure of another community is not found', async () => {
    await setup(new HttpErrorResponse({ status: 404 }));
    expect(byTestId('procedure-detail__not-found')).not.toBeNull();
  });

  it('refetches on a hint about this procedure, not another one', async () => {
    await setup();
    service['getProcedure'].mockClear();
    const hint = (id: string): RealtimeEvent => ({
      v: 1,
      id,
      topic: REALTIME_TOPICS.ADMIN_DOSSIER_UPDATED,
      at: '',
      scope: { community_id: 1 },
      ref: { kind: 'dossier', id },
      hint: {},
    });

    events.next(hint('99'));
    await vi.advanceTimersByTimeAsync(500);
    expect(service['getProcedure']).not.toHaveBeenCalled();

    events.next(hint('12'));
    await vi.advanceTimersByTimeAsync(500);
    expect(service['invalidate']).toHaveBeenCalled();
    expect(service['getProcedure']).toHaveBeenCalledWith(12);
  });
});
