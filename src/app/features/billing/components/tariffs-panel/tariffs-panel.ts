import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';

import { ApiResponse } from '../../../../core/dtos/api.response';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { TariffOut, TariffScope } from '../../../../shared/dtos/billing.dtos';
import { SharingOperationPartialDTO } from '../../../../shared/dtos/sharing_operation.dtos';
import { BillingService } from '../../../../shared/services/billing.service';
import { SharingOperationService } from '../../../../shared/services/sharing_operation.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { formatPrice, tariffKindLabelKey, tariffScopeLabelKey } from '../../billing-format';
import { TariffDialog } from '../tariff-dialog/tariff-dialog';

const OPERATIONS_PAGE_LIMIT = 100;

@Component({
  selector: 'app-tariffs-panel',
  standalone: true,
  imports: [FormsModule, TranslatePipe, Button, ConfirmDialog, Select, Skeleton],
  providers: [DialogService, ConfirmationService, ErrorMessageHandler],
  templateUrl: './tariffs-panel.html',
})
export class TariffsPanel implements OnInit {
  private readonly service = inject(BillingService);
  private readonly operationService = inject(SharingOperationService);
  private readonly translate = inject(TranslateService);
  private readonly dialogService = inject(DialogService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);
  private dialogRef?: DynamicDialogRef | null;

  readonly operations = signal<SharingOperationPartialDTO[]>([]);
  readonly operationsLoading = signal<boolean>(true);
  readonly selectedOpId = signal<number | null>(null);
  readonly tariffs = signal<TariffOut[]>([]);
  readonly loading = signal<boolean>(false);

  protected readonly TariffScope = TariffScope;

  constructor() {
    this.destroyRef.onDestroy(() => this.dialogRef?.destroy());
  }

  ngOnInit(): void {
    this.loadOperations();
  }

  private loadOperations(): void {
    this.operationsLoading.set(true);
    this.operationService
      .getSharingOperationList({ page: 1, limit: OPERATIONS_PAGE_LIMIT })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.operations.set(Array.isArray(res.data) ? res.data : []);
          this.operationsLoading.set(false);
        },
        error: (error: unknown) => {
          this.operationsLoading.set(false);
          this.handleError(error);
        },
      });
  }

  onOperationChange(operationId: number | null): void {
    this.selectedOpId.set(operationId);
    if (operationId != null) this.loadTariffs();
    else this.tariffs.set([]);
  }

  loadTariffs(): void {
    const operationId = this.selectedOpId();
    if (operationId == null) return;
    this.loading.set(true);
    this.service
      .listTariffs(operationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.tariffs.set(Array.isArray(res.data) ? res.data : []);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.handleError(error);
        },
      });
  }

  openCreate(): void {
    const operationId = this.selectedOpId();
    if (operationId == null) return;
    this.dialogRef = this.dialogService.open(TariffDialog, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      width: '34rem',
      styleClass: 'responsive-dialog',
      header: this.translate.instant('BILLING.TARIFF_DIALOG.TITLE') as string,
      data: { operationId },
    });
    this.dialogRef?.onClose
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((saved: boolean) => {
        if (saved) {
          this.service.invalidate();
          this.loadTariffs();
        }
      });
  }

  confirmDelete(tariff: TariffOut): void {
    this.confirmation.confirm({
      header: this.translate.instant('BILLING.TARIFFS.DELETE_CONFIRM_HEADER') as string,
      message: this.translate.instant('BILLING.TARIFFS.DELETE_CONFIRM_MESSAGE') as string,
      acceptLabel: this.translate.instant('COMMON.ACTIONS.VALIDATE') as string,
      rejectLabel: this.translate.instant('COMMON.ACTIONS.CANCEL') as string,
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this.service
          .deleteTariff(tariff.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.snackbar.openSnackBar(
                this.translate.instant('BILLING.TARIFFS.DELETED') as string,
                VALIDATION_TYPE,
              );
              this.tariffs.update((list) => list.filter((t) => t.id !== tariff.id));
            },
            error: (error: unknown) => this.handleError(error),
          });
      },
    });
  }

  // ----- display helpers -------------------------------------------------

  kindLabelKey(tariff: TariffOut): string {
    return tariffKindLabelKey(tariff.kind);
  }
  scopeLabelKey(tariff: TariffOut): string {
    return tariffScopeLabelKey(tariff.scope);
  }
  segmentLabelKey(segment: number): string {
    const names: Record<number, string> = {
      1: 'BILLING.TARIFF_SEGMENT.RESIDENTIAL',
      2: 'BILLING.TARIFF_SEGMENT.PROFESSIONAL',
      3: 'BILLING.TARIFF_SEGMENT.INDUSTRIAL',
    };
    return names[segment] ?? String(segment);
  }
  price(tariff: TariffOut): string {
    return formatPrice(tariff.price_per_kwh, tariff.currency);
  }

  private handleError(error: unknown): void {
    this.errorHandler.handleError(error instanceof ApiResponse ? (error.data as string) : null);
  }
}
