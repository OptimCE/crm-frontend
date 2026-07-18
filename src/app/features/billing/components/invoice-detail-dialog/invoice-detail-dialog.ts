import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';

import { ApiResponse } from '../../../../core/dtos/api.response';
import {
  BillingDirection,
  InvoiceOut,
  Measure,
  PaymentOut,
} from '../../../../shared/dtos/billing.dtos';
import { BillingService } from '../../../../shared/services/billing.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import {
  formatMoney,
  invoiceStatusLabelKey,
  invoiceStatusSeverity,
  invoiceTypeLabelKey,
  paymentMethodLabelKey,
  TagSeverity,
} from '../../billing-format';

interface InvoiceDetailDialogData {
  invoiceId: number;
}

@Component({
  selector: 'app-invoice-detail-dialog',
  standalone: true,
  imports: [DatePipe, TranslatePipe, Button, Skeleton, Tag],
  templateUrl: './invoice-detail-dialog.html',
})
export class InvoiceDetailDialog implements OnInit {
  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig<InvoiceDetailDialogData>);
  private readonly service = inject(BillingService);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  private readonly dialogData = this.config.data as InvoiceDetailDialogData | undefined;
  private readonly invoiceId = this.dialogData?.invoiceId ?? 0;

  readonly loading = signal<boolean>(true);
  readonly invoice = signal<InvoiceOut | null>(null);
  readonly payments = signal<PaymentOut[]>([]);

  ngOnInit(): void {
    forkJoin({
      invoice: this.service.getInvoice(this.invoiceId),
      payments: this.service.listPayments(this.invoiceId),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ invoice, payments }) => {
          this.invoice.set(invoice.data);
          this.payments.set(Array.isArray(payments.data) ? payments.data : []);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorHandler.handleError(
            error instanceof ApiResponse ? (error.data as string) : null,
          );
        },
      });
  }

  statusLabelKey(inv: InvoiceOut): string {
    return invoiceStatusLabelKey(inv.status);
  }
  statusSeverity(inv: InvoiceOut): TagSeverity {
    return invoiceStatusSeverity(inv.status);
  }
  typeLabelKey(inv: InvoiceOut): string {
    return invoiceTypeLabelKey(inv.type);
  }
  money(amount: string | null | undefined, currency: string): string {
    return formatMoney(amount, currency);
  }
  methodLabelKey(method: PaymentOut['method']): string {
    return paymentMethodLabelKey(method);
  }
  directionLabelKey(direction: BillingDirection): string {
    return `BILLING.DIRECTION.${BillingDirection[direction]}`;
  }
  measureLabelKey(measure: Measure): string {
    return `BILLING.MEASURE.${Measure[measure]}`;
  }

  close(): void {
    this.ref.close();
  }
}
