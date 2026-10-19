import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ApiResponse } from '../../../../core/dtos/api.response';
import { LocaleService } from '../../../../core/services/language/locale.service';
import {
  InvoiceOut,
  InvoiceStatus,
  InvoiceType,
  IssueOut,
} from '../../../../shared/dtos/billing.dtos';
import { BillingService } from '../../../../shared/services/billing.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { InvoiceList } from './invoice-list';

describe('InvoiceList', () => {
  const issued: InvoiceOut = {
    id: 42,
    id_billing_run: 7,
    id_member: 4,
    type: InvoiceType.INVOICE,
    status: InvoiceStatus.ISSUED,
    number: 'F-2026-0042',
    currency: 'EUR',
    subtotal: '100.00',
    vat_rate: '21.00',
    vat_amount: '21.00',
    total: '121.00',
    structured_comm: '+++090/9337/55493+++',
    issued_at: '2026-09-30',
    due_date: '2026-10-30',
    pdf_ready: true,
  };

  let component: InvoiceList;
  let billing: { sendInvoice: ReturnType<typeof vi.fn> };
  let errorHandler: { handleError: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    billing = { sendInvoice: vi.fn() };
    errorHandler = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [InvoiceList, TranslateModule.forRoot()],
      providers: [
        { provide: BillingService, useValue: billing },
        { provide: SnackbarNotification, useValue: { openSnackBar: vi.fn() } },
        { provide: ErrorMessageHandler, useValue: errorHandler },
        { provide: LocaleService, useValue: { locale: signal('en') } },
      ],
    })
      .overrideComponent(InvoiceList, { set: { template: '' } })
      .compileComponents();

    const fixture = TestBed.createComponent(InvoiceList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("shows the server's message when the invoice cannot be sent, and does not ask for a reload", () => {
    const message = 'The member has no e-mail address to send the invoice to';
    // HttpClient fails with an HttpErrorResponse; the backend's message is in its body.
    billing.sendInvoice.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { data: message, error_code: 6122 },
          }),
      ),
    );
    const changed = vi.fn();
    component.changed.subscribe(changed);

    component.send(issued);

    expect(errorHandler.handleError).toHaveBeenCalledWith(message);
    expect(changed).not.toHaveBeenCalled();
  });

  it('confirms an issue without an OGM when the document has none', () => {
    // Only a consumer invoice gets a structured communication; the toast for a
    // producer statement read "Invoice DP-2026-00001 issued (OGM )".
    const snackbar = TestBed.inject(SnackbarNotification) as unknown as {
      openSnackBar: ReturnType<typeof vi.fn>;
    };
    const service = billing as typeof billing & {
      issueInvoice: ReturnType<typeof vi.fn>;
    };
    const issueOut = (structured: string | null): IssueOut => ({
      id: 43,
      number: structured ? 'F-2026-0043' : 'DP-2026-00001',
      status: InvoiceStatus.ISSUED,
      due_date: '2026-11-07',
      structured_comm: structured,
    });

    service.issueInvoice = vi.fn(() => of(new ApiResponse(issueOut(null))));
    component.issue({ ...issued, status: InvoiceStatus.DRAFT });
    expect(snackbar.openSnackBar).toHaveBeenLastCalledWith(
      'BILLING.ISSUE.SUCCESS_NO_OGM',
      expect.anything(),
    );

    service.issueInvoice = vi.fn(() => of(new ApiResponse(issueOut('+++090/9337/55493+++'))));
    component.issue({ ...issued, status: InvoiceStatus.DRAFT });
    expect(snackbar.openSnackBar).toHaveBeenLastCalledWith(
      'BILLING.ISSUE.SUCCESS',
      expect.anything(),
    );
  });

  it('offers nothing on a credited invoice but a download and a re-render', () => {
    // A credit note was issued for it: the backend refuses send, payment, a
    // second credit note and deleting the PDF the credit note refers to.
    const credited: InvoiceOut = { ...issued, status: InvoiceStatus.CREDITED };

    expect(component.canIssue(credited)).toBe(false);
    expect(component.canSend(credited)).toBe(false);
    expect(component.canPay(credited)).toBe(false);
    expect(component.canCreditNote(credited)).toBe(false);
    expect(component.canDeletePdf(credited)).toBe(false);
    expect(component.canDownloadPdf(credited)).toBe(true);
    expect(component.canGeneratePdf(credited)).toBe(true);
    // Against the same invoice before it was credited.
    expect(component.canCreditNote(issued)).toBe(true);
    expect(component.canDeletePdf(issued)).toBe(true);
  });
});
