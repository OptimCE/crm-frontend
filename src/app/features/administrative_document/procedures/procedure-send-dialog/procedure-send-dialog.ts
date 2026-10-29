import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';

import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { LocaleService } from '../../../../core/services/language/locale.service';
import {
  PieceOut,
  ProcedureDetailOut,
  SendChannel,
} from '../../../../shared/dtos/administrative-procedure.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeDocumentService } from '../../../../shared/services/administrative-document.service';
import { AdministrativeProcedureService } from '../../../../shared/services/administrative-procedure.service';
import { downloadBlob } from '../../../../shared/utils/download.utils';
import {
  extractApiErrorCode,
  extractApiErrorMessage,
  toApiDate,
} from '../../administrative-document-format';
import {
  I18nText,
  ProcedureDialogData,
  pickLabel,
  piecesToSend,
  recipientText,
  sendBody,
} from '../procedure-format';

const CHANNELS: readonly SendChannel[] = ['email', 'online_form', 'post'];

/** Refusals about this procedure's state: they belong in the dialog, not a toast. */
const INLINE_ERRORS: ReadonlySet<number> = new Set([
  2378, // PROCEDURE_FROZEN: sent meanwhile
  2379, // TRANSITION_NOT_ALLOWED: not ready to be sent
  2334, // INVALID_FILE
  2335, // FILE_TOO_LARGE
]);

interface SelectOption<T> {
  label: string;
  value: T;
}

/**
 * "Envoyer" (spec "Modale Envoyer", "Envoi (v1)"). OptimCE does not send: it
 * prepares the recipient, a subject carrying the `[OPT-<id>]` reference a reply
 * must keep, the body and the pieces; the admin sends from their own mailbox or
 * the online form, then marks it as sent here: the date, the channel, and
 * optionally the .eml sent or the form's receipt. That freezes the procedure.
 */
@Component({
  selector: 'app-procedure-send-dialog',
  standalone: true,
  imports: [TranslatePipe, FormsModule, Button, DatePicker, InputText, Select, Textarea],
  templateUrl: './procedure-send-dialog.html',
  providers: [ErrorMessageHandler],
})
export class ProcedureSendDialog {
  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig<ProcedureDialogData>);
  private readonly service = inject(AdministrativeProcedureService);
  private readonly documents = inject(AdministrativeDocumentService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lang = inject(LocaleService).locale();

  private readonly data = this.config.data as ProcedureDialogData | undefined;
  readonly detail = this.data?.detail ?? null;

  readonly submitting = signal<boolean>(false);
  readonly formError = signal<string | null>(null);
  readonly copied = signal<'subject' | 'body' | null>(null);
  readonly downloadingIds = signal<ReadonlySet<number>>(new Set());
  readonly file = signal<File | null>(null);

  readonly recipient: I18nText | null = this.detail
    ? recipientText(this.detail.recipient, this.detail.grd_ref, this.data?.regulator ?? null)
    : null;
  readonly pieces: PieceOut[] = this.detail ? piecesToSend(this.detail) : [];

  subject = this.detail ? pickLabel(this.detail.send_preview.subjects, this.lang) : '';
  body = this.detail
    ? sendBody(
        this.detail,
        this.lang,
        (key, params) => this.translate.instant(key, params) as string,
      )
    : '';
  sentOn: Date = new Date();
  /** Marking as sent records what happened: never a day still to come. */
  readonly today = new Date();
  channel: SendChannel = initialChannel(this.detail);

  /** Built once: the dialog is modal, the language cannot change under it. */
  readonly channelOptions: SelectOption<SendChannel>[] = CHANNELS.map((value) => ({
    value,
    label: this.translate.instant(
      `ADMINISTRATIVE_DOCUMENT.PROCEDURES.SEND.CHANNEL.${value.toUpperCase()}`,
    ) as string,
  }));

  readonly fileName = computed(() => this.file()?.name ?? '');

  pieceLabel(piece: PieceOut): string {
    return pickLabel(piece.labels, this.lang, piece.code);
  }

  copy(what: 'subject' | 'body'): void {
    // Absent over plain HTTP; the text is on screen and selectable either way.
    void navigator.clipboard
      ?.writeText(what === 'subject' ? this.subject : this.body)
      .then(() => this.copied.set(what))
      .catch(() => {
        /* clipboard unavailable — the text is still displayed */
      });
  }

  download(piece: PieceOut): void {
    const versionId = piece.current_version_id;
    if (versionId === null) return;
    this.downloadingIds.update((set) => new Set(set).add(piece.id));
    const done = (): void =>
      this.downloadingIds.update((set) => {
        const next = new Set(set);
        next.delete(piece.id);
        return next;
      });
    this.documents
      .downloadVersion(piece.id, versionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ blob, filename }) => {
          done();
          downloadBlob(blob, filename);
        },
        error: (error: unknown) => {
          done();
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }

  isDownloading(piece: PieceOut): boolean {
    return this.downloadingIds().has(piece.id);
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
    const sentOn = toApiDate(this.sentOn);
    if (!detail) return;
    if (!sentOn) {
      this.formError.set(
        this.translate.instant(
          'ADMINISTRATIVE_DOCUMENT.PROCEDURES.SEND.ERRORS.DATE_REQUIRED',
        ) as string,
      );
      return;
    }
    this.submitting.set(true);
    this.service
      .send(detail.id, {
        sent_on: sentOn,
        channel: this.channel,
        subject: this.subject.trim() || null,
        body_text: this.body.trim() || null,
        file: this.file(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.snackbar.openSnackBar(
            this.translate.instant('ADMINISTRATIVE_DOCUMENT.PROCEDURES.SEND.DONE') as string,
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
}

/** The catalogue's channel when it is one the admin can pick, else email. */
function initialChannel(detail: ProcedureDetailOut | null): SendChannel {
  const channel = detail?.send_preview.channel;
  return CHANNELS.includes(channel as SendChannel) ? (channel as SendChannel) : 'email';
}
