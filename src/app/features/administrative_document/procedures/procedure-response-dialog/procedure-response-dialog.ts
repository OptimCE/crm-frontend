import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { RegulatoryBadgeComponent } from '../../../../shared/components/regulatory-badge/regulatory-badge';
import { RegulatorySubjectType } from '../../../../shared/dtos/regulatory-status.dtos';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { Subject, catchError, of, switchMap } from 'rxjs';

import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { LocaleService } from '../../../../core/services/language/locale.service';
import {
  ChangeSubjectType,
  CorrespondenceProposalOut,
  EffectPreviewOut,
  ProposalDeadlineOut,
} from '../../../../shared/dtos/administrative-procedure.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeProcedureService } from '../../../../shared/services/administrative-procedure.service';
import {
  extractApiErrorCode,
  extractApiErrorMessage,
  formatApiDate,
  toApiDate,
} from '../../administrative-document-format';
import { I18nText, ProcedureDialogData, partyLabelKey, pickLabel } from '../procedure-format';

/** Refusals about this procedure or this message: shown in the dialog. */
const INLINE_ERRORS: ReadonlySet<number> = new Set([
  2305, // DUPLICATE_EXTERNAL_REF: another procedure has this reference
  2334, // INVALID_FILE
  2335, // FILE_TOO_LARGE
  2379, // TRANSITION_NOT_ALLOWED: the procedure moved meanwhile
  2380, // UNKNOWN_RESPONSE_TYPE
]);

interface TypeOption {
  label: string;
  value: string;
  disabled: boolean;
}

/** What recording the response will do, worded for the reader. */
interface Consequence {
  /** "Will move to Incomplete", or null when the step stays. */
  move: I18nText | null;
  started: I18nText[];
  met: I18nText[];
  allowed: boolean;
  /** "Takes effect on …", when the response sets the effect date. */
  effect: I18nText | null;
  /** What the CRM would show differently, one badge per subject. */
  effects: { ref: string; subjectType: RegulatorySubjectType; state: EffectPreviewOut }[];
}

/**
 * "Ajouter une réponse" (spec "Modale Ajouter une réponse"): a file or pasted
 * text, its type and date. The type drives the step change and the deadlines,
 * and the dialog shows them BEFORE confirming ("will move to Incomplete;
 * additional information before ..."): the annex computes them with
 * `dry_run=true`, which writes nothing.
 */
