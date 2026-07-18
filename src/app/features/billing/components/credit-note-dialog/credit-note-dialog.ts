import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Textarea } from 'primeng/textarea';

import { ApiResponse } from '../../../../core/dtos/api.response';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { CreditNoteIn, InvoiceOut } from '../../../../shared/dtos/billing.dtos';
import { BillingService } from '../../../../shared/services/billing.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';

interface CreditNoteDialogData {
  invoice: InvoiceOut;
}

@Component({
  selector: 'app-credit-note-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, Button, Textarea],
  templateUrl: './credit-note-dialog.html',
})
export class CreditNoteDialog {
  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig<CreditNoteDialogData>);
  private readonly service = inject(BillingService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  private readonly dialogData = this.config.data as CreditNoteDialogData | undefined;
  private readonly invoice = this.dialogData?.invoice;

  readonly submitting = signal<boolean>(false);

  readonly form = new FormGroup({
    reason: new FormControl<string>('', { nonNullable: true }),
  });

  submit(): void {
    if (!this.invoice) return;
    const reason = this.form.controls.reason.value.trim();
    const body: CreditNoteIn = { reason: reason || null };

    this.submitting.set(true);
    this.service
      .createCreditNote(this.invoice.id, body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackbar.openSnackBar(
            this.translate.instant('BILLING.CREDIT_NOTE.SUCCESS') as string,
            VALIDATION_TYPE,
          );
          this.ref.close(true);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.errorHandler.handleError(
            error instanceof ApiResponse ? (error.data as string) : null,
          );
        },
      });
  }

  close(): void {
    this.ref.close(false);
  }
}
