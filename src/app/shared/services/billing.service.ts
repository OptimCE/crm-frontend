import { HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, tap } from 'rxjs';

import { environments } from '../../../environments/environments';
import { ApiResponse, ApiResponsePaginated } from '../../core/dtos/api.response';
import { defineTTL } from '../../core/services/cache/cache.helper';
import { COMMUNITY_ID } from '../../core/interceptors/community.context.inteceptor';
import {
  BillingRunOut,
  BillingRunRequest,
  CreditNoteIn,
  InvoiceOut,
  InvoiceQuery,
  IssueOut,
  MyInvoiceQuery,
  OverdueSweepOut,
  PaymentIn,
  PaymentOut,
  RenderRequestOut,
  TariffIn,
  TariffOut,
} from '../dtos/billing.dtos';
import { ServiceBase } from './service.base';

const CACHE_PREFIX = 'billing';

/**
 * HTTP access to the billing annex. The KrakenD gateway prepends `/billing` and
 * injects x-user-id / x-user-orgs from the JWT; the community-context + bearer
 * interceptors add X-Community-ID / auth. Reads are cached under `billing:*`;
 * every mutation invalidates the whole prefix.
 */
@Injectable({ providedIn: 'root' })
export class BillingService extends ServiceBase {
  private readonly apiAddress: string;

  constructor() {
    super();
    this.apiAddress = environments.apiUrl + '/billing';
  }

  // --- Tariffs -------------------------------------------------------------

  listTariffs(operationId: number): Observable<ApiResponse<TariffOut[]>> {
    return this.cachedGet<ApiResponse<TariffOut[]>>(
      `${CACHE_PREFIX}:tariffs:${operationId}`,
      `${this.apiAddress}/sharing-operations/${operationId}/tariffs`,
    );
  }

