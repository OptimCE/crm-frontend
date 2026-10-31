import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';

import { CommunityServicesStore } from '../../../core/services/community-services.store';
import { RealtimeService } from '../../../core/services/realtime/realtime.service';
import { REALTIME_TOPICS, RealtimeEvent } from '../../../core/services/realtime/realtime.types';
import {
  RegulatoryStatus,
  RegulatoryStatusDTO,
  RegulatorySubjectType,
} from '../../dtos/regulatory-status.dtos';
import { AdministrativeProcedureService } from '../../services/administrative-procedure.service';
import { RegulatoryStatusService } from '../../services/regulatory-status.service';
import {
  operationRegulatoryStatus,
  operationUnnotified,
  regulatoryKey,
} from './operation-regulatory-status';

const ROW: RegulatoryStatusDTO = {
  id: '1',
  id_sharing_operation: 3,
  subject_type: RegulatorySubjectType.METER,
  subject_ref: '541448000000000001',
  regulatory_status: RegulatoryStatus.ACTIVE,
  valid_from: '2026-11-02',
  valid_to: null,
  regulatory_ref: '17',
  updated_at: '2026-11-02T05:00:00Z',
};

@Component({ selector: 'app-host', standalone: true, template: '' })
class Host {
  readonly operation = signal<number | null>(3);
  readonly rows = operationRegulatoryStatus(() => this.operation());
  readonly unnotified = operationUnnotified(() => this.operation());
}

describe('operationRegulatoryStatus', () => {
  let status: ReturnType<typeof vi.fn>;
  let inbox: ReturnType<typeof vi.fn>;
  let events: Subject<RealtimeEvent>;

  async function host(reachable: boolean): Promise<Host> {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    events = new Subject<RealtimeEvent>();
    status = vi.fn().mockReturnValue(of({ data: [ROW] }));
    inbox = vi.fn().mockReturnValue(
      of({
        data: {
          groups: {
            todo: [
              { id: 21, status: 1, changes_count: 2 },
              { id: 22, status: 2, changes_count: 5 },
            ],
          },
        },
      }),
    );
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        { provide: CommunityServicesStore, useValue: { canReach: () => reachable } },
        { provide: RegulatoryStatusService, useValue: { status } },
        {
          provide: AdministrativeProcedureService,
          useValue: { getInbox: inbox, invalidate: vi.fn() },
        },
        { provide: RealtimeService, useValue: { on: () => events } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('indexes the operation’s subjects', async () => {
    const h = await host(true);

    expect(status).toHaveBeenCalledWith({ id_sharing_operation: 3 });
    expect(h.rows().get(regulatoryKey(RegulatorySubjectType.METER, ROW.subject_ref))).toEqual(ROW);
  });

  it('counts the changes its open drafts hold, not a sent procedure’s', async () => {
    const h = await host(true);

    expect(inbox).toHaveBeenCalledWith({ operation_id: 3, bucket: 'todo' });
    expect(h.unnotified()).toEqual({ count: 2, procedureId: 21 });
  });

  it('asks nothing while the module is not reachable', async () => {
    const h = await host(false);

    expect(status).not.toHaveBeenCalled();
    expect(inbox).not.toHaveBeenCalled();
    expect(h.rows().size).toBe(0);
    expect(h.unnotified()).toBeNull();
  });

  it('refetches on the annexe’s hint', async () => {
    await host(true);
    status.mockClear();

    events.next({
      v: 1,
      id: 'e1',
      topic: REALTIME_TOPICS.ADMIN_DOSSIER_UPDATED,
      at: '',
      scope: { community_id: 1 },
      ref: { kind: 'dossier', id: '17' },
      hint: {},
    });
    await vi.advanceTimersByTimeAsync(500);

    expect(status).toHaveBeenCalledTimes(1);
  });
});
