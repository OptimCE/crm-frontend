import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environments } from '../../../environments/environments';
import {
  BillingRunRequest,
  CreditNoteIn,
  InvoiceStatus,
  PaymentIn,
  PaymentMethod,
  TariffIn,
  TariffKind,
  TariffScope,
} from '../dtos/billing.dtos';
import { BillingService } from './billing.service';

describe('BillingService', () => {
  let service: BillingService;
  let httpMock: HttpTestingController;
  const base = `${environments.apiUrl}/billing`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BillingService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BillingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('lists tariffs for a sharing operation with a plain GET', () => {
    service.listTariffs(7).subscribe();
    const req = httpMock.expectOne(`${base}/sharing-operations/7/tariffs`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], error_code: 0 });
  });

  it('creates a tariff via POST with the body', () => {
    service
      .createTariff(7, {
        kind: TariffKind.CONSUMER_SELLING,
        scope: TariffScope.GLOBAL,
        price_per_kwh: '0.12',
        valid_from: '2026-01-01',
      })
      .subscribe();
    const req = httpMock.expectOne(`${base}/sharing-operations/7/tariffs`);
    expect(req.request.method).toBe('POST');
    expect((req.request.body as TariffIn).price_per_kwh).toBe('0.12');
    expect((req.request.body as TariffIn).kind).toBe(TariffKind.CONSUMER_SELLING);
    req.flush({ data: {}, error_code: 0 });
  });

  it('deletes a tariff via DELETE /tariffs/:id', () => {
    service.deleteTariff(5).subscribe();
    const req = httpMock.expectOne(`${base}/tariffs/5`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ data: true, error_code: 0 });
  });

  it('creates a billing run via POST with period bounds', () => {
    service
      .createBillingRun(7, { period_start: '2026-01-01', period_end: '2026-01-31' })
      .subscribe();
    const req = httpMock.expectOne(`${base}/sharing-operations/7/billing-runs`);
    expect(req.request.method).toBe('POST');
    expect((req.request.body as BillingRunRequest).period_start).toBe('2026-01-01');
    expect((req.request.body as BillingRunRequest).period_end).toBe('2026-01-31');
    req.flush({ data: {}, error_code: 0 });
  });

  it('gets a single run via GET /billing-runs/:id', () => {
    service.getBillingRun(3).subscribe();
    const req = httpMock.expectOne(`${base}/billing-runs/3`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: {}, error_code: 0 });
  });

  it('gets run invoices via GET /billing-runs/:id/invoices', () => {
    service.getRunInvoices(3).subscribe();
    const req = httpMock.expectOne(`${base}/billing-runs/3/invoices`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], error_code: 0 });
  });

  it('runs the overdue sweep via POST /billing-runs/overdue-sweep', () => {
    service.overdueSweep().subscribe();
    const req = httpMock.expectOne(`${base}/billing-runs/overdue-sweep`);
    expect(req.request.method).toBe('POST');
    req.flush({ data: { marked: 2 }, error_code: 0 });
  });

  it('lists the manager board with status/participant/page/limit params', () => {
    service
      .listInvoices({ status: InvoiceStatus.ISSUED, participant: 42, page: 2, limit: 25 })
      .subscribe();
    const req = httpMock.expectOne((r) => r.url === `${base}/invoices`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe(String(InvoiceStatus.ISSUED));
    expect(req.request.params.get('participant')).toBe('42');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('25');
    req.flush({
      data: [],
      pagination: { page: 2, limit: 25, total: 0, total_pages: 0 },
      error_code: 0,
    });
  });

  it('lists my invoices (caller-scoped) with no participant param', () => {
    service.listMyInvoices({ page: 1, limit: 50 }).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${base}/invoices/mine`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('limit')).toBe('50');
    expect(req.request.params.has('participant')).toBe(false);
    req.flush({
      data: [],
      pagination: { page: 1, limit: 50, total: 0, total_pages: 0 },
      error_code: 0,
    });
  });

  it('gets a single invoice via GET /invoices/:id', () => {
    service.getInvoice(9).subscribe();
    const req = httpMock.expectOne(`${base}/invoices/9`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: {}, error_code: 0 });
  });

  it('issues an invoice via POST /invoices/:id/issue', () => {
    service.issueInvoice(9).subscribe();
    const req = httpMock.expectOne(`${base}/invoices/9/issue`);
    expect(req.request.method).toBe('POST');
    req.flush({ data: { id: 9, number: 'F-2026-0001', status: 1 }, error_code: 0 });
  });

  it('sends an invoice via POST /invoices/:id/send', () => {
    service.sendInvoice(9).subscribe();
    const req = httpMock.expectOne(`${base}/invoices/9/send`);
    expect(req.request.method).toBe('POST');
    req.flush({ data: {}, error_code: 0 });
  });

  it('lists payments via GET /invoices/:id/payments', () => {
    service.listPayments(9).subscribe();
    const req = httpMock.expectOne(`${base}/invoices/9/payments`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], error_code: 0 });
  });

  it('registers a payment via POST with the body', () => {
    service
      .registerPayment(9, { amount: '123.45', method: PaymentMethod.BANK_TRANSFER, reference: 'x' })
      .subscribe();
    const req = httpMock.expectOne(`${base}/invoices/9/payments`);
    expect(req.request.method).toBe('POST');
    expect((req.request.body as PaymentIn).amount).toBe('123.45');
    expect((req.request.body as PaymentIn).method).toBe(PaymentMethod.BANK_TRANSFER);
    req.flush({ data: {}, error_code: 0 });
  });

  it('creates a credit note via POST /invoices/:id/credit-note', () => {
    service.createCreditNote(9, { reason: 'billing error' }).subscribe();
    const req = httpMock.expectOne(`${base}/invoices/9/credit-note`);
    expect(req.request.method).toBe('POST');
    expect((req.request.body as CreditNoteIn).reason).toBe('billing error');
    req.flush({ data: {}, error_code: 0 });
  });
});
