import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { throwError } from 'rxjs';
import { vi } from 'vitest';

import { BillingService } from '../../../../shared/services/billing.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { PaymentDialog } from './payment-dialog';

describe('PaymentDialog', () => {
  let component: PaymentDialog;
  let ref: { close: ReturnType<typeof vi.fn> };
  let billing: { registerPayment: ReturnType<typeof vi.fn> };
  let errorHandler: { handleError: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    ref = { close: vi.fn() };
    billing = { registerPayment: vi.fn() };
    errorHandler = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [PaymentDialog, TranslateModule.forRoot()],
      providers: [
        { provide: DynamicDialogRef, useValue: ref },
        {
          provide: DynamicDialogConfig,
          useValue: { data: { invoice: { id: 42, total: '121.00' } } },
        },
        { provide: BillingService, useValue: billing },
        { provide: SnackbarNotification, useValue: { openSnackBar: vi.fn() } },
        { provide: ErrorMessageHandler, useValue: errorHandler },
      ],
    })
      .overrideComponent(PaymentDialog, { set: { template: '' } })
      .compileComponents();

    const fixture = TestBed.createComponent(PaymentDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("shows the server's message when the payment is refused, and stays open", () => {
    const message = 'This invoice is already fully paid';
    // HttpClient fails with an HttpErrorResponse; the backend's message is in its body.
    billing.registerPayment.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { data: message, error_code: 6131 } }),
      ),
    );

    component.submit();

    expect(errorHandler.handleError).toHaveBeenCalledWith(message);
    expect(ref.close).not.toHaveBeenCalled();
    expect(component.submitting()).toBe(false);
  });
});
