import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Textarea } from 'primeng/textarea';

import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import {
  ChangeOut,
  ProcedureDetailOut,
} from '../../../../shared/dtos/administrative-procedure.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeProcedureService } from '../../../../shared/services/administrative-procedure.service';
import { extractApiErrorMessage } from '../../administrative-document-format';
import { I18nText, changeKindText } from '../procedure-format';

export interface ChangeExcludeDialogData {
  detail: ProcedureDetailOut;
  change: ChangeOut;
}

const REASON_MAX = 500;

/**
 * "Exclure": the admin decides a change needs no procedure. The reason is
 * mandatory: it is journaled and audited, and it is what a later reader has to
 * understand why this meter was never notified.
 */
@Component({
  selector: 'app-change-exclude-dialog',
  standalone: true,
  imports: [TranslatePipe, FormsModule, Button, Textarea],
  templateUrl: './change-exclude-dialog.html',
  providers: [ErrorMessageHandler],
})
export class ChangeExcludeDialog {
  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig<ChangeExcludeDialogData>);
  private readonly service = inject(AdministrativeProcedureService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  private readonly data = this.config.data as ChangeExcludeDialogData | undefined;
  readonly change = this.data?.change ?? null;
  readonly kind: I18nText | null = this.change ? changeKindText(this.change.kind) : null;
  readonly reasonMax = REASON_MAX;

  reason = '';
  readonly submitting = signal<boolean>(false);
  readonly formError = signal<string | null>(null);

  submit(): void {
    this.formError.set(null);
    const data = this.data;
    const reason = this.reason.trim();
    if (!data) return;
    if (!reason) {
      this.formError.set(
        this.translate.instant(
          'ADMINISTRATIVE_DOCUMENT.PROCEDURES.CHANGES.ERRORS.REASON_REQUIRED',
        ) as string,
      );
      return;
    }
    this.submitting.set(true);
    this.service
      .excludeChange(data.detail.id, data.change.id, { reason })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.snackbar.openSnackBar(
            this.translate.instant('ADMINISTRATIVE_DOCUMENT.PROCEDURES.CHANGES.EXCLUDED') as string,
            VALIDATION_TYPE,
          );
          this.ref.close(res.data);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }

  close(): void {
    this.ref.close(null);
  }
}
