import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { TranslateModule, TranslateService, TranslationObject } from '@ngx-translate/core';
import { EMPTY, Subject, of } from 'rxjs';
import { vi } from 'vitest';

import fr from '../../../../../assets/i18n/fr.json';
import { ApiResponse } from '../../../../core/dtos/api.response';
import { LocaleService } from '../../../../core/services/language/locale.service';
import { RealtimeService } from '../../../../core/services/realtime/realtime.service';
import {
  REALTIME_RECONNECTED,
  REALTIME_TOPICS,
  RealtimeEvent,
  RealtimeSubscribable,
} from '../../../../core/services/realtime/realtime.types';
import {
  InboxOut,
  ProcedureModuleStatusOut,
} from '../../../../shared/dtos/administrative-procedure.dtos';
import { AdministrativeDocumentService } from '../../../../shared/services/administrative-document.service';
import { AdministrativeProcedureService } from '../../../../shared/services/administrative-procedure.service';
import { CommunityService } from '../../../../shared/services/community.service';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { deadlineItem, inbox, moduleStatus, procedureItem } from '../procedure-fixtures';
import { ProcedureDashboard } from './procedure-dashboard';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';

function event(topic: RealtimeSubscribable): RealtimeEvent {
  return {
    v: 1,
    id: topic,
    topic,
    at: '',
    scope: { community_id: 1 },
    ref: { kind: 'dossier', id: '12' },
    hint: {},
  };
}

