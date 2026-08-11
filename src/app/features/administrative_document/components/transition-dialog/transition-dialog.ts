import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';

import { ApiResponse } from '../../../../core/dtos/api.response';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import {
  AcknowledgementResult,
  DocumentOut,
  DossierOut,
  SubjectType,
} from '../../../../shared/dtos/administrative-document.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeDocumentService } from '../../../../shared/services/administrative-document.service';
import {
  ERROR_CODE,
  documentStatusLabelKey,
  dossierStatusLabelKey,
  extractApiErrorCode,
  extractApiErrorMessage,
  toApiDate,
} from '../../administrative-document-format';
import {
  TransitionField,
  TransitionFieldKey,
  isCorrective,
  resolveTransitionCall,
  transitionFields,
} from '../../administrative-document-transitions';

export interface TransitionDialogData {
  subject: SubjectType;
  subjectId: number;
  fromStatus: number;
  toStatus: number;
  /** Already-resolved display name for the header line. */
  subjectLabel: string;
}

@Component({
  selector: 'app-transition-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    Button,
    DatePicker,
    InputText,
    Select,
    Textarea,
    Message,
  ],
  templateUrl: './transition-dialog.html',
  providers: [ErrorMessageHandler],
})
export class TransitionDialog {
  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig<TransitionDialogData>);
  private readonly service = inject(AdministrativeDocumentService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  private readonly data = this.config.data as TransitionDialogData | undefined;

  readonly submitting = signal<boolean>(false);
  readonly formError = signal<string | null>(null);

  readonly subjectLabel = this.data?.subjectLabel ?? '';
  readonly fields: readonly TransitionField[] = this.data
    ? transitionFields(this.data.subject, this.data.fromStatus, this.data.toStatus)
    : [];
  readonly corrective =
    this.data !== undefined &&
    isCorrective(this.data.subject, this.data.fromStatus, this.data.toStatus);

  private readonly fieldKeys = new Set<TransitionFieldKey>(this.fields.map((f) => f.key));

  readonly resultOptions = [
    {
      label: this.translate.instant('ADMINISTRATIVE_DOCUMENT.ACK_RESULT.COMPLETE') as string,
      value: 'complete',
    },
    {
      label: this.translate.instant('ADMINISTRATIVE_DOCUMENT.ACK_RESULT.INCOMPLETE') as string,
      value: 'incomplete',
    },
  ];

  /**
   * One fixed, fully-typed FormGroup holding every possible control; the
   * template renders only the ones `fields` asks for. Building controls
   * dynamically would make each `formControlName` unverifiable at compile time.
   */
  readonly form = new FormGroup({
    submission_date: new FormControl<Date | null>(null),
    acknowledged_date: new FormControl<Date | null>(null),
    authority_file_ref: new FormControl<string>('', { nonNullable: true }),
    reason: new FormControl<string>('', { nonNullable: true }),
    result: new FormControl<AcknowledgementResult>('complete', { nonNullable: true }),
    note: new FormControl<string>('', { nonNullable: true }),
  });

  shows(key: TransitionFieldKey): boolean {
    return this.fieldKeys.has(key);
  }

  fromLabelKey(): string {
    if (!this.data) return '';
    return this.data.subject === SubjectType.DOCUMENT
      ? documentStatusLabelKey(this.data.fromStatus)
      : dossierStatusLabelKey(this.data.fromStatus);
  }

  toLabelKey(): string {
    if (!this.data) return '';
    return this.data.subject === SubjectType.DOCUMENT
      ? documentStatusLabelKey(this.data.toStatus)
      : dossierStatusLabelKey(this.data.toStatus);
  }

  submit(): void {
    this.formError.set(null);
    if (!this.data) return;

    const raw = this.form.getRawValue();

    // Manual validation against the field descriptors, so the dialog and the
    // backend agree on exactly what this edge requires.
    for (const field of this.fields.filter((f) => f.required)) {
      const missing =
        field.kind === 'date'
          ? raw[field.key as 'submission_date' | 'acknowledged_date'] == null
          : !String(raw[field.key as 'authority_file_ref' | 'reason' | 'note']).trim();
      if (missing) {
        this.formError.set(
          this.translate.instant('ADMINISTRATIVE_DOCUMENT.TRANSITION.ERRORS.FIELD_REQUIRED', {
            field: this.translate.instant(field.labelKey) as string,
          }) as string,
        );
        return;
      }
    }

    const call = resolveTransitionCall(this.data.subject, this.data.fromStatus, this.data.toStatus);
    const isDocument = this.data.subject === SubjectType.DOCUMENT;
    const id = this.data.subjectId;
    const note = raw.note.trim() || null;

    let request$: Observable<ApiResponse<DocumentOut | DossierOut>>;
    switch (call.kind) {
      case 'mark-ready':
        request$ = this.service.markDocumentReady(id);
        break;
      case 'mark-sent':
        request$ = this.service.markDocumentSent(id, {
          submission_date: toApiDate(raw.submission_date) ?? '',
          note,
        });
        break;
      case 'acknowledge':
        request$ = this.service.acknowledgeDocument(id, {
          acknowledged_date: toApiDate(raw.acknowledged_date) ?? '',
          authority_file_ref: raw.authority_file_ref.trim(),
          result: raw.result,
          note,
        });
        break;
      case 'rollback':
        // The context matters here too: a corrective edge whose target status
        // has its own requirement (ACKNOWLEDGED -> SENT needs the submission
        // date) is rejected without it, and the form already collected it.
        request$ = isDocument
          ? this.service.rollbackDocument(id, {
              to_status: call.toStatus,
              reason: raw.reason.trim(),
              context: this.buildContext(raw),
            })
          : this.service.rollbackDossier(id, {
              to_status: call.toStatus,
              reason: raw.reason.trim(),
              context: this.buildContext(raw),
            });
        break;
      case 'transition':
        request$ = isDocument
          ? this.service.transitionDocument(id, {
              to_status: call.toStatus,
              context: this.buildContext(raw),
            })
          : this.service.transitionDossier(id, {
              to_status: call.toStatus,
              context: this.buildContext(raw),
            });
        break;
    }

    this.submitting.set(true);
    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.snackbar.openSnackBar(
          this.translate.instant('ADMINISTRATIVE_DOCUMENT.TRANSITION.SUCCESS') as string,
          VALIDATION_TYPE,
        );
        this.ref.close(true);
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        const code = extractApiErrorCode(error);
        // An illegal edge or missing context is a problem with THIS form —
        // keep it inline rather than firing a toast the user has to chase.
        if (
          code === ERROR_CODE.ILLEGAL_TRANSITION ||
          code === ERROR_CODE.MISSING_TRANSITION_CONTEXT
        ) {
          this.formError.set(extractApiErrorMessage(error));
          return;
        }
        this.errorHandler.handleError(extractApiErrorMessage(error));
      },
    });
  }

  /** Context for the generic and rollback endpoints; only the fields this edge declared. */
  private buildContext(raw: {
    submission_date: Date | null;
    acknowledged_date: Date | null;
    authority_file_ref: string;
    reason: string;
    result: AcknowledgementResult;
    note: string;
  }): Record<string, unknown> {
    const context: Record<string, unknown> = {};
    if (this.shows('submission_date')) context['submission_date'] = toApiDate(raw.submission_date);
    if (this.shows('acknowledged_date')) {
      context['acknowledged_date'] = toApiDate(raw.acknowledged_date);
    }
    if (this.shows('authority_file_ref')) {
      context['authority_file_ref'] = raw.authority_file_ref.trim();
    }
    if (this.shows('result')) context['result'] = raw.result;
    if (this.shows('reason')) context['reason'] = raw.reason.trim();
    if (this.shows('note') && raw.note.trim()) context['note'] = raw.note.trim();
    return context;
  }

  close(): void {
    this.ref.close(false);
  }
}
