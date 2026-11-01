import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';

import { SharingOperationMetersList } from './sharing-operation-meters-list';
import { SharingOperationService } from '../../../../../shared/services/sharing_operation.service';
import { SharingOperationMeterEventService } from '../sharing-operation.meter.subjet';
import { ErrorMessageHandler } from '../../../../../shared/services-ui/error.message.handler';
import { ApiResponse, ApiResponsePaginated } from '../../../../../core/dtos/api.response';
import { PartialMeterDTO } from '../../../../../shared/dtos/meter.dtos';
import { SharingOperationMetersQueryType } from '../../../../../shared/dtos/sharing_operation.dtos';
import { MeterDataStatus } from '../../../../../shared/types/meter.types';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmPopup } from 'primeng/confirmpopup';
import { DialogService } from 'primeng/dynamicdialog';
import { Toast } from 'primeng/toast';
import { provideRegulatoryTesting } from '../../../../../shared/components/regulatory-badge/regulatory-testing';
import {
  RegulatoryStatus,
  RegulatoryStatusDTO,
  RegulatorySubjectType,
} from '../../../../../shared/dtos/regulatory-status.dtos';

function meter(EAN: string, status: MeterDataStatus): PartialMeterDTO {
  return {
    EAN,
    meter_number: 'M-' + EAN,
    address: { id: 1, street: 'Rue Test', number: '1', postcode: '4000', city: 'Liège' },
    status,
  };
}

function episode(subject_ref: string, regulatory_status: RegulatoryStatus): RegulatoryStatusDTO {
  return {
    id: subject_ref,
    id_sharing_operation: 1,
    subject_type: RegulatorySubjectType.METER,
    subject_ref,
    regulatory_status,
    valid_from: regulatory_status === RegulatoryStatus.ACTIVE ? '2026-06-01' : null,
    valid_to: null,
    regulatory_ref: '12',
    updated_at: '2026-11-01T10:00:00Z',
  };
}

/**
 * One status for a meter in an operation (2026-11-01): a meter its procedure
 * tracks shows the procedure's status in place of the CRM's own, and loses the
 * hand controls; any other keeps both.
 */
describe('SharingOperationMetersList — one status', () => {
  let fixture: ComponentFixture<SharingOperationMetersList>;

  async function render(rows: RegulatoryStatusDTO[]): Promise<HTMLElement> {
    const meters = [
      meter('TRACKED', MeterDataStatus.WAITING_GRD),
      meter('FREE', MeterDataStatus.WAITING_GRD),
      meter('WITHDRAWN', MeterDataStatus.WAITING_GRD),
    ];
    await TestBed.configureTestingModule({
      imports: [SharingOperationMetersList, TranslateModule.forRoot()],
      providers: [
        ...provideRegulatoryTesting(rows),
        {
          provide: SharingOperationService,
          useValue: {
            getSharingOperationMetersList: vi.fn().mockReturnValue(
              of(
                new ApiResponsePaginated<PartialMeterDTO[]>(meters, {
                  total: 3,
                  total_pages: 1,
                  page: 1,
                  limit: 10,
                }),
              ),
            ),
            patchMeterStatus: vi.fn().mockReturnValue(of(new ApiResponse('OK'))),
            deleteMeterFromSharingOperation: vi.fn().mockReturnValue(of(new ApiResponse('OK'))),
          },
        },
        {
          provide: SharingOperationMeterEventService,
          useValue: { meterAdded$: new Subject<void>().asObservable() },
        },
        provideRouter([]),
      ],
    })
      .overrideComponent(SharingOperationMetersList, {
        remove: {
          imports: [ConfirmPopup, Toast],
          providers: [DialogService, ConfirmationService, MessageService, ErrorMessageHandler],
        },
        add: {
          providers: [
            { provide: ErrorMessageHandler, useValue: { handleError: vi.fn() } },
            { provide: ConfirmationService, useValue: { confirm: vi.fn() } },
            { provide: MessageService, useValue: { add: vi.fn() } },
            { provide: DialogService, useValue: {} },
          ],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();
    fixture = TestBed.createComponent(SharingOperationMetersList);
    fixture.componentRef.setInput('id_sharing', 1);
    fixture.componentRef.setInput('type', SharingOperationMetersQueryType.NOW);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function desktopRow(el: HTMLElement, index: number): HTMLElement {
    const row = el.querySelector<HTMLElement>(
      `[data-testid="op-meters-list__row--desktop--${index}"]`,
    );
    if (!row) throw new Error(`no desktop row ${index}`);
    return row;
  }

  it('shows the procedure status alone for a tracked meter, the hand tag for the others', async () => {
    const el = await render([
      episode('TRACKED', RegulatoryStatus.PENDING_GRD),
      episode('WITHDRAWN', RegulatoryStatus.WITHDRAWN),
    ]);

    const tracked = desktopRow(el, 0);
    expect(
      tracked.querySelector('[data-testid="op-meters-list__regulatory--desktop--0"]'),
    ).not.toBeNull();
    expect(tracked.textContent).not.toContain('WAITING_FOR_GRD_ACCEPTANCE_LABEL');
    for (const index of [1, 2]) {
      const row = desktopRow(el, index);
      expect(
        row.querySelector(`[data-testid="op-meters-list__regulatory--desktop--${index}"]`),
      ).toBeNull();
      expect(row.textContent).toContain('WAITING_FOR_GRD_ACCEPTANCE_LABEL');
    }
  });

  it('hides approve and put-on-waiting while the procedure drives the status; keeps remove', async () => {
    const el = await render([episode('TRACKED', RegulatoryStatus.REFUSED)]);

    expect(el.querySelector('[data-testid="op-meters-list__btn--approve--0"]')).toBeNull();
    expect(el.querySelector('[data-testid="op-meters-list__btn--card-approve--0"]')).toBeNull();
    expect(el.querySelector('[data-testid="op-meters-list__btn--delete--0"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="op-meters-list__btn--approve--1"]')).not.toBeNull();
  });

  it('gives the status back to the manager once the episode ended', async () => {
    const el = await render([episode('TRACKED', RegulatoryStatus.ENDED)]);

    expect(el.querySelector('[data-testid="op-meters-list__btn--approve--0"]')).not.toBeNull();
  });

  it('says which meters the GRD no longer counts in the sharing, and since when', async () => {
    const ended = { ...episode('TRACKED', RegulatoryStatus.ENDED), valid_to: '2026-11-30' };
    const el = await render([ended]);

    const banner = el.querySelector('[data-testid="op-meters-list__message--ended"]');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('ENDED_STILL_IN');
    expect(fixture.componentInstance.ended()).toEqual({
      count: 1,
      since: new Date(2026, 11, 1),
    });
  });

  it('says nothing while every meter is still in the sharing', async () => {
    const el = await render([episode('TRACKED', RegulatoryStatus.ACTIVE)]);
    expect(el.querySelector('[data-testid="op-meters-list__message--ended"]')).toBeNull();
  });
});
