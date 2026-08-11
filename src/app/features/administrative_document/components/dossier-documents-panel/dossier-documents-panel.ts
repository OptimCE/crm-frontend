import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { interval } from 'rxjs';

import { VALIDATION_TYPE, ERROR_TYPE } from '../../../../core/dtos/notification';
import {
  DocumentOut,
  DocumentStatus,
  RenderState,
  SubjectType,
} from '../../../../shared/dtos/administrative-document.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeDocumentService } from '../../../../shared/services/administrative-document.service';
import { downloadBlob } from '../../../../shared/utils/download.utils';
import {
  TagSeverity,
  docTypeLabelKey,
  documentStatusLabelKey,
  documentStatusSeverity,
  extractApiErrorMessage,
  renderStateLabelKey,
  renderStateSeverity,
} from '../../administrative-document-format';
import {
  allowedTargets,
  canUploadVersion,
  isCorrective,
  isTerminal,
  transitionFields,
} from '../../administrative-document-transitions';
import { DocumentCreateDialog } from '../document-create-dialog/document-create-dialog';
import { DocumentDetailDialog } from '../document-detail-dialog/document-detail-dialog';
import { GenerateDialog } from '../generate-dialog/generate-dialog';
import { TransitionDialog, TransitionDialogData } from '../transition-dialog/transition-dialog';
import { UploadVersionDialog } from '../upload-version-dialog/upload-version-dialog';

/** Rendering is a NATS round trip through another service; seconds, not ms. */
const RENDER_POLL_INTERVAL_MS = 4000;

@Component({
  selector: 'app-dossier-documents-panel',
  standalone: true,
  imports: [TranslatePipe, Button, Tag, ConfirmDialog, Tooltip, DatePipe],
  templateUrl: './dossier-documents-panel.html',
  providers: [DialogService, ConfirmationService, ErrorMessageHandler],
})
export class DossierDocumentsPanel {
  private readonly service = inject(AdministrativeDocumentService);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly confirmation = inject(ConfirmationService);
  private readonly dialogService = inject(DialogService);
  private readonly destroyRef = inject(DestroyRef);

  private dialogRef?: DynamicDialogRef | null;

  readonly documents = input<DocumentOut[]>([]);
  readonly dossierId = input.required<number>();
  readonly changed = output<void>();

  readonly busyIds = signal<ReadonlySet<number>>(new Set());
  /** Documents whose render we are watching, and the state last observed. */
  readonly renderStates = signal<ReadonlyMap<number, RenderState>>(new Map());

