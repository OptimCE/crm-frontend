import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule, TranslateService, TranslationObject } from '@ngx-translate/core';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';

import fr from '../../../../../assets/i18n/fr.json';
import { ApiResponse } from '../../../../core/dtos/api.response';
import { LocaleService } from '../../../../core/services/language/locale.service';
import { RealtimeService } from '../../../../core/services/realtime/realtime.service';
import { REALTIME_TOPICS, RealtimeEvent } from '../../../../core/services/realtime/realtime.types';
import { ProcedureDeadlineStatus } from '../../../../shared/dtos/administrative-procedure.dtos';
import { AdministrativeProcedureService } from '../../../../shared/services/administrative-procedure.service';
import { deadlineItem } from '../../procedures/procedure-fixtures';
import { DeadlineDashboard } from './deadline-dashboard';

describe('DeadlineDashboard (the agenda)', () => {
  let fixture: ComponentFixture<DeadlineDashboard>;
  let component: DeadlineDashboard;
  let listDeadlines: ReturnType<typeof vi.fn>;
  let invalidate: ReturnType<typeof vi.fn>;
  let events: Subject<RealtimeEvent>;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    events = new Subject<RealtimeEvent>();
    listDeadlines = vi
      .fn()
      .mockReturnValue(
        of(
          new ApiResponse([
            deadlineItem({ id: 1, due_date: '2026-10-20', due_in_working_days: -7, overdue: true }),
            deadlineItem({ id: 2 }),
          ]),
        ),
      );
    invalidate = vi.fn();
    await TestBed.configureTestingModule({
      imports: [DeadlineDashboard, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: AdministrativeProcedureService, useValue: { listDeadlines, invalidate } },
        { provide: RealtimeService, useValue: { live: signal(true), on: () => events } },
        { provide: LocaleService, useValue: { locale: signal('fr') } },
      ],
    }).compileComponents();

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('fr', fr as unknown as TranslationObject);
    translate.use('fr');

    fixture = TestBed.createComponent(DeadlineDashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => vi.useRealTimers());

  it('lists what is still owed by default: no period sent', () => {
    expect(listDeadlines).toHaveBeenCalledWith({});
    expect(
      root().querySelector('[data-testid="deadline-dashboard__row--1"]')?.textContent,
    ).toContain('dans 20 jours ouvrables');
  });

  it('marks the late ones from the annex’s verdict, and counts them', () => {
    const first = root().querySelector('[data-testid="deadline-dashboard__row--0"]');
    expect(first?.textContent).toContain('En retard');
    expect(first?.textContent).toContain('en retard de 7 jours ouvrables');
    expect(component.overdueCount()).toBe(1);
  });

  it('sends the period as bare dates', () => {
    component.from = new Date(2026, 10, 1);
    component.to = new Date(2026, 11, 31);
    component.applyFilters();
    expect(listDeadlines).toHaveBeenLastCalledWith({ from: '2026-11-01', to: '2026-12-31' });
  });

  it('labels a met deadline with the deadline statuses’ labels', () => {
    expect(component.statusKey(deadlineItem({ status: ProcedureDeadlineStatus.MET }))).toBe(
      'ADMINISTRATIVE_DOCUMENT.DEADLINE_STATUS.MET',
    );
  });

  it('refetches, fresh, when the annex says a deadline is due', async () => {
    listDeadlines.mockClear();
    events.next({
      v: 1,
      id: 'a',
      topic: REALTIME_TOPICS.ADMIN_DEADLINE_DUE,
      at: '',
      scope: { community_id: 1 },
      ref: { kind: 'deadline', id: '1' },
      hint: {},
    });
    await vi.advanceTimersByTimeAsync(500);
    expect(invalidate).toHaveBeenCalled();
    expect(listDeadlines).toHaveBeenCalledTimes(1);
  });
});
