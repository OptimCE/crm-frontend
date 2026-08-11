import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { switchMap, timer } from 'rxjs';

import { ApiResponse } from '../../../../core/dtos/api.response';
import { ERROR_TYPE, VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { InvoiceOut, InvoiceStatus, InvoiceType } from '../../../../shared/dtos/billing.dtos';
import { BillingService } from '../../../../shared/services/billing.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { downloadBlob } from '../../../../shared/utils/download.utils';
import {
  formatMoney,
  invoiceStatusLabelKey,
  invoiceStatusSeverity,
  invoiceTypeLabelKey,
  TagSeverity,
} from '../../billing-format';
import { CreditNoteDialog } from '../credit-note-dialog/credit-note-dialog';
import { InvoiceDetailDialog } from '../invoice-detail-dialog/invoice-detail-dialog';
import { PaymentDialog } from '../payment-dialog/payment-dialog';

/** Poll cadence + cap while waiting for an async PDF render to land. */
const PDF_POLL_INTERVAL_MS = 3500;
const PDF_POLL_MAX_ATTEMPTS = 15;

/**
 * Reusable invoice list with per-invoice, status-gated actions. Performs the
 * mutations itself (issue / send / payment / credit-note) and emits `changed`
 * so the host can reload. Used by both the run-generate and tracking-board tabs.
 */
@Component({
  selector: 'app-invoice-list',
  standalone: true,
  imports: [RouterLink, DatePipe, TranslatePipe, Button, Tag, Tooltip],
  providers: [DialogService],
  templateUrl: './invoice-list.html',
})
export class InvoiceList {
  private readonly service = inject(BillingService);
  private readonly translate = inject(TranslateService);
  private readonly dialogService = inject(DialogService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);
  private dialogRef?: DynamicDialogRef | null;

  readonly invoices = input<InvoiceOut[]>([]);
  readonly memberNames = input<ReadonlyMap<number, string> | null>(null);
  readonly showMember = input<boolean>(false);
  /**
   * Whether the member name links to `/members/{id}`.
   *
   * Off by default: this component renders in the member view too, and that route
   * is `minRole GESTIONNAIRE`. The host binds the role check rather than the
   * component reading it, so a MANAGER→MEMBER community switch takes the link
   * away with the console.
   */
  readonly linkMember = input<boolean>(false);

  readonly changed = output<void>();

  /** Invoice ids with a render in flight (spinner + disabled generate control). */
  private readonly generatingIds = signal<Set<number>>(new Set());

  constructor() {
    this.destroyRef.onDestroy(() => this.dialogRef?.destroy());
  }

  // ----- display helpers -------------------------------------------------

  statusLabelKey(inv: InvoiceOut): string {
    return invoiceStatusLabelKey(inv.status);
  }
  statusSeverity(inv: InvoiceOut): TagSeverity {
    return invoiceStatusSeverity(inv.status);
  }
  typeLabelKey(inv: InvoiceOut): string {
    return invoiceTypeLabelKey(inv.type);
  }
  isCreditNote(inv: InvoiceOut): boolean {
    return inv.type === InvoiceType.CREDIT_NOTE;
  }
  money(inv: InvoiceOut): string {
    return formatMoney(inv.total, inv.currency);
  }
  memberName(inv: InvoiceOut): string {
    return this.memberNames()?.get(inv.id_member) ?? `#${inv.id_member}`;
  }

  // ----- action gating ---------------------------------------------------

  canIssue(inv: InvoiceOut): boolean {
    return inv.status === InvoiceStatus.DRAFT;
  }
  canSend(inv: InvoiceOut): boolean {
    return inv.status === InvoiceStatus.ISSUED;
  }
  canPay(inv: InvoiceOut): boolean {
    return (
      inv.status === InvoiceStatus.ISSUED ||
      inv.status === InvoiceStatus.SENT ||
      inv.status === InvoiceStatus.OVERDUE
    );
  }
  canCreditNote(inv: InvoiceOut): boolean {
    return (
      inv.type === InvoiceType.INVOICE &&
      (inv.status === InvoiceStatus.ISSUED ||
        inv.status === InvoiceStatus.SENT ||
        inv.status === InvoiceStatus.PAID ||
        inv.status === InvoiceStatus.OVERDUE)
    );
  }

  // ----- PDF gating ------------------------------------------------------

  canDownloadPdf(inv: InvoiceOut): boolean {
    return inv.pdf_ready;
  }
  /** Renderable = anything except a cancelled invoice (a DRAFT renders a proforma). */
  canGeneratePdf(inv: InvoiceOut): boolean {
    return inv.status !== InvoiceStatus.CANCELLED;
  }
  canDeletePdf(inv: InvoiceOut): boolean {
    return (
      inv.pdf_ready &&
      inv.status !== InvoiceStatus.SENT &&
      inv.status !== InvoiceStatus.PAID &&
      inv.status !== InvoiceStatus.OVERDUE
    );
  }
  isGenerating(inv: InvoiceOut): boolean {
    return this.generatingIds().has(inv.id);
  }

  // ----- actions ---------------------------------------------------------

  downloadPdf(inv: InvoiceOut): void {
    this.service
      .downloadInvoicePdf(inv.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ blob, filename }) => downloadBlob(blob, filename),
        error: () =>
          this.snackbar.openSnackBar(
            this.translate.instant('BILLING.PDF.DOWNLOAD_FAILED') as string,
            ERROR_TYPE,
          ),
      });
  }

  generatePdf(inv: InvoiceOut, force: boolean): void {
    if (this.isGenerating(inv)) return;
    this.startGenerating(inv.id);
    this.service
      .generateInvoicePdf(inv.id, force)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackbar.openSnackBar(
            this.translate.instant('BILLING.PDF.GENERATE_STARTED') as string,
            VALIDATION_TYPE,
          );
          this.pollPdf(inv.id, 0);
        },
        error: (error: unknown) => {
          this.stopGenerating(inv.id);
          this.handleError(error);
        },
      });
  }

  deletePdf(inv: InvoiceOut): void {
    this.service
      .deleteInvoicePdf(inv.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackbar.openSnackBar(
            this.translate.instant('BILLING.PDF.DELETE_SUCCESS') as string,
            VALIDATION_TYPE,
          );
          this.changed.emit();
        },
        error: (error: unknown) => this.handleError(error),
      });
  }

  private startGenerating(id: number): void {
    this.generatingIds.update((s) => new Set(s).add(id));
  }
  private stopGenerating(id: number): void {
    this.generatingIds.update((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  }

  /** Poll the invoice until the render lands (pdf_ready) or fails; then reload. */
  private pollPdf(id: number, attempt: number): void {
    timer(PDF_POLL_INTERVAL_MS)
      .pipe(
        switchMap(() => this.service.getInvoiceLive(id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          const inv = res.data;
          if (inv.pdf_ready) {
            this.stopGenerating(id);
            this.snackbar.openSnackBar(
              this.translate.instant('BILLING.PDF.GENERATE_SUCCESS') as string,
              VALIDATION_TYPE,
            );
            this.changed.emit();
          } else if (inv.status === InvoiceStatus.RENDER_FAILED) {
            this.stopGenerating(id);
            this.snackbar.openSnackBar(
              this.translate.instant('BILLING.PDF.GENERATE_FAILED') as string,
              ERROR_TYPE,
            );
            this.changed.emit();
          } else if (attempt + 1 >= PDF_POLL_MAX_ATTEMPTS) {
            this.stopGenerating(id);
            this.changed.emit();
          } else {
            this.pollPdf(id, attempt + 1);
          }
        },
        error: () => this.stopGenerating(id),
      });
  }

  issue(inv: InvoiceOut): void {
    this.service
      .issueInvoice(inv.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.snackbar.openSnackBar(
            this.translate.instant('BILLING.ISSUE.SUCCESS', {
              number: res.data.number,
              ogm: res.data.structured_comm ?? '',
            }) as string,
            VALIDATION_TYPE,
          );
          this.changed.emit();
        },
        error: (error: unknown) => this.handleError(error),
      });
  }

  send(inv: InvoiceOut): void {
    this.service
      .sendInvoice(inv.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackbar.openSnackBar(
            this.translate.instant('BILLING.SEND.SUCCESS') as string,
            VALIDATION_TYPE,
          );
          this.changed.emit();
        },
        error: (error: unknown) => this.handleError(error),
      });
  }

  openPayment(inv: InvoiceOut): void {
    this.dialogRef = this.dialogService.open(PaymentDialog, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      width: '32rem',
      styleClass: 'responsive-dialog',
      header: this.translate.instant('BILLING.PAYMENT_DIALOG.TITLE') as string,
      data: { invoice: inv },
    });
    this.onDialogClosed();
  }

  openCreditNote(inv: InvoiceOut): void {
    this.dialogRef = this.dialogService.open(CreditNoteDialog, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      width: '32rem',
      styleClass: 'responsive-dialog',
      header: this.translate.instant('BILLING.CREDIT_NOTE_DIALOG.TITLE') as string,
      data: { invoice: inv },
    });
    this.onDialogClosed();
  }

  openDetail(inv: InvoiceOut): void {
    this.dialogRef = this.dialogService.open(InvoiceDetailDialog, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      width: '46rem',
      styleClass: 'responsive-dialog',
      header: this.translate.instant('BILLING.DETAIL.TITLE') as string,
      data: { invoiceId: inv.id },
    });
  }

  private onDialogClosed(): void {
    this.dialogRef?.onClose
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((saved: boolean) => {
        if (saved) this.changed.emit();
      });
  }

  private handleError(error: unknown): void {
    this.errorHandler.handleError(error instanceof ApiResponse ? (error.data as string) : null);
  }
}
