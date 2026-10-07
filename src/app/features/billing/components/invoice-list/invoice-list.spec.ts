import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { throwError } from 'rxjs';
import { vi } from 'vitest';

import { LocaleService } from '../../../../core/services/language/locale.service';
import { InvoiceOut, InvoiceStatus, InvoiceType } from '../../../../shared/dtos/billing.dtos';
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
        () => new HttpErrorResponse({ status: 422, error: { data: message, error_code: 6122 } }),
      ),
    );
    const changed = vi.fn();
    component.changed.subscribe(changed);

    component.send(issued);

    expect(errorHandler.handleError).toHaveBeenCalledWith(message);
    expect(changed).not.toHaveBeenCalled();
  });
});