describe('ProcedureDashboard', () => {
  let fixture: ComponentFixture<ProcedureDashboard>;
  let getInbox: ReturnType<typeof vi.fn>;
  let getStatus: ReturnType<typeof vi.fn>;
  let invalidate: ReturnType<typeof vi.fn>;
  let events: Subject<RealtimeEvent>;
  let topics: RealtimeSubscribable[];

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byTestId = (id: string): HTMLElement | null =>
    root().querySelector(`[data-testid="${id}"]`);

  async function setup(
    data: InboxOut,
    status: ProcedureModuleStatusOut = moduleStatus(),
    query: Record<string, string> = {},
  ): Promise<void> {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    events = new Subject<RealtimeEvent>();
    topics = [];
    getInbox = vi.fn().mockReturnValue(of(new ApiResponse(data)));
    getStatus = vi.fn().mockReturnValue(of(new ApiResponse(status)));
    invalidate = vi.fn();
    await TestBed.configureTestingModule({
      imports: [ProcedureDashboard, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap(query)) } },
        {
          provide: AdministrativeProcedureService,
          useValue: {
            getInbox,
            getStatus,
            invalidate,
            // The reception address is off here: the hub shows none.
            getInboundAddress: () => of(new ApiResponse({ enabled: false, address: null })),
            // The summary email's card has its own spec.
            getDigestSettings: () => EMPTY,
          },
        },
        { provide: CommunityService, useValue: { getAdmins: () => EMPTY } },
        { provide: UserContextService, useValue: { compareWithActiveRole: () => false } },
        {
          provide: AdministrativeDocumentService,
          useValue: { listSharingOperations: vi.fn().mockReturnValue(of(new ApiResponse([]))) },
        },
        {
          provide: RealtimeService,
          useValue: {
            live: signal(true),
            // The dashboard's own subscription is the first; the reception
            // address panel subscribes after it.
            on: (...asked: RealtimeSubscribable[]) => {
              if (topics.length === 0) topics = asked;
              return events;
            },
          },
        },
        { provide: LocaleService, useValue: { locale: signal('fr') } },
        { provide: SnackbarNotification, useValue: { openSnackBar: vi.fn() } },
      ],
    }).compileComponents();
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('fr', fr as unknown as TranslationObject);
    translate.use('fr');

    fixture = TestBed.createComponent(ProcedureDashboard);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('shows the next action and its due date without opening the procedure (criterion 1.5)', async () => {
    const waiting = procedureItem({
      id: 12,
      bucket: 'waiting',
      step: 'sent',
      next_action: { code: 'record_response', labels: { fr: 'Réponse du GRD attendue' } },
      next_action_due: '2026-11-26',
      due_in_working_days: 20,
      pieces_ready: 2,
    });
    await setup(inbox({ groups: { todo: [], waiting: [waiting], planned: [], done: [] } }));

    const row = byTestId('procedure-dashboard__row--12');
    expect(
      row?.querySelector('[data-testid="procedure-dashboard__row-title"]')?.textContent,
    ).toContain('Réponse du GRD attendue');
    expect(
      row?.querySelector('[data-testid="procedure-dashboard__row-due"]')?.textContent?.trim(),
    ).toBe('dans 20 jours ouvrables');
    expect(row?.textContent).toContain('Op Centre');
    expect(row?.textContent).toContain('ORES (GRD)');
    expect(row?.textContent).toContain('pièces 2/2');
    expect(byTestId('procedure-dashboard__btn--action-12')?.textContent).toContain(
      'Ajouter une réponse',
    );
  });

  it('groups in the spec’s order and hides an empty group', async () => {
    await setup(
      inbox({
        groups: {
          todo: [procedureItem({ id: 1 })],
          waiting: [],
          planned: [procedureItem({ id: 2, bucket: 'planned' })],
          done: [procedureItem({ id: 3, bucket: 'done' })],
        },
      }),
    );
    const groups = [...root().querySelectorAll('[data-testid^="procedure-dashboard__group--"]')];
    expect(groups.map((g) => g.getAttribute('data-testid'))).toEqual([
      'procedure-dashboard__group--todo',
      'procedure-dashboard__group--planned',
      'procedure-dashboard__group--done',
    ]);
    expect(groups[0].textContent).toContain('À faire · 1');
  });

  it('puts the banner’s past deadlines first, in red', async () => {
    await setup(
      inbox({
        banner: [
          deadlineItem({ id: 1, overdue: true, due_in_working_days: -2 }),
          deadlineItem({ id: 2, due_in_working_days: 3 }),
        ],
      }),
    );
    const first = byTestId('procedure-dashboard__banner--0');
    expect(first?.className).toContain('border-red-300');
    expect(first?.textContent).toContain('en retard de 2 jours ouvrables');
    expect(first?.textContent).toContain('Contrôle du GRD');
    expect(byTestId('procedure-dashboard__banner--1')?.className).not.toContain('border-red-300');
  });

  it('says when the regulator has no plugin: nothing is tracked (criterion 1.9)', async () => {
    await setup(
      inbox(),
      moduleStatus({ regulator: 'BE-BRU-BRUGEL', supported: false, baseline: null }),
    );
    expect(byTestId('procedure-dashboard__message--unsupported')?.textContent).toContain(
      'Brugel (Bruxelles)',
    );
  });

  it('asks to confirm the starting state while it is pending (criterion 1.8)', async () => {
    await setup(inbox(), moduleStatus({ baseline: 'pending' }));
    expect(byTestId('procedure-dashboard__message--baseline')).not.toBeNull();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    byTestId('procedure-dashboard__btn--baseline')?.querySelector('button')?.click();
    expect(navigate).toHaveBeenCalledWith(['/administrative-document/baseline']);
  });

  it('says there is nothing to do when every group is empty', async () => {
    await setup(inbox());
    expect(byTestId('procedure-dashboard__empty')).not.toBeNull();
  });

  describe('the one button', () => {
    beforeEach(async () => {
      await setup(inbox());
    });

    it('opens the send dialog on the detail', () => {
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      fixture.componentInstance.act(
        procedureItem({ id: 5, next_action: { code: 'send', labels: null } }),
      );
      expect(navigate).toHaveBeenCalledWith(['/administrative-document/procedures', 5], {
        queryParams: { action: 'send' },
      });
    });

    it('scrolls to the pieces when they are what is missing', () => {
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      fixture.componentInstance.act(procedureItem({ id: 5 }));
      expect(navigate).toHaveBeenCalledWith(['/administrative-document/procedures', 5], {
        fragment: 'pieces',
      });
    });
  });

  it('filters by operation and GRD, and keeps offering the GRDs seen unfiltered', async () => {
    await setup(
      inbox({
        groups: {
          todo: [
            procedureItem({ id: 1, grd_ref: 'resa' }),
            procedureItem({ id: 2, grd_ref: 'ores' }),
          ],
          waiting: [],
          planned: [],
          done: [],
        },
      }),
    );
    const component = fixture.componentInstance;
    component.grdFilter = 'ores';
    component.operationFilter = 3;
    getInbox.mockReturnValue(of(new ApiResponse(inbox())));
    component.applyFilters();

    expect(getInbox).toHaveBeenLastCalledWith({ operation_id: 3, grd: 'ores' });
    expect(component.grdOptions().map((o) => o.value)).toEqual(['ores', 'resa']);
  });

  it('opens filtered on the operation a sharing operation’s link names', async () => {
    await setup(inbox(), moduleStatus(), { id_sharing_operation: '2' });

    expect(getInbox).toHaveBeenCalledTimes(1);
    expect(getInbox).toHaveBeenCalledWith({ operation_id: 2 });
    expect(fixture.componentInstance.operationFilter).toBe(2);
  });

  it('refetches, fresh, on a hint and on a reconnect, once per burst', async () => {
    await setup(inbox());
    expect(topics).toEqual([
      REALTIME_TOPICS.ADMIN_CHANGE_DETECTED,
      REALTIME_TOPICS.ADMIN_DOSSIER_UPDATED,
      REALTIME_TOPICS.ADMIN_DEADLINE_DUE,
      REALTIME_RECONNECTED,
    ]);
    getInbox.mockClear();

    events.next(event(REALTIME_TOPICS.ADMIN_CHANGE_DETECTED));
    events.next(event(REALTIME_TOPICS.ADMIN_DOSSIER_UPDATED));
    events.next(event(REALTIME_RECONNECTED));
    await vi.advanceTimersByTimeAsync(500);

    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(getInbox).toHaveBeenCalledTimes(1);
  });
});
