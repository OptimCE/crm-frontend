import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { vi } from 'vitest';

import { ApiResponsePaginated, Pagination } from '../../../../../core/dtos/api.response';
import {
  InvoiceOut,
  InvoiceStatus,
  InvoiceType,
  MyInvoiceQuery,
} from '../../../../../shared/dtos/billing.dtos';
import { BillingService } from '../../../../../shared/services/billing.service';
import { MyInvoicesTile } from './my-invoices-tile';

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

function statement(id: number, dueDate: string): InvoiceOut {
  return invoice({
    id,
    type: InvoiceType.PRODUCER_STATEMENT,
    number: `DP-2026-000${id}`,
    due_date: dueDate,
  });
}

describe('MyInvoicesTile', () => {
  let fixture: ComponentFixture<MyInvoicesTile>;
  /** What `/invoices/mine` holds, per status. */
  let ledger: Partial<Record<InvoiceStatus, InvoiceOut[]>>;

  beforeEach(async () => {
    ledger = {};

    await TestBed.configureTestingModule({
      imports: [MyInvoicesTile, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        {
          provide: BillingService,
          useValue: {
            // Behaves like the endpoint: sorted by due date, cut at `limit`. It
            // ignores `type`, like a billing backend that predates that filter,
            // so these specs pin the client-side `memberPays` guard.
            listMyInvoices: vi.fn(
              (query: MyInvoiceQuery): Observable<ApiResponsePaginated<InvoiceOut[]>> => {
                const all = [...(ledger[query.status as InvoiceStatus] ?? [])].sort((a, b) =>
                  (a.due_date ?? '').localeCompare(b.due_date ?? ''),
                );
                const data = all.slice(0, query.limit);
                return of(
                  new ApiResponsePaginated(data, new Pagination(1, query.limit, all.length, 1)),
                );
              },
            ),
          },
        },
      ],
    }).compileComponents();
  });

  async function render(): Promise<void> {
    fixture = TestBed.createComponent(MyInvoicesTile);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function shownNumbers(): (string | null)[] {
    return fixture.componentInstance.unpaid().map((inv) => inv.number);
  }

  it('counts and lists bills only', async () => {
    ledger = {
      [InvoiceStatus.ISSUED]: [
        invoice({ id: 3, type: InvoiceType.CREDIT_NOTE, number: 'NC-2026-00001', total: '-10' }),
      ],
      [InvoiceStatus.SENT]: [
        invoice({ id: 1, number: 'F-2026-00001' }),
        statement(19, '2026-10-20'),
      ],
      [InvoiceStatus.OVERDUE]: [invoice({ id: 2, number: 'F-2026-00002', due_date: '2026-09-30' })],
    };

    await render();

    expect(shownNumbers()).toEqual(['F-2026-00002', 'F-2026-00001']);
    expect(fixture.componentInstance.state()).toBe('ready');
    const shown = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(shown).not.toContain('DP-2026-00019');
    expect(shown).not.toContain('NC-2026-00001');
  });

  it('shows the empty state when only producer statements are open', async () => {
    ledger = { [InvoiceStatus.SENT]: [statement(19, '2026-10-20')] };

    await render();

    expect(fixture.componentInstance.state()).toBe('empty');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="my-invoices-tile__empty"]',
      ),
    ).not.toBeNull();
  });

  it('asks the server for bills only', async () => {
    await render();

    const service = TestBed.inject(BillingService) as unknown as {
      listMyInvoices: ReturnType<typeof vi.fn>;
    };
    const queries = service.listMyInvoices.mock.calls.map(([query]) => query as MyInvoiceQuery);
    expect(queries).toHaveLength(3);
    for (const query of queries) {
      expect(query.type).toBe(InvoiceType.INVOICE);
    }
  });

  it('still finds a bill that three earlier producer statements would have crowded out', async () => {
    // The tile used to read exactly as many as it shows (3) per status. Once the
    // statements are dropped client-side, that read could come back empty while
    // a bill due later was still waiting.
    ledger = {
      [InvoiceStatus.SENT]: [
        statement(11, '2026-10-01'),
        statement(12, '2026-10-02'),
        statement(13, '2026-10-03'),
        invoice({ id: 1, number: 'F-2026-00001', due_date: '2026-10-31' }),
      ],
    };

    await render();

    expect(shownNumbers()).toEqual(['F-2026-00001']);
  });
});
