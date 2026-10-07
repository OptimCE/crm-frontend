import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { throwError } from 'rxjs';
import { vi } from 'vitest';

import { BillingService } from '../../../../shared/services/billing.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { CreditNoteDialog } from './credit-note-dialog';

describe('CreditNoteDialog', () => {
  let component: CreditNoteDialog;
  let ref: { close: ReturnType<typeof vi.fn> };
  let billing: { createCreditNote: ReturnType<typeof vi.fn> };
  let errorHandler: { handleError: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    ref = { close: vi.fn() };
    billing = { createCreditNote: vi.fn() };
    errorHandler = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [CreditNoteDialog, TranslateModule.forRoot()],
      providers: [
        { provide: DynamicDialogRef, useValue: ref },
        { provide: DynamicDialogConfig, useValue: { data: { invoice: { id: 42 } } } },
        { provide: BillingService, useValue: billing },
        { provide: SnackbarNotification, useValue: { openSnackBar: vi.fn() } },
        { provide: ErrorMessageHandler, useValue: errorHandler },
      ],
    })
      .overrideComponent(CreditNoteDialog, { set: { template: '' } })
      .compileComponents();

    const fixture = TestBed.createComponent(CreditNoteDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("shows the server's message when the credit note is refused, and stays open", () => {
    const message = 'This invoice already has a credit note';
    // HttpClient fails with an HttpErrorResponse; the backend's message is in its body.
    billing.createCreditNote.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { data: message, error_code: 6109 } }),
      ),
    );

    component.submit();

    expect(errorHandler.handleError).toHaveBeenCalledWith(message);
    expect(ref.close).not.toHaveBeenCalled();
    expect(component.submitting()).toBe(false);
  });
});