  createTariff(operationId: number, body: TariffIn): Observable<ApiResponse<TariffOut>> {
    return this.http
      .post<
        ApiResponse<TariffOut>
      >(`${this.apiAddress}/sharing-operations/${operationId}/tariffs`, body)
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  deleteTariff(id: number): Observable<ApiResponse<boolean>> {
    return this.http
      .delete<ApiResponse<boolean>>(`${this.apiAddress}/tariffs/${id}`)
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  // --- Billing runs --------------------------------------------------------

  listBillingRuns(operationId: number): Observable<ApiResponse<BillingRunOut[]>> {
    return this.cachedGet<ApiResponse<BillingRunOut[]>>(
      `${CACHE_PREFIX}:runs:${operationId}`,
      `${this.apiAddress}/sharing-operations/${operationId}/billing-runs`,
    );
  }

  createBillingRun(
    operationId: number,
    body: BillingRunRequest,
  ): Observable<ApiResponse<BillingRunOut>> {
    return this.http
      .post<
        ApiResponse<BillingRunOut>
      >(`${this.apiAddress}/sharing-operations/${operationId}/billing-runs`, body)
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  /** Poll target while a run computes — short TTL so status flips are picked up. */
  getBillingRun(id: number): Observable<ApiResponse<BillingRunOut>> {
    return this.cachedGet<ApiResponse<BillingRunOut>>(
      `${CACHE_PREFIX}:run:${id}`,
      `${this.apiAddress}/billing-runs/${id}`,
      undefined,
      defineTTL(1),
    );
  }

  getRunInvoices(id: number): Observable<ApiResponse<InvoiceOut[]>> {
    return this.cachedGet<ApiResponse<InvoiceOut[]>>(
      `${CACHE_PREFIX}:run-invoices:${id}`,
      `${this.apiAddress}/billing-runs/${id}/invoices`,
    );
  }

  overdueSweep(): Observable<ApiResponse<OverdueSweepOut>> {
    return this.http
      .post<ApiResponse<OverdueSweepOut>>(`${this.apiAddress}/billing-runs/overdue-sweep`, {})
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  // --- Invoices ------------------------------------------------------------

  listInvoices(query: InvoiceQuery): Observable<ApiResponsePaginated<InvoiceOut[]>> {
    return this.cachedGet<ApiResponsePaginated<InvoiceOut[]>>(
      `${CACHE_PREFIX}:invoices:${JSON.stringify(query)}`,
      `${this.apiAddress}/invoices`,
      query,
    );
  }

  /**
   * The same caller-scoped listing, for an EXPLICIT community.
   *
   * `/invoices/mine` is member-scoped but still community-scoped — it resolves
   * its tenant from `X-Community-ID` — so the user dashboard, which renders
   * before any community is active, has to ask each community in turn. The
   * `COMMUNITY_ID` context token pins the header (the interceptor would
   * otherwise stamp the active community, or none at all), and the cache key
   * embeds the same id so two communities cannot share one entry.
   */
  listMyInvoicesForCommunity(
    communityId: string,
    query: MyInvoiceQuery,
  ): Observable<ApiResponsePaginated<InvoiceOut[]>> {
    return this.cachedGet<ApiResponsePaginated<InvoiceOut[]>>(
      `${CACHE_PREFIX}:invoices-mine:${communityId}:${JSON.stringify(query)}`,
      `${this.apiAddress}/invoices/mine`,
      query,
      undefined,
      { context: new HttpContext().set(COMMUNITY_ID, communityId) },
    );
  }

  /** Caller-scoped listing — the server derives the member from the auth header. */
  listMyInvoices(query: MyInvoiceQuery): Observable<ApiResponsePaginated<InvoiceOut[]>> {
    return this.cachedGet<ApiResponsePaginated<InvoiceOut[]>>(
      `${CACHE_PREFIX}:invoices-mine:${JSON.stringify(query)}`,
      `${this.apiAddress}/invoices/mine`,
      query,
    );
  }

  getInvoice(id: number): Observable<ApiResponse<InvoiceOut>> {
    return this.cachedGet<ApiResponse<InvoiceOut>>(
      `${CACHE_PREFIX}:invoice:${id}`,
      `${this.apiAddress}/invoices/${id}`,
    );
  }

  /** Uncached single-invoice fetch — used to poll `pdf_ready` after a render. */
  getInvoiceLive(id: number): Observable<ApiResponse<InvoiceOut>> {
    return this.http.get<ApiResponse<InvoiceOut>>(`${this.apiAddress}/invoices/${id}`);
  }

  // --- Invoice PDF ---------------------------------------------------------

  /** Ask document-generation for a (fresh) PDF. Async — poll `pdf_ready` after. */
  generateInvoicePdf(id: number, force = false): Observable<ApiResponse<RenderRequestOut>> {
    return this.http
      .post<ApiResponse<RenderRequestOut>>(`${this.apiAddress}/invoices/${id}/pdf`, { force })
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  /** Stream the rendered PDF bytes + its download filename (Content-Disposition). */
  downloadInvoicePdf(id: number): Observable<{ blob: Blob; filename: string }> {
    return this.http
      .get(`${this.apiAddress}/invoices/${id}/pdf`, {
        observe: 'response',
        responseType: 'blob',
      })
      .pipe(
        map((response) => {
          const blob = response.body as Blob;
          const contentDisposition = response.headers.get('content-disposition');
          let filename = `facture-${id}.pdf`;
          if (contentDisposition) {
            const match = contentDisposition.match(/filename="(.+?)"/);
            if (match?.[1]) filename = match[1];
          }
          return { blob, filename };
        }),
        catchError((error: HttpErrorResponse) => this.blobErrorHandler(error)),
      );
  }

  /** Remove the generated PDF (file + reference); the invoice record is untouched. */
  deleteInvoicePdf(id: number): Observable<ApiResponse<boolean>> {
    return this.http
      .delete<ApiResponse<boolean>>(`${this.apiAddress}/invoices/${id}/pdf`)
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  issueInvoice(id: number): Observable<ApiResponse<IssueOut>> {
    return this.http
      .post<ApiResponse<IssueOut>>(`${this.apiAddress}/invoices/${id}/issue`, {})
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  sendInvoice(id: number): Observable<ApiResponse<InvoiceOut>> {
    return this.http
      .post<ApiResponse<InvoiceOut>>(`${this.apiAddress}/invoices/${id}/send`, {})
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  listPayments(id: number): Observable<ApiResponse<PaymentOut[]>> {
    return this.cachedGet<ApiResponse<PaymentOut[]>>(
      `${CACHE_PREFIX}:payments:${id}`,
      `${this.apiAddress}/invoices/${id}/payments`,
    );
  }

  registerPayment(id: number, body: PaymentIn): Observable<ApiResponse<InvoiceOut>> {
    return this.http
      .post<ApiResponse<InvoiceOut>>(`${this.apiAddress}/invoices/${id}/payments`, body)
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  createCreditNote(id: number, body: CreditNoteIn): Observable<ApiResponse<InvoiceOut>> {
    return this.http
      .post<ApiResponse<InvoiceOut>>(`${this.apiAddress}/invoices/${id}/credit-note`, body)
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  invalidate(): void {
    this.cache.invalidate(CACHE_PREFIX);
  }
}
