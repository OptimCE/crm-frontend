import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { vi } from 'vitest';

import { ApiResponsePaginated, Pagination } from '../../../../../core/dtos/api.response';
import { Role } from '../../../../../core/dtos/role';
import { UserContextService } from '../../../../../core/services/authorization/authorization.service';
import { CommunityServicesStore } from '../../../../../core/services/community-services.store';
import { CommunityAnnex } from '../../../../../shared/dtos/annexes_services.dtos';
import {
  InvoiceOut,
  InvoiceStatus,
  InvoiceType,
  MyInvoiceQuery,
} from '../../../../../shared/dtos/billing.dtos';
import { MyCommunityDTO } from '../../../../../shared/dtos/community.dtos';
import { BillingService } from '../../../../../shared/services/billing.service';
import { MyInvoicesPanel } from './my-invoices-panel';

const ORG_A = 'org-a';
const ORG_B = 'org-b';

function community(id: number, orgId: string, name: string): MyCommunityDTO {
  return { id, auth_community_id: orgId, name, role: Role.MEMBER } as MyCommunityDTO;
}

function invoice(overrides: Partial<InvoiceOut>): InvoiceOut {
  return {
    id: 1,
    id_billing_run: 1,
    id_member: 1,
    type: InvoiceType.INVOICE,
    status: InvoiceStatus.SENT,
    number: 'F-2026-00001',
    currency: 'EUR',
    subtotal: '53.08',
    vat_rate: '0.21',
    vat_amount: '11.15',
    total: '64.23',
    structured_comm: '+++000/0000/00101+++',
    issued_at: '2026-10-01T08:00:00Z',
    due_date: '2026-10-31',
    pdf_ready: false,
    ...overrides,
  };
}

/** The document observed on dev as demo2: a payout, listed under "to pay". */
const STATEMENT = invoice({
  id: 19,
  type: InvoiceType.PRODUCER_STATEMENT,
  number: 'DP-2026-00019',
});
const CREDIT_NOTE = invoice({
  id: 20,
  type: InvoiceType.CREDIT_NOTE,
  number: 'NC-2026-00001',
  total: '-64.23',
});

describe('MyInvoicesPanel', () => {
  let fixture: ComponentFixture<MyInvoicesPanel>;
  /** What `/invoices/mine` answers, per community and per status. */
  let ledger: Record<string, Partial<Record<InvoiceStatus, InvoiceOut[]>>>;

  beforeEach(async () => {
    ledger = {};

    await TestBed.configureTestingModule({
      imports: [MyInvoicesPanel, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        {
          provide: BillingService,
          useValue: {
            // Ignores `type`, like a billing backend that predates that filter,
            // so these specs pin the client-side `memberPays` guard.
            listMyInvoicesForCommunity: vi.fn(
              (
                orgId: string,
                query: MyInvoiceQuery,
              ): Observable<ApiResponsePaginated<InvoiceOut[]>> => {
                const data = ledger[orgId]?.[query.status as InvoiceStatus] ?? [];
                return of(
                  new ApiResponsePaginated(data, new Pagination(1, query.limit, data.length, 1)),
                );
              },
            ),
          },
        },
        {
          provide: CommunityServicesStore,
          useValue: {
            catalogFor: () => of([{ feature: 'billing', subscribed: true } as CommunityAnnex]),
          },
        },
        { provide: UserContextService, useValue: { switchCommunity: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MyInvoicesPanel);
  });

  async function start(communities: MyCommunityDTO[]): Promise<void> {
    fixture.componentRef.setInput('communities', communities);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function numbers(): Record<string, (string | null)[]> {
    return Object.fromEntries(
      fixture.componentInstance
        .rows()
        .map((row) => [row.community.name, row.invoices.map((inv) => inv.number)]),
    );
  }

  it('lists the bills still to pay, without producer statements or credit notes', async () => {
    ledger[ORG_A] = {
      [InvoiceStatus.ISSUED]: [CREDIT_NOTE],
      [InvoiceStatus.SENT]: [invoice({ id: 1, number: 'F-2026-00001' }), STATEMENT],
      [InvoiceStatus.OVERDUE]: [invoice({ id: 2, number: 'F-2026-00002' })],
    };

    await start([community(1, ORG_A, 'A')]);

    expect(numbers()).toEqual({ A: ['F-2026-00001', 'F-2026-00002'] });
    expect(fixture.componentInstance.total()).toBe(2);
    const shown = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(shown).toContain('F-2026-00001');
    expect(shown).not.toContain('DP-2026-00019');
    expect(shown).not.toContain('NC-2026-00001');
  });

  it('shows the empty state to a producer who has only a statement', async () => {
    // demo2 on dev, 2026-10-07: "Mes factures à payer" read "DP-2026-00019 64.23 EUR".
    ledger[ORG_A] = { [InvoiceStatus.SENT]: [STATEMENT] };

    await start([community(1, ORG_A, 'A')]);

    expect(fixture.componentInstance.rows()).toEqual([]);
    expect(fixture.componentInstance.state()).toBe('empty');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="my-invoices-panel__empty"]')).not.toBeNull();
    expect(el.textContent).not.toContain('DP-2026-00019');
  });

  it('asks every community for bills only', async () => {
    await start([community(1, ORG_A, 'A'), community(2, ORG_B, 'B')]);

    const service = TestBed.inject(BillingService) as unknown as {
      listMyInvoicesForCommunity: ReturnType<typeof vi.fn>;
    };
    const calls = service.listMyInvoicesForCommunity.mock.calls as [string, MyInvoiceQuery][];
    expect(calls).toHaveLength(6); // 2 communities x 3 unpaid statuses
    for (const [, query] of calls) {
      expect(query.type).toBe(InvoiceType.INVOICE);
    }
  });

  it('gives no row to a community where the member has nothing to pay', async () => {
    ledger[ORG_A] = { [InvoiceStatus.SENT]: [STATEMENT], [InvoiceStatus.ISSUED]: [CREDIT_NOTE] };
    ledger[ORG_B] = { [InvoiceStatus.OVERDUE]: [invoice({ id: 7, number: 'F-2026-00007' })] };

    await start([community(1, ORG_A, 'A'), community(2, ORG_B, 'B')]);

    expect(numbers()).toEqual({ B: ['F-2026-00007'] });
  });
});
