import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ProcedureStatus } from '../../../../shared/dtos/administrative-procedure.dtos';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';

import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { LocaleService } from '../../../../core/services/language/locale.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeProcedureService } from '../../../../shared/services/administrative-procedure.service';
import {
  extractApiErrorCode,
  extractApiErrorMessage,
  toApiDate,
} from '../../administrative-document-format';
import { ProcedureDialogData, pickLabel } from '../procedure-format';

/** The annex's TRANSITION_NOT_ALLOWED: the procedure moved while this was open. */
const TRANSITION_NOT_ALLOWED = 2379;
/** EFFECT_CONFLICT: into force, the core refused (one EAN per operation per date). */
const EFFECT_CONFLICT = 2391;
const REASON_MAX = 500;

interface StepOption {
  label: string;
  value: string;
}

/**
 * A step change by hand, along one of the catalogue's edges from here, with a
 * mandatory reason (journaled, audited). For what no response type records: a
 * correction, a lapse the GRD confirmed by phone, a July dossier's real outcome.
 * The edges come from the annex (`transitions`), so nothing here knows a step.
 */
@Component({
  selector: 'app-procedure-transition-dialog',
  standalone: true,
  imports: [TranslatePipe, FormsModule, Button, DatePicker, Select, Textarea],
  templateUrl: './procedure-transition-dialog.html',
  providers: [ErrorMessageHandler],
})
export class ProcedureTransitionDialog {
  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig<ProcedureDialogData>);
  private readonly service = inject(AdministrativeProcedureService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lang = inject(LocaleService).locale();

  readonly detail = (this.config.data as ProcedureDialogData | undefined)?.detail ?? null;
  readonly reasonMax = REASON_MAX;

  /** An automatic edge may be taken by hand too; it says so. */
  readonly stepOptions: StepOption[] = (this.detail?.transitions ?? []).map((edge) => {
    const label = pickLabel(edge.labels, this.lang, edge.to_step);
    return {
      value: edge.to_step,
      label: edge.automatic
        ? (this.translate.instant('ADMINISTRATIVE_DOCUMENT.PROCEDURES.TRANSITION.AUTOMATIC', {
            step: label,
          }) as string)
        : label,
    };
  });

  toStep: string | null = null;
  reason = '';
  on: Date = new Date();
  readonly today = new Date();

  readonly submitting = signal<boolean>(false);
  readonly formError = signal<string | null>(null);
  /** The EANs the core refused, on a step into force. */
  readonly conflicts = signal<string[]>([]);

  /** Into force by hand: the core is written first, on this date (the effect date). */
  targetInForce(): boolean {
    const step = this.detail?.timeline.find((s) => s.code === this.toStep);
    return step?.status === ProcedureStatus.IN_FORCE;
  }

  submit(): void {
    this.formError.set(null);
    this.conflicts.set([]);
    const detail = this.detail;
    if (!detail) return;
    const reason = this.reason.trim();
    if (!this.toStep || !reason) {
      this.formError.set(
        this.translate.instant(
          'ADMINISTRATIVE_DOCUMENT.PROCEDURES.TRANSITION.ERRORS.REQUIRED',
        ) as string,
      );
      return;
    }
    this.submitting.set(true);
    this.service
      .transition(detail.id, { to_step: this.toStep, reason, on: toApiDate(this.on) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.snackbar.openSnackBar(
            this.translate.instant('ADMINISTRATIVE_DOCUMENT.PROCEDURES.TRANSITION.DONE') as string,
            VALIDATION_TYPE,
          );
          this.ref.close(res.data);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          const code = extractApiErrorCode(error);
          if (code === TRANSITION_NOT_ALLOWED || code === EFFECT_CONFLICT) {
            this.formError.set(extractApiErrorMessage(error));
            const listed = (error as { error?: { conflicts?: unknown } } | null)?.error?.conflicts;
            this.conflicts.set(Array.isArray(listed) ? listed.map(String) : []);
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
