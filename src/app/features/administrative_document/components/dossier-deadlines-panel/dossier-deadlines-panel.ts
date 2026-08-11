import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Tag } from 'primeng/tag';

import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { DeadlineOut, DeadlineStatus } from '../../../../shared/dtos/administrative-document.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeDocumentService } from '../../../../shared/services/administrative-document.service';
import {
  TagSeverity,
  deadlineStatusLabelKey,
  deadlineStatusSeverity,
  deadlineTypeLabelKey,
  extractApiErrorMessage,
  formatApiDate,
  isOverdue,
} from '../../administrative-document-format';

@Component({
  selector: 'app-dossier-deadlines-panel',
  standalone: true,
  imports: [TranslatePipe, Button, Tag, ConfirmDialog],
  templateUrl: './dossier-deadlines-panel.html',
  providers: [ConfirmationService, ErrorMessageHandler],
})
export class DossierDeadlinesPanel {
  private readonly service = inject(AdministrativeDocumentService);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly deadlines = input<DeadlineOut[]>([]);
  readonly changed = output<void>();

  readonly busyIds = signal<ReadonlySet<number>>(new Set());

  markMet(deadline: DeadlineOut): void {
    this.confirmResolve(deadline, DeadlineStatus.MET, 'MARK_MET');
  }

  cancel(deadline: DeadlineOut): void {
    this.confirmResolve(deadline, DeadlineStatus.CANCELLED, 'CANCEL');
  }

  private confirmResolve(
    deadline: DeadlineOut,
    status: DeadlineStatus.MET | DeadlineStatus.CANCELLED,
    keySuffix: string,
  ): void {
    this.confirmation.confirm({
      header: this.translate.instant(
        `ADMINISTRATIVE_DOCUMENT.DEADLINES.${keySuffix}_CONFIRM_HEADER`,
      ) as string,
      message: this.translate.instant(
        `ADMINISTRATIVE_DOCUMENT.DEADLINES.${keySuffix}_CONFIRM_MESSAGE`,
      ) as string,
      acceptLabel: this.translate.instant('COMMON.ACTIONS.VALIDATE') as string,
      rejectLabel: this.translate.instant('COMMON.ACTIONS.CANCEL') as string,
      accept: () => this.resolve(deadline, status),
    });
  }

  private resolve(
    deadline: DeadlineOut,
    status: DeadlineStatus.MET | DeadlineStatus.CANCELLED,
  ): void {
    this.busyIds.update((set) => new Set(set).add(deadline.id));
    this.service
      .resolveDeadline(deadline.id, { status })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.stopBusy(deadline.id);
          this.snackbar.openSnackBar(
            this.translate.instant('ADMINISTRATIVE_DOCUMENT.DEADLINES.RESOLVED') as string,
            VALIDATION_TYPE,
          );
          this.changed.emit();
        },
        error: (error: unknown) => {
          this.stopBusy(deadline.id);
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }

  private stopBusy(id: number): void {
    this.busyIds.update((set) => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });
  }

  // ---- presentation helpers ----------------------------------------------

  isBusy(deadline: DeadlineOut): boolean {
    return this.busyIds().has(deadline.id);
  }

  isOpen(deadline: DeadlineOut): boolean {
    return deadline.status === DeadlineStatus.OPEN;
  }

  isLate(deadline: DeadlineOut): boolean {
    return this.isOpen(deadline) && isOverdue(deadline.due_date);
  }

  typeLabelKey(deadline: DeadlineOut): string {
    return deadlineTypeLabelKey(deadline.deadline_type);
  }

  statusLabelKey(deadline: DeadlineOut): string {
    return deadlineStatusLabelKey(deadline.status);
  }

  statusSeverity(deadline: DeadlineOut): TagSeverity {
    return this.isLate(deadline) ? 'danger' : deadlineStatusSeverity(deadline.status);
  }

  dueDate(deadline: DeadlineOut): string {
    return formatApiDate(deadline.due_date);
  }
}
