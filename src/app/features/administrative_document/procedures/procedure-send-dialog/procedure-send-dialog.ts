import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { interval } from 'rxjs';

import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { LocaleService } from '../../../../core/services/language/locale.service';
import { RealtimeService } from '../../../../core/services/realtime/realtime.service';
import { REALTIME_TOPICS } from '../../../../core/services/realtime/realtime.types';
import {
  EntryFieldOut,
  EntrySheetOut,
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
import { TagSeverity } from '../../administrative-document-format';
import {
  I18nText,
  ProcedureDialogData,
  entryValueText,
  entrySheetsHtml,
  isRendering,
  pickLabel,
  piecesNotFinal,
  piecesToSend,
  recipientText,
  sendBody,
  versionStageLabelKey,
  versionStageSeverity,
} from '../procedure-format';

const CHANNELS: readonly SendChannel[] = ['email', 'online_form', 'post'];
/** Finals render through another service; seconds, not ms. */
const FINALS_POLL_INTERVAL_MS = 4000;

/** Refusals about this procedure's state: they belong in the dialog, not a toast. */
const INLINE_ERRORS: ReadonlySet<number> = new Set([
  2378, // PROCEDURE_FROZEN: sent meanwhile
  2379, // TRANSITION_NOT_ALLOWED: not ready to be sent
  2385, // FINAL_VERSIONS_REQUIRED: a piece is still a draft or rendering
  2386, // FINALIZE_NOT_ALLOWED: the pieces are not complete
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
 *
 * What is attached is final: the generated pieces are worked on as stamped
 * drafts, so the first step renders their finals (from the reviewed drafts'
 * own snapshots), then offers them as one archive, and the fiche de saisie of a
 * form piece, field by field. Marking as sent waits for the finals; the annex
 * refuses it otherwise (2385).
 */
@Component({
  selector: 'app-procedure-send-dialog',
  standalone: true,
  imports: [TranslatePipe, FormsModule, Button, DatePicker, InputText, Select, Tag, Textarea],
  templateUrl: './procedure-send-dialog.html',
  providers: [ErrorMessageHandler],
})
export class ProcedureSendDialog implements OnInit {
  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig<ProcedureDialogData>);
  private readonly service = inject(AdministrativeProcedureService);
  private readonly documents = inject(AdministrativeDocumentService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);
  private readonly realtime = inject(RealtimeService);
  private readonly lang = inject(LocaleService).locale();

  private readonly data = this.config.data as ProcedureDialogData | undefined;
  readonly detail = this.data?.detail ?? null;
  /** The procedure as it now is: finals land while the dialog is open. */
  readonly current = signal<ProcedureDetailOut | null>(this.detail);
  /** Something changed server-side (finals rendered), so the page must refetch. */
  private changed = false;

  readonly submitting = signal<boolean>(false);
  readonly finalizing = signal<boolean>(false);
  readonly zipping = signal<boolean>(false);
  readonly formError = signal<string | null>(null);
  /** What was copied last: 'subject', 'body', or `<sheet>:<field>` / `<sheet>:*`. */
  readonly copied = signal<string | null>(null);
  readonly downloadingIds = signal<ReadonlySet<number>>(new Set());
  readonly file = signal<File | null>(null);
  readonly sheets = signal<EntrySheetOut[]>([]);

  readonly recipient: I18nText | null = this.detail
    ? recipientText(this.detail.recipient, this.detail.grd_ref, this.data?.regulator ?? null)
    : null;
  readonly pieces = computed<PieceOut[]>(() => {
    const detail = this.current();
    return detail ? piecesToSend(detail) : [];
  });
  readonly notFinal = computed<PieceOut[]>(() => {
    const detail = this.current();
    return detail ? piecesNotFinal(detail) : [];
  });
  readonly finalsReady = computed(() => this.current()?.finals_ready ?? false);
  readonly rendering = computed(() => this.pieces().some((piece) => isRendering(piece)));

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

  ngOnInit(): void {
    if (this.detail?.has_entry_sheet) this.loadSheets();

    // A final ends in another service: the stream says so, the poll is the net.
    this.realtime
      .on(REALTIME_TOPICS.ADMIN_DOCUMENT_READY)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.rendering()) this.refresh();
      });
    interval(FINALS_POLL_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.rendering() && !document.hidden) this.refresh();
      });
  }

  pieceLabel(piece: PieceOut): string {
    const label = pickLabel(piece.labels, this.lang, piece.code);
    return piece.member_name ? `${label} — ${piece.member_name}` : label;
  }

  label(labels: EntrySheetOut['labels'], fallback: string): string {
    return pickLabel(labels, this.lang, fallback);
  }

  pieceRendering(piece: PieceOut): boolean {
    return isRendering(piece);
  }

  stageLabelKey(piece: PieceOut): string | null {
    return piece.current_version ? versionStageLabelKey(piece.current_version.stage) : null;
  }

  stageSeverity(piece: PieceOut): TagSeverity {
    return piece.current_version ? versionStageSeverity(piece.current_version.stage) : 'secondary';
  }

  // ---- the finals ------------------------------------------------------------

  /** Render every reviewed draft again, unstamped; they land in a few seconds. */
  finalize(): void {
    const detail = this.current();
    if (!detail) return;
    this.formError.set(null);
    this.finalizing.set(true);
    this.service
      .finalize(detail.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.finalizing.set(false);
          this.changed = true;
          this.refresh();
        },
        error: (error: unknown) => {
          this.finalizing.set(false);
          this.inlineOrToast(error);
        },
      });
  }

  /** The procedure again, uncached; the fiche follows the versions it reads. */
  private refresh(): void {
    const detail = this.current();
    if (!detail) return;
    this.service.invalidate();
    this.service
      .getProcedure(detail.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          const wasReady = this.finalsReady();
          this.current.set(data);
          if (data.has_entry_sheet && data.finals_ready && !wasReady) this.loadSheets();
        },
        // A poll that fails is retried on the next tick; nothing to say.
        error: () => undefined,
      });
  }

  downloadFinals(): void {
    const detail = this.current();
    if (!detail) return;
    this.zipping.set(true);
    this.service
      .downloadFinals(detail.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ blob, filename }) => {
          this.zipping.set(false);
          downloadBlob(blob, filename);
        },
        error: (error: unknown) => {
          this.zipping.set(false);
          this.inlineOrToast(error);
        },
      });
  }

  // ---- the fiche de saisie -----------------------------------------------------

  private loadSheets(): void {
    const detail = this.current();
    if (!detail) return;
    this.service
      .getEntrySheets(detail.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => this.sheets.set(data),
        error: (error: unknown) => this.errorHandler.handleError(extractApiErrorMessage(error)),
      });
  }

  value(field: EntryFieldOut): string {
    return entryValueText(field.value, (key) => this.translate.instant(key) as string);
  }

  copyField(sheet: EntrySheetOut, field: EntryFieldOut): void {
    this.toClipboard(this.value(field), `${sheet.piece_id}:${field.key}`);
  }

  /** The whole fiche as text: each section, then `label: value` per field. */
  copySheet(sheet: EntrySheetOut): void {
    const text = sheet.sections
      .map((section) =>
        [
          this.label(section.labels, ''),
          ...section.fields.map((f) => `${this.label(f.labels, f.key)}: ${this.value(f)}`),
        ].join('\n'),
      )
      .join('\n\n');
    this.toClipboard(text, `${sheet.piece_id}:*`);
  }

  /** The fiches on a page of their own, then the browser's print (or save as PDF). */
  printSheets(): void {
    const detail = this.current();
    if (!detail) return;
    const title = `${detail.send_preview.reference} ${pickLabel(detail.labels, this.lang, detail.code)}`;
    const page = window.open('', '_blank');
    if (!page) return; // a blocked pop-up: the fiche is on screen, copyable
    page.document.write(
      entrySheetsHtml(
        title,
        this.sheets(),
        this.lang,
        (key) => this.translate.instant(key) as string,
      ),
    );
    page.document.close();
    page.focus();
    page.print();
  }

  copy(what: 'subject' | 'body'): void {
    this.toClipboard(what === 'subject' ? this.subject : this.body, what);
  }

  private toClipboard(text: string, what: string): void {
    // Absent over plain HTTP; the text is on screen and selectable either way.
    void navigator.clipboard
      ?.writeText(text)
      .then(() => this.copied.set(what))
      .catch(() => {
        /* clipboard unavailable — the text is still displayed */
      });
  }

  private inlineOrToast(error: unknown): void {
    const code = extractApiErrorCode(error);
    if (code !== null && INLINE_ERRORS.has(code)) {
      this.formError.set(extractApiErrorMessage(error));
      return;
    }
    this.errorHandler.handleError(extractApiErrorMessage(error));
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
          this.inlineOrToast(error);
        },
      });
  }

  /** Finals rendered meanwhile change the procedure: hand it back to the page. */
  close(): void {
    this.ref.close(this.changed ? this.current() : null);
  }
}

/** The catalogue's channel when it is one the admin can pick, else email. */
function initialChannel(detail: ProcedureDetailOut | null): SendChannel {
  const channel = detail?.send_preview.channel;
  return CHANNELS.includes(channel as SendChannel) ? (channel as SendChannel) : 'email';
}
