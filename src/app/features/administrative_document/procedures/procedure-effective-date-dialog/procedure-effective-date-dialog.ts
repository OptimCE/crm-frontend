import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Textarea } from 'primeng/textarea';

import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeProcedureService } from '../../../../shared/services/administrative-procedure.service';
import {
  extractApiErrorCode,
  extractApiErrorMessage,
  parseApiDate,
  toApiDate,
} from '../../administrative-document-format';
import { ProcedureDialogData } from '../procedure-format';

/** The annex's EFFECTIVE_DATE_NOT_OPEN: the effect is no longer to come. */
const EFFECTIVE_DATE_NOT_OPEN = 2397;
const REASON_MAX = 500;

/**
 * Correct the effect date by hand (phase 4): the GRD took effect from another
 * day than the one counted (the amendment received later than recorded, a
 * date the GRD set). Only while the effect is still to come; the daily job then
 * applies it on that day. The reason is kept in the procedure's thread.
 */
@Component({
  selector: 'app-procedure-effective-date-dialog',
  standalone: true,
  imports: [TranslatePipe, FormsModule, Button, DatePicker, Textarea],
  templateUrl: './procedure-effective-date-dialog.html',
  providers: [ErrorMessageHandler],
})
export class ProcedureEffectiveDateDialog {
  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig<ProcedureDialogData>);
  private readonly service = inject(AdministrativeProcedureService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  readonly detail = (this.config.data as ProcedureDialogData | undefined)?.detail ?? null;
  readonly reasonMax = REASON_MAX;

  on: Date | null = parseApiDate(this.detail?.effective_date);
  reason = '';

  readonly submitting = signal<boolean>(false);
  readonly formError = signal<string | null>(null);

  submit(): void {
    this.formError.set(null);
    const detail = this.detail;
    if (!detail) return;
    const reason = this.reason.trim();
    const on = toApiDate(this.on);
    if (!on || !reason) {
      this.formError.set(
        this.translate.instant(
          'ADMINISTRATIVE_DOCUMENT.PROCEDURES.EFFECTIVE_DATE.ERRORS.REQUIRED',
        ) as string,
      );
      return;
    }
    this.submitting.set(true);
    this.service
      .correctEffectiveDate(detail.id, { on, reason })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.snackbar.openSnackBar(
            this.translate.instant(
              'ADMINISTRATIVE_DOCUMENT.PROCEDURES.EFFECTIVE_DATE.DONE',
            ) as string,
            VALIDATION_TYPE,
          );
          this.ref.close(res.data);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          if (extractApiErrorCode(error) === EFFECTIVE_DATE_NOT_OPEN) {
            this.formError.set(extractApiErrorMessage(error));
            return;
          }
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }

  close(): void {
    this.ref.close(null);
  }
}
