import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { throwError } from 'rxjs';
import { vi } from 'vitest';

import { BillingService } from '../../../../shared/services/billing.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { TariffDialog } from './tariff-dialog';

describe('TariffDialog', () => {
  let component: TariffDialog;
  let ref: { close: ReturnType<typeof vi.fn> };
  let billing: { createTariff: ReturnType<typeof vi.fn> };
  let errorHandler: { handleError: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    ref = { close: vi.fn() };
    billing = { createTariff: vi.fn() };
    errorHandler = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TariffDialog, TranslateModule.forRoot()],
      providers: [
        { provide: DynamicDialogRef, useValue: ref },
        { provide: DynamicDialogConfig, useValue: { data: { operationId: 2 } } },
        { provide: BillingService, useValue: billing },
        { provide: SnackbarNotification, useValue: { openSnackBar: vi.fn() } },
        { provide: ErrorMessageHandler, useValue: errorHandler },
      ],
    })
      .overrideComponent(TariffDialog, { set: { template: '' } })
      .compileComponents();

    const fixture = TestBed.createComponent(TariffDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("shows the server's message when the tariff is refused, and stays open", () => {
    const message = 'A consumer tariff with the same scope already covers this validity period';
    // HttpClient fails with an HttpErrorResponse; the backend's message is in its body.
    billing.createTariff.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { data: message, error_code: 6301 } }),
      ),
    );

    component.form.controls.price_per_kwh.setValue('0.12');
    component.form.controls.valid_from.setValue(new Date(2026, 9, 1));
    component.submit();

    expect(errorHandler.handleError).toHaveBeenCalledWith(message);
    expect(ref.close).not.toHaveBeenCalled();
    expect(component.submitting()).toBe(false);
  });
});