@Component({
  selector: 'app-procedure-response-dialog',
  standalone: true,
  imports: [
    TranslatePipe,
    FormsModule,
    Button,
    DatePicker,
    InputText,
    Message,
    Select,
    Textarea,
    RegulatoryBadgeComponent,
  ],
  templateUrl: './procedure-response-dialog.html',
  providers: [ErrorMessageHandler],
})
export class ProcedureResponseDialog implements OnInit {
  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig<ProcedureDialogData>);
  private readonly service = inject(AdministrativeProcedureService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lang = inject(LocaleService).locale();

  readonly detail = (this.config.data as ProcedureDialogData | undefined)?.detail ?? null;

  /** Applicable types first; the others are shown, disabled, so none seems missing. */
  readonly typeOptions: TypeOption[] = (this.detail?.response_types ?? [])
    .map((type) => ({
      value: type.code,
      label: pickLabel(type.labels, this.lang, type.code),
      disabled: !type.applicable_now,
    }))
    .sort((a, b) => Number(a.disabled) - Number(b.disabled));

  type: string | null = null;
  occurredOn: Date = new Date();
  readonly today = new Date();
  subject = '';
  bodyText = '';
  externalRef = '';
  readonly file = signal<File | null>(null);

  readonly proposal = signal<CorrespondenceProposalOut | null>(null);
  readonly previewing = signal<boolean>(false);
  readonly submitting = signal<boolean>(false);
  readonly formError = signal<string | null>(null);

  readonly fileName = computed(() => this.file()?.name ?? '');
  readonly consequence = computed<Consequence | null>(() => {
    const proposal = this.proposal();
    return proposal ? this.describe(proposal) : null;
  });
  readonly canSubmit = computed(
    () => this.proposal()?.transition_allowed === true && !this.previewing(),
  );

  /** Every change of type or date asks again; only the latest answer counts. */
  private readonly preview$ = new Subject<void>();

  ngOnInit(): void {
    this.preview$
      .pipe(
        switchMap(() => {
          const detail = this.detail;
          const day = toApiDate(this.occurredOn);
          if (!detail || !this.type || !day) return of(null);
          this.previewing.set(true);
          return this.service
            .previewResponse(detail.id, { type: this.type, occurred_on: day })
            .pipe(
              catchError((error: unknown) => {
                this.formError.set(extractApiErrorMessage(error));
                return of(null);
              }),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        this.previewing.set(false);
        this.proposal.set(res?.data ?? null);
      });
  }

  onInputsChange(): void {
    this.formError.set(null);
    this.proposal.set(null);
    this.preview$.next();
  }

  onFileSelected(event: Event): void {
    this.file.set((event.target as HTMLInputElement).files?.[0] ?? null);
  }

  clearFile(): void {
    this.file.set(null);
  }

  submit(): void {
    this.formError.set(null);
    const detail = this.detail;
    const day = toApiDate(this.occurredOn);
    if (!detail) return;
    if (!this.type || !day) {
      this.formError.set(
        this.translate.instant(
          'ADMINISTRATIVE_DOCUMENT.PROCEDURES.RESPONSE.ERRORS.TYPE_REQUIRED',
        ) as string,
      );
      return;
    }
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    this.service
      .recordResponse(detail.id, {
        type: this.type,
        occurred_on: day,
        subject: this.subject.trim() || null,
        body_text: this.bodyText.trim() || null,
        external_ref: this.externalRef.trim() || null,
        file: this.file(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.snackbar.openSnackBar(
            this.translate.instant('ADMINISTRATIVE_DOCUMENT.PROCEDURES.RESPONSE.DONE') as string,
            VALIDATION_TYPE,
          );
          this.ref.close(res.data);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          const code = extractApiErrorCode(error);
          if (code !== null && INLINE_ERRORS.has(code)) {
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

  private describe(proposal: CorrespondenceProposalOut): Consequence {
    const prefix = 'ADMINISTRATIVE_DOCUMENT.PROCEDURES.RESPONSE';
    const ruleLabel = (code: string): string =>
      pickLabel(this.detail?.deadlines.find((d) => d.code === code)?.labels, this.lang, code);
    return {
      move: proposal.to_step
        ? {
            key: `${prefix}.WILL_MOVE`,
            params: { step: pickLabel(proposal.to_step_labels, this.lang, proposal.to_step) },
          }
        : null,
      started: proposal.deadlines_started.map((d: ProposalDeadlineOut) => ({
        key: `${prefix}.WILL_START`,
        params: {
          label: pickLabel(d.labels, this.lang, d.code),
          party: this.translate.instant(partyLabelKey(d.party)) as string,
          date: formatApiDate(d.due_date),
        },
      })),
      met: proposal.deadlines_met.map((code) => ({
        key: `${prefix}.WILL_MEET`,
        params: { label: ruleLabel(code) },
      })),
      allowed: proposal.transition_allowed,
      effect: proposal.effective_date
        ? {
            key: `${prefix}.WILL_TAKE_EFFECT`,
            params: { date: formatApiDate(proposal.effective_date) },
          }
        : null,
      effects: (proposal.effects ?? []).map((state) => ({
        ref: state.subject_ref,
        subjectType:
          state.subject_type === ChangeSubjectType.KEY
            ? RegulatorySubjectType.KEY
            : RegulatorySubjectType.METER,
        state,
      })),
    };
  }
}
