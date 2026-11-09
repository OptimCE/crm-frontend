import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';

import { CommunityServicesStore } from '../../../core/services/community-services.store';
import { RealtimeService } from '../../../core/services/realtime/realtime.service';
import { RealtimeEvent } from '../../../core/services/realtime/realtime.types';
import {
  RegulatoryStatus,
  RegulatoryStatusDTO,
  RegulatorySubjectType,
} from '../../dtos/regulatory-status.dtos';
import { RegulatoryStatusService } from '../../services/regulatory-status.service';
import { MeterStatusComponent } from './meter-status';
import { meterInOperationKey, metersRegulatoryStatus } from './operation-regulatory-status';
import { drivesStatus } from './regulatory-badge.format';

function row(status: RegulatoryStatus, ean = '541448000000000001', op = 3): RegulatoryStatusDTO {
  return {
    id: `${op}-${ean}`,
    id_sharing_operation: op,
    subject_type: RegulatorySubjectType.METER,
    subject_ref: ean,
    regulatory_status: status,
    valid_from: status === RegulatoryStatus.ACTIVE ? '2026-11-02' : null,
    valid_to: null,
    regulatory_ref: '17',
    updated_at: '2026-11-02T05:00:00Z',
  };
}

@Component({
  selector: 'app-host',
  standalone: true,
  imports: [MeterStatusComponent],
  template: `
    <app-meter-status [regulatory]="regulatory()" testId="badge">
      <span data-testid="hand">Actif</span>
    </app-meter-status>
  `,
})
class StatusHost {
  readonly regulatory = signal<RegulatoryStatusDTO | null>(null);
}

describe('MeterStatusComponent (one status per meter)', () => {
  async function render(regulatory: RegulatoryStatusDTO | null): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [StatusHost, TranslateModule.forRoot()],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(StatusHost);
    fixture.componentInstance.regulatory.set(regulatory);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('shows the procedure status in place of the hand-set one, linking to the procedure', async () => {
    const el = await render(row(RegulatoryStatus.ACTIVE));

    const badge = el.querySelector('[data-testid="badge"]');
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute('href')).toBe('/administrative-document/procedures/17');
    expect(el.querySelector('[data-testid="hand"]')).toBeNull();
  });

  it('shows the hand-set status when no procedure tracks the meter', async () => {
    const el = await render(null);

    expect(el.querySelector('[data-testid="hand"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="badge"]')).toBeNull();
  });

  it('shows the hand-set status for a withdrawn episode (nothing was authorised)', async () => {
    const el = await render(row(RegulatoryStatus.WITHDRAWN));

    expect(el.querySelector('[data-testid="hand"]')).not.toBeNull();
  });
});

describe('drivesStatus', () => {
  it.each([
    RegulatoryStatus.TO_NOTIFY,
    RegulatoryStatus.PENDING_GRD,
    RegulatoryStatus.PENDING_REGULATOR,
    RegulatoryStatus.AUTHORIZED,
    RegulatoryStatus.ACTIVE,
    RegulatoryStatus.LEAVING,
    RegulatoryStatus.REFUSED,
  ])('the procedure drives a meter whose episode is %s', (status) => {
    expect(drivesStatus(row(status))).toBe(true);
  });

  it.each([RegulatoryStatus.ENDED, RegulatoryStatus.WITHDRAWN])(
    'an episode %s hands the status back',
    (status) => {
      expect(drivesStatus(row(status))).toBe(false);
    },
  );

  it('no episode: the hand-set status', () => {
    expect(drivesStatus(null)).toBe(false);
    expect(drivesStatus(undefined)).toBe(false);
  });
});

@Component({ selector: 'app-meters-host', standalone: true, template: '' })
class MetersHost {
  readonly eans = signal<string[]>(['A', 'B']);
  readonly rows = metersRegulatoryStatus(() => this.eans());
}

describe('metersRegulatoryStatus (the global meters list)', () => {
  let status: ReturnType<typeof vi.fn>;

  async function host(reachable: boolean): Promise<MetersHost> {
    status = vi.fn().mockReturnValue(of({ data: [row(RegulatoryStatus.PENDING_GRD, 'A', 3)] }));
    await TestBed.configureTestingModule({
      imports: [MetersHost],
      providers: [
        { provide: CommunityServicesStore, useValue: { canReach: () => reachable } },
        { provide: RegulatoryStatusService, useValue: { status } },
        { provide: RealtimeService, useValue: { on: () => new Subject<RealtimeEvent>() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(MetersHost);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('asks the whole community for the visible EANs and keys rows by operation', async () => {
    const h = await host(true);

    expect(status).toHaveBeenCalledWith({
      subject_type: RegulatorySubjectType.METER,
      subject_ref: ['A', 'B'],
    });
    expect(h.rows().get(meterInOperationKey(3, 'A'))?.regulatory_status).toBe(
      RegulatoryStatus.PENDING_GRD,
    );
    expect(h.rows().get(meterInOperationKey(4, 'A'))).toBeUndefined();
  });

  it('asks nothing while the module is not reachable, or with no meter in an operation', async () => {
    await host(false);
    expect(status).not.toHaveBeenCalled();
  });
});
