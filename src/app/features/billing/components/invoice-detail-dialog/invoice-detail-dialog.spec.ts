import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ApiResponse } from '../../../../core/dtos/api.response';
import { LocaleService } from '../../../../core/services/language/locale.service';
import { BillingService } from '../../../../shared/services/billing.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { InvoiceDetailDialog } from './invoice-detail-dialog';

describe('InvoiceDetailDialog', () => {
  let billing: { getInvoice: ReturnType<typeof vi.fn>; listPayments: ReturnType<typeof vi.fn> };
  let errorHandler: { handleError: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    billing = {
      getInvoice: vi.fn(),
      listPayments: vi.fn().mockReturnValue(of(new ApiResponse([]))),
    };
    errorHandler = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [InvoiceDetailDialog, TranslateModule.forRoot()],
      providers: [
        { provide: DynamicDialogRef, useValue: { close: vi.fn() } },
        { provide: DynamicDialogConfig, useValue: { data: { invoiceId: 42 } } },
        { provide: BillingService, useValue: billing },
        { provide: ErrorMessageHandler, useValue: errorHandler },
        { provide: LocaleService, useValue: { locale: signal('en') } },
      ],
    })
      .overrideComponent(InvoiceDetailDialog, { set: { template: '' } })
      .compileComponents();
  });

  it("shows the server's message when the invoice cannot be loaded", async () => {
    const message = 'Invoice 42 does not exist in this community';
    // HttpClient fails with an HttpErrorResponse; the backend's message is in its body.
    billing.getInvoice.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 404, error: { data: message, error_code: 6104 } }),
      ),
    );

    const fixture = TestBed.createComponent(InvoiceDetailDialog);
    await fixture.whenStable();

    expect(errorHandler.handleError).toHaveBeenCalledWith(message);
    expect(fixture.componentInstance.loading()).toBe(false);
  });
});
