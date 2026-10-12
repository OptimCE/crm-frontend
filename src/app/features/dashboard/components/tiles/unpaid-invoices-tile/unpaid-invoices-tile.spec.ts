import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { vi } from 'vitest';

import {
  ApiResponse,
  ApiResponsePaginated,
  Pagination,
} from '../../../../../core/dtos/api.response';
import {
  BillingRunOut,
  InvoiceOut,
  InvoiceQuery,
  InvoiceStatus,
  InvoiceType,
} from '../../../../../shared/dtos/billing.dtos';
import { BillingService } from '../../../../../shared/services/billing.service';
import { UnpaidInvoicesTile } from './unpaid-invoices-tile';

/** The community ledger, as counts per (status, type). */
type Ledger = Partial<Record<InvoiceStatus, Partial<Record<InvoiceType, number>>>>;

describe('UnpaidInvoicesTile', () => {
  let fixture: ComponentFixture<UnpaidInvoicesTile>;
  let ledger: Ledger;
  let listInvoices: ReturnType<typeof vi.fn>;

  /** A `limit=1` count read that honours `type` like the current billing backend. */
  function countRead(query: InvoiceQuery): Observable<ApiResponsePaginated<InvoiceOut[]>> {
    const byType = ledger[query.status as InvoiceStatus] ?? {};
    const total = Object.entries(byType)
      .filter(([type]) => query.type === undefined || Number(type) === Number(query.type))
      .reduce((sum, [, count]) => sum + (count ?? 0), 0);
    return of(new ApiResponsePaginated<InvoiceOut[]>([], new Pagination(1, 1, total, total)));
  }

  beforeEach(async () => {
    ledger = {};
    listInvoices = vi.fn(countRead);

    await TestBed.configureTestingModule({
      imports: [UnpaidInvoicesTile, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        {
          provide: BillingService,
          useValue: {
            listInvoices,
            listBillingRuns: vi.fn(() => of(new ApiResponse<BillingRunOut[]>([]))),
          },
        },
      ],
    }).compileComponents();
  });

  async function render(): Promise<void> {
    fixture = TestBed.createComponent(UnpaidInvoicesTile);
    fixture.componentRef.setInput('operations', []);
    fixture.componentRef.setInput('operationsLoading', false);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('counts only consumer invoices as what the community is still owed', async () => {
    ledger = {
      [InvoiceStatus.ISSUED]: {
        [InvoiceType.INVOICE]: 2,
        [InvoiceType.PRODUCER_STATEMENT]: 4,
        [InvoiceType.CREDIT_NOTE]: 1,
      },
      [InvoiceStatus.SENT]: { [InvoiceType.INVOICE]: 1, [InvoiceType.PRODUCER_STATEMENT]: 3 },
      [InvoiceStatus.OVERDUE]: { [InvoiceType.INVOICE]: 1 },
    };

    await render();

    // 2 + 1 + 1 bills; the 7 producer statements are what the community OWES
    // and the credit note is owed to a member.
    expect(fixture.componentInstance.unpaidCount()).toBe(4);
    expect(fixture.componentInstance.state()).toBe('ready');
  });

  it('asks for bills only, in every count read', async () => {
    await render();

    const queries = listInvoices.mock.calls.map(([query]) => query as InvoiceQuery);
    expect(queries.map((q) => q.status)).toEqual([
      InvoiceStatus.ISSUED,
      InvoiceStatus.SENT,
      InvoiceStatus.OVERDUE,
    ]);
    for (const query of queries) {
      expect(query).toMatchObject({ limit: 1, type: InvoiceType.INVOICE });
    }
  });

  it('shows the empty state when nothing but producer statements is open', async () => {
    ledger = { [InvoiceStatus.SENT]: { [InvoiceType.PRODUCER_STATEMENT]: 5 } };

    await render();

    expect(fixture.componentInstance.unpaidCount()).toBe(0);
    expect(fixture.componentInstance.state()).toBe('empty');
  });
});
