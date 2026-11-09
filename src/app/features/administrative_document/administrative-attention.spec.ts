import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';

import { UserContextService } from '../../core/services/authorization/authorization.service';
import { CommunityServicesStore } from '../../core/services/community-services.store';
import { RealtimeService } from '../../core/services/realtime/realtime.service';
import { RealtimeEvent } from '../../core/services/realtime/realtime.types';
import { ChangeSummaryOut } from '../../shared/dtos/administrative-procedure.dtos';
import { SnackbarNotification } from '../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeProcedureService } from '../../shared/services/administrative-procedure.service';
import {
  AdminChangeToasts,
  TOAST_WINDOW_MS,
  administrativeAttention,
  attentionBadge,
} from './administrative-attention';

@Component({ selector: 'app-host', standalone: true, template: '' })
class Host {
  readonly summary = administrativeAttention();
}

function change(overrides: Partial<ChangeSummaryOut> = {}): ChangeSummaryOut {
  return {
    id: 5,
    kind: 'meter_added',
    subject_type: 1,
    subject_ref: '541448000000000001',
    status: 2,
    id_dossier: 12,
    procedure_code: 'PARTAGE_MODIF',
    procedure_labels: { fr: 'Modification du partage', en: 'Sharing change' },
    procedure_status: 1,
    recipient: 'grd_ref',
    grd_ref: 'ores',
    id_sharing_operation: 3,
    operation_name: 'Op Centre',
    ...overrides,
  };
}

function providers(manager: boolean, active = true) {
  return [
    provideRouter([]),
    {
      provide: CommunityServicesStore,
      useValue: { isActive: () => active, canReach: () => active },
    },
    { provide: UserContextService, useValue: { compareWithActiveRole: () => manager } },
    { provide: RealtimeService, useValue: { on: () => new Subject<RealtimeEvent>() } },
    { provide: SnackbarNotification, useValue: { openSnackBar: vi.fn() } },
  ];
}

describe('attentionBadge', () => {
  it('shows the procedures to do, else what is late, capped at 99+', () => {
    expect(attentionBadge(null)).toBeNull();
    expect(attentionBadge({ todo: 0, overdue: 0 })).toBeNull();
    expect(attentionBadge({ todo: 3, overdue: 1 })).toBe('3');
    expect(attentionBadge({ todo: 0, overdue: 2 })).toBe('2');
    expect(attentionBadge({ todo: 120, overdue: 0 })).toBe('99+');
  });
});

describe('administrativeAttention', () => {
  let getSummary: ReturnType<typeof vi.fn>;

  async function host(manager: boolean, active = true): Promise<Host> {
    getSummary = vi.fn().mockReturnValue(of({ data: { todo: 2, overdue: 1 } }));
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        ...providers(manager, active),
        { provide: AdministrativeProcedureService, useValue: { getSummary } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('reads the summary for a manager of a community with the module', async () => {
    const h = await host(true);
    expect(getSummary).toHaveBeenCalled();
    expect(h.summary()).toEqual({ todo: 2, overdue: 1 });
  });

  it('asks nothing for a member, nor without the module', async () => {
    expect((await host(false)).summary()).toBeNull();
    expect(getSummary).not.toHaveBeenCalled();
    TestBed.resetTestingModule();
    expect((await host(true, false)).summary()).toBeNull();
    expect(getSummary).not.toHaveBeenCalled();
  });
});

describe('AdminChangeToasts', () => {
  let toasts: AdminChangeToasts;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        ...providers(true),
        { provide: AdministrativeProcedureService, useValue: { getChange: vi.fn() } },
      ],
    }).compileComponents();
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('fr', {
      ADMINISTRATIVE_DOCUMENT: {
        TOAST: {
          CHANGE_FILED: '{{change}} ({{subject}}) → {{recipient}} : {{procedure}} n° {{id}}',
        },
        PROCEDURES: {
          CHANGE_KIND: { METER_ADDED: 'Compteur ajouté' },
          RECIPIENT: { GRD: '{{name}} (GRD)' },
        },
      },
    });
    translate.use('fr');
    toasts = TestBed.inject(AdminChangeToasts);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('says what was filed, where and for whom', () => {
    expect(toasts.message(change(), 0)).toBe(
      'Compteur ajouté (541448000000000001) → ORES (GRD) : Modification du partage n° 12',
    );
  });

  it('is shown once per procedure in a 10-minute window', () => {
    expect(toasts.message(change(), 0)).not.toBeNull();
    expect(toasts.message(change({ id: 6 }), TOAST_WINDOW_MS - 1)).toBeNull();
    expect(toasts.message(change({ id: 7, id_dossier: 13 }), 1000)).not.toBeNull();
    expect(toasts.message(change({ id: 8 }), TOAST_WINDOW_MS)).not.toBeNull();
  });

  it('says nothing for a change that did not land in an open draft', () => {
    expect(toasts.message(change({ status: 5 }), 0)).toBeNull(); // compensated
    expect(toasts.message(change({ procedure_status: 2 }), 0)).toBeNull(); // sent
    expect(toasts.message(change({ id_dossier: null }), 0)).toBeNull();
  });
});
