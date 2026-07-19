import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';

import { ApiResponse } from '../../../../core/dtos/api.response';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { InvoiceOut, PaymentIn, PaymentMethod } from '../../../../shared/dtos/billing.dtos';
import { BillingService } from '../../../../shared/services/billing.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { toApiDate } from '../../billing-format';

interface PaymentDialogData {
  invoice: InvoiceOut;
}

interface SelectOption {
  label: string;
  value: number;
}

@Component({
  selector: 'app-payment-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, Button, DatePicker, InputText, Select],
  templateUrl: './payment-dialog.html',
})
export class PaymentDialog implements OnInit {
  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig<PaymentDialogData>);
  private readonly service = inject(BillingService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  private readonly dialogData = this.config.data as PaymentDialogData | undefined;
  private readonly invoice = this.dialogData?.invoice;

  readonly submitting = signal<boolean>(false);
  readonly formError = signal<string | null>(null);

  methodOptions: SelectOption[] = [];

  readonly form = new FormGroup({
    amount: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d+(\.\d+)?$/)],
    }),
    method: new FormControl<PaymentMethod>(PaymentMethod.BANK_TRANSFER, { nonNullable: true }),
    reference: new FormControl<string>('', { nonNullable: true }),
    paid_on: new FormControl<Date | null>(null),
  });

  ngOnInit(): void {
    const t = (key: string): string => this.translate.instant(key) as string;
    this.methodOptions = [
      { label: t('BILLING.PAYMENT_METHOD.BANK_TRANSFER'), value: PaymentMethod.BANK_TRANSFER },
      { label: t('BILLING.PAYMENT_METHOD.DIRECT_DEBIT'), value: PaymentMethod.DIRECT_DEBIT },
      { label: t('BILLING.PAYMENT_METHOD.CASH'), value: PaymentMethod.CASH },
      { label: t('BILLING.PAYMENT_METHOD.OTHER'), value: PaymentMethod.OTHER },
    ];
    // Prefill with the invoice total as a sensible default.
    if (this.invoice) this.form.controls.amount.setValue(this.invoice.total);
  }

  submit(): void {
    this.formError.set(null);
    this.form.markAllAsTouched();
    if (this.form.controls.amount.invalid || !this.invoice) {
      this.formError.set(
        this.translate.instant('BILLING.PAYMENT_DIALOG.ERRORS.AMOUNT_REQUIRED') as string,
      );
      return;
    }

    const raw = this.form.getRawValue();
    const body: PaymentIn = {
      amount: raw.amount.trim(),
      method: raw.method,
      reference: raw.reference.trim() || null,
      paid_on: toApiDate(raw.paid_on),
    };

    this.submitting.set(true);
    this.service
      .registerPayment(this.invoice.id, body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackbar.openSnackBar(
            this.translate.instant('BILLING.PAYMENT.SUCCESS') as string,
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
