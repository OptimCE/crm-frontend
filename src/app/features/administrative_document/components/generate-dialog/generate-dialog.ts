import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Tooltip } from 'primeng/tooltip';

import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import {
  DocumentOut,
  PrefillData,
  PrefillWarning,
} from '../../../../shared/dtos/administrative-document.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeDocumentService } from '../../../../shared/services/administrative-document.service';
import {
  ERROR_CODE,
  extractApiErrorCode,
  extractApiErrorMessage,
} from '../../administrative-document-format';
import {
  PrefillForm,
  PrefillTable,
  ScalarValue,
  TableRow,
  blankRow,
  prefillLabelKey,
  prefillTableLabelKey,
  toPayload,
  toPrefillForm,
} from '../../administrative-document-prefill';
import {
  warningFieldLabelKey,
  warningLabelKey,
  warningLink,
  warningParams,
} from '../../administrative-document-warnings';
import { canUploadVersion } from '../../administrative-document-transitions';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';

interface GenerateDialogData {
  document: DocumentOut;
}

/**
 * Review-and-edit before generating.
 *
 * The CRM pre-fills the mandated form, the user corrects it, and what they
 * submit is what gets frozen into the filed version — so this dialog is the
 * difference between "generated from the CRM" and "generated from what a human
 * approved". Fields the CRM cannot know arrive blank on purpose.
 *
 * Submitting only *queues* the render; the caller polls for the artifact.
 */
@Component({
  selector: 'app-generate-dialog',
  standalone: true,
  imports: [TranslatePipe, RouterLink, FormsModule, Button, InputText, Message, Tooltip],
  templateUrl: './generate-dialog.html',
  providers: [ErrorMessageHandler],
})
export class GenerateDialog implements OnInit {
  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig<GenerateDialogData>);
  private readonly service = inject(AdministrativeDocumentService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  private readonly dialogData = this.config.data as GenerateDialogData | undefined;
  /** Kept so keys the form cannot represent survive the round trip. */
  private original: PrefillData = {};

  readonly loading = signal<boolean>(true);
  readonly submitting = signal<boolean>(false);
  readonly formError = signal<string | null>(null);
  readonly warnings = signal<PrefillWarning[]>([]);
  /**
   * Whether the reviewer has edited anything.
   *
   * Gates re-prefill: refetching would silently discard their corrections, and
   * a confirm dialog nested inside this DynamicDialog is a lot of machinery for
   * a two-line feature.
   */
  readonly dirty = signal<boolean>(false);
  readonly form = signal<PrefillForm>({ fields: [], tables: [] });

  readonly documentTitle = this.dialogData?.document.title ?? '';

  readonly labelKey = prefillLabelKey;
  readonly tableLabelKey = prefillTableLabelKey;
  readonly warningLabelKey = warningLabelKey;
  readonly warningParams = warningParams;
  readonly warningLink = warningLink;
  readonly warningFieldLabelKey = warningFieldLabelKey;

  readonly warningCount = computed(() => this.warnings().length);

  ngOnInit(): void {
    const document = this.dialogData?.document;
    if (!document) {
      this.loading.set(false);
      return;
    }
    this.loadPrefill(document.id);
  }

  /**
   * Re-read the CRM after the reviewer has fixed something at source.
   *
   * This is what makes a warning's link worth following: without it the only way
   * to deal with a wrong value is to type over it here, which freezes the
   * correction into the immutable snapshot while the CRM stays wrong — so the
   * next generation reproduces the same error.
   *
   * No cache to clear: `prefillDocument` is deliberately uncached, because
   * serving a stale participant list would mean filing stale data.
   */
  reload(): void {
    const document = this.dialogData?.document;
    if (!document || this.dirty()) return;
    this.loadPrefill(document.id);
  }

  private loadPrefill(documentId: number): void {
    this.loading.set(true);
    this.formError.set(null);
    this.service
      .prefillDocument(documentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.original = response.data.data;
          this.form.set(toPrefillForm(response.data.data));
          this.warnings.set(response.data.warnings);
          this.dirty.set(false);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.formError.set(extractApiErrorMessage(error));
        },
      });
  }

  // ---- table editing -----------------------------------------------------

  cellValue(row: TableRow, column: string): string {
    const value = row[column];
    return value === null || value === undefined ? '' : String(value);
  }

  setCell(row: TableRow, column: string, value: string): void {
    row[column] = value;
    this.dirty.set(true);
  }

  setField(key: string, value: string): void {
    this.dirty.set(true);
    this.form.update((form) => ({
      ...form,
      fields: form.fields.map((field) =>
        field.key === key ? { ...field, value: value as ScalarValue } : field,
      ),
    }));
  }

  addRow(table: PrefillTable): void {
    // Mutating in place keeps the ngModel bindings of the existing rows stable;
    // replacing the array would tear down and rebuild every input.
    table.rows.push(blankRow(table));
    this.dirty.set(true);
    this.form.update((form) => ({ ...form }));
  }

  removeRow(table: PrefillTable, index: number): void {
    table.rows.splice(index, 1);
    this.dirty.set(true);
    this.form.update((form) => ({ ...form }));
  }

  // ---- submit ------------------------------------------------------------

  submit(): void {
    this.formError.set(null);
    const document = this.dialogData?.document;
    if (!document) return;

    // The caller hides the action, but a document can change status while this
    // dialog is open — re-check rather than let the request 409.
    if (!canUploadVersion(document.status)) {
      this.formError.set(
        this.translate.instant(
          'ADMINISTRATIVE_DOCUMENT.DIALOGS.GENERATE.ERRORS.NOT_ALLOWED',
        ) as string,
      );
      return;
    }

    this.submitting.set(true);
    this.service
      .generateDocument(document.id, { data: toPayload(this.form(), this.original) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackbar.openSnackBar(
            this.translate.instant('ADMINISTRATIVE_DOCUMENT.DIALOGS.GENERATE.QUEUED') as string,
            VALIDATION_TYPE,
          );
          this.ref.close(true);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          const code = extractApiErrorCode(error);
          // All four are about this document or this payload, so they belong in
          // the form rather than in a toast that vanishes.
          if (
            code === ERROR_CODE.GENERATION_NOT_ALLOWED ||
            code === ERROR_CODE.TEMPLATE_NOT_REGISTERED ||
            code === ERROR_CODE.RENDER_ALREADY_IN_FLIGHT ||
            code === ERROR_CODE.TOO_MANY_ROWS
          ) {
            this.formError.set(extractApiErrorMessage(error));
            return;
          }
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }

  close(): void {
    this.ref.close(false);
  }
}