  constructor() {
    this.destroyRef.onDestroy(() => this.dialogRef?.destroy());

    // One timer for the whole panel rather than one per document: a dossier can
    // hold a dozen documents and each poll is an uncached request. Paused while
    // the tab is hidden — a backgrounded tab has nobody to show the result to.
    interval(RENDER_POLL_INTERVAL_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (document.hidden) return;
        for (const [id, state] of this.renderStates()) {
          if (state === RenderState.PENDING) this.pollRender(id);
        }
      });
  }

  // ---- render polling ----------------------------------------------------

  /**
   * Watch a document until its render lands or fails.
   *
   * The backend deletes the render row on success, so `render_state: null` plus
   * a `current_version_id` is what "done" looks like.
   */
  private pollRender(documentId: number): void {
    this.service
      .renderStatus(documentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const state = response.data.render_state;
          if (state === RenderState.PENDING) return;

          this.stopWatching(documentId);
          if (state === RenderState.FAILED) {
            this.snackbar.openSnackBar(
              response.data.render_error?.message ??
                (this.translate.instant(
                  'ADMINISTRATIVE_DOCUMENT.DOCUMENTS.RENDER_FAILED',
                ) as string),
              ERROR_TYPE,
            );
          } else {
            this.snackbar.openSnackBar(
              this.translate.instant('ADMINISTRATIVE_DOCUMENT.DOCUMENTS.RENDER_DONE') as string,
              VALIDATION_TYPE,
            );
          }
          this.changed.emit();
        },
        // A transient poll failure is not worth a toast; the next tick retries.
        error: () => this.stopWatching(documentId),
      });
  }

  private stopWatching(documentId: number): void {
    this.renderStates.update((states) => {
      const next = new Map(states);
      next.delete(documentId);
      return next;
    });
  }

  renderState(document: DocumentOut): RenderState | null {
    return this.renderStates().get(document.id) ?? null;
  }

  isRendering(document: DocumentOut): boolean {
    return this.renderState(document) === RenderState.PENDING;
  }

  renderLabelKey(state: RenderState): string {
    return renderStateLabelKey(state);
  }

  renderSeverity(state: RenderState): TagSeverity {
    return renderStateSeverity(state);
  }

  // ---- download ----------------------------------------------------------

  readonly downloadingIds = signal<ReadonlySet<number>>(new Set());

  /** A document with no version has nothing to download yet. */
  canDownload(document: DocumentOut): boolean {
    return document.current_version_id !== null;
  }

  isDownloading(document: DocumentOut): boolean {
    return this.downloadingIds().has(document.id);
  }

  /**
   * Download the current version straight from the row.
   *
   * The version history lives in the detail dialog, but the common case — "I
   * just generated this, give me the file" — should not require opening one.
   */
  download(document: DocumentOut): void {
    const versionId = document.current_version_id;
    if (versionId === null) return;

    this.downloadingIds.update((set) => new Set(set).add(document.id));
    this.service
      .downloadVersion(document.id, versionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ blob, filename }) => {
          this.stopDownloading(document.id);
          downloadBlob(blob, filename);
        },
        error: (error: unknown) => {
          this.stopDownloading(document.id);
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }

  private stopDownloading(id: number): void {
    this.downloadingIds.update((set) => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });
  }

  // ---- state-machine driven rendering ------------------------------------

  /** The statuses this document can legally move to. Drives the action buttons. */
  targets(document: DocumentOut): readonly number[] {
    return allowedTargets(SubjectType.DOCUMENT, document.status);
  }

  isTerminalDocument(document: DocumentOut): boolean {
    return isTerminal(SubjectType.DOCUMENT, document.status);
  }

  canUpload(document: DocumentOut): boolean {
    return canUploadVersion(document.status);
  }

  targetLabelKey(target: number): string {
    return documentStatusLabelKey(target as DocumentStatus);
  }

  isCorrectiveTarget(document: DocumentOut, target: number): boolean {
    return isCorrective(SubjectType.DOCUMENT, document.status, target);
  }

  targetIcon(document: DocumentOut, target: number): string {
    return this.isCorrectiveTarget(document, target) ? 'pi pi-undo' : 'pi pi-arrow-right';
  }

  targetSeverity(document: DocumentOut, target: number): 'warn' | 'primary' {
    return this.isCorrectiveTarget(document, target) ? 'warn' : 'primary';
  }

  /**
   * A transition that needs no extra information is a one-click confirm; one
   * that does opens the dialog. Deciding from the field descriptors keeps this
   * component from hardcoding which statuses need what.
   */
  transition(document: DocumentOut, target: number): void {
    const fields = transitionFields(SubjectType.DOCUMENT, document.status, target);
    if (fields.length === 0) {
      this.confirmSimpleTransition(document, target);
      return;
    }
    this.openTransitionDialog(document, target);
  }

  private confirmSimpleTransition(document: DocumentOut, target: number): void {
    this.confirmation.confirm({
      header: this.translate.instant('ADMINISTRATIVE_DOCUMENT.DOCUMENTS.CONFIRM_HEADER') as string,
      message: this.translate.instant('ADMINISTRATIVE_DOCUMENT.DOCUMENTS.CONFIRM_MESSAGE', {
        status: this.translate.instant(this.targetLabelKey(target)) as string,
      }) as string,
      acceptLabel: this.translate.instant('COMMON.ACTIONS.VALIDATE') as string,
      rejectLabel: this.translate.instant('COMMON.ACTIONS.CANCEL') as string,
      accept: () => this.runSimpleTransition(document, target),
    });
  }

  private runSimpleTransition(document: DocumentOut, target: number): void {
    this.busyIds.update((set) => new Set(set).add(document.id));
    const request$ =
      (target as DocumentStatus) === DocumentStatus.READY
        ? this.service.markDocumentReady(document.id)
        : this.service.transitionDocument(document.id, { to_status: target, context: {} });

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.stopBusy(document.id);
        this.snackbar.openSnackBar(
          this.translate.instant('ADMINISTRATIVE_DOCUMENT.DOCUMENTS.STATUS_CHANGED') as string,
          VALIDATION_TYPE,
        );
        this.changed.emit();
      },
      error: (error: unknown) => {
        this.stopBusy(document.id);
        this.errorHandler.handleError(extractApiErrorMessage(error));
      },
    });
  }

  private openTransitionDialog(document: DocumentOut, target: number): void {
    const data: TransitionDialogData = {
      subject: SubjectType.DOCUMENT,
      subjectId: document.id,
      fromStatus: document.status,
      toStatus: target,
      subjectLabel:
        document.title ?? (this.translate.instant(docTypeLabelKey(document.doc_type)) as string),
    };
    this.dialogRef = this.dialogService.open(TransitionDialog, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      width: '34rem',
      styleClass: 'responsive-dialog',
      header: this.translate.instant('ADMINISTRATIVE_DOCUMENT.TRANSITION.HEADER') as string,
      data,
    });
    this.afterDialog();
  }

  // ---- dialogs -----------------------------------------------------------

  openCreate(): void {
    this.dialogRef = this.dialogService.open(DocumentCreateDialog, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      width: '32rem',
      styleClass: 'responsive-dialog',
      header: this.translate.instant(
        'ADMINISTRATIVE_DOCUMENT.DIALOGS.CREATE_DOCUMENT.TITLE',
      ) as string,
      data: { dossierId: this.dossierId() },
    });
    this.afterDialog();
  }

  openUpload(document: DocumentOut): void {
    this.dialogRef = this.dialogService.open(UploadVersionDialog, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      width: '32rem',
      styleClass: 'responsive-dialog',
      header: this.translate.instant(
        'ADMINISTRATIVE_DOCUMENT.DIALOGS.UPLOAD_VERSION.TITLE',
      ) as string,
      data: { document },
    });
    this.afterDialog();
  }

  /**
   * Review the CRM-filled form, then queue the render.
   *
   * On success we start watching rather than refreshing: the artifact does not
   * exist yet, so an immediate reload would show the document unchanged.
   */
  openGenerate(document: DocumentOut): void {
    this.dialogRef = this.dialogService.open(GenerateDialog, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      width: '58rem',
      styleClass: 'responsive-dialog',
      header: this.translate.instant('ADMINISTRATIVE_DOCUMENT.DIALOGS.GENERATE.TITLE') as string,
      data: { document },
    });
    this.dialogRef?.onClose
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((queued: boolean) => {
        if (!queued) return;
        this.renderStates.update((states) => new Map(states).set(document.id, RenderState.PENDING));
      });
  }

  openDetail(document: DocumentOut): void {
    this.dialogRef = this.dialogService.open(DocumentDetailDialog, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      width: '46rem',
      styleClass: 'responsive-dialog',
      header: this.translate.instant(
        'ADMINISTRATIVE_DOCUMENT.DIALOGS.DOCUMENT_DETAIL.TITLE',
      ) as string,
      data: { documentId: document.id },
    });
    // Read-only, but a download does not change anything either — still refresh
    // in case the user uploaded from elsewhere in the meantime.
    this.afterDialog();
  }

  private afterDialog(): void {
    this.dialogRef?.onClose
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((changed: boolean) => {
        if (changed) this.changed.emit();
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

  isBusy(document: DocumentOut): boolean {
    return this.busyIds().has(document.id);
  }

  docTypeKey(document: DocumentOut): string {
    return docTypeLabelKey(document.doc_type);
  }

  statusLabelKey(document: DocumentOut): string {
    return documentStatusLabelKey(document.status);
  }

  statusSeverity(document: DocumentOut): TagSeverity {
    return documentStatusSeverity(document.status);
  }
}
