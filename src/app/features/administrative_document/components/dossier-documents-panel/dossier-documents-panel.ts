import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { interval, switchMap } from 'rxjs';

import { ERROR_TYPE, VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { LocaleService } from '../../../../core/services/language/locale.service';
import { RealtimeService } from '../../../../core/services/realtime/realtime.service';
import { REALTIME_TOPICS } from '../../../../core/services/realtime/realtime.types';
import { RenderState } from '../../../../shared/dtos/administrative-document.dtos';
import {
  PieceOut,
  ProcedureDetailOut,
} from '../../../../shared/dtos/administrative-procedure.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeDocumentService } from '../../../../shared/services/administrative-document.service';
import { downloadBlob } from '../../../../shared/utils/download.utils';
import {
  TagSeverity,
  extractApiErrorMessage,
  renderStateLabelKey,
  renderStateSeverity,
} from '../../administrative-document-format';
import {
  canDownload,
  canGenerate,
  canUpload,
  pickLabel,
  pieceKindLabelKey,
  pieceStatusLabelKey,
  pieceStatusSeverity,
} from '../../procedures/procedure-format';
import { GenerateDialog } from '../generate-dialog/generate-dialog';
import { UploadVersionDialog } from '../upload-version-dialog/upload-version-dialog';

/** Rendering is a NATS round trip through another service; seconds, not ms. */
const RENDER_POLL_INTERVAL_MS = 4000;
/** While the realtime stream is live it says when a render ends; poll only as a safety net. */
const SAFETY_POLL_INTERVAL_MS = 20_000;

/**
 * A procedure's pieces: the checklist, with Generate, Upload and Download on
 * each (spec "Détail d'une démarche").
 *
 * Which actions a piece offers is the annex's rule, mirrored in
 * procedure-format (canGenerate / canUpload); the annex's 409 stays the
 * enforcement. Generation goes through the July routes (prefill, generate,
 * render-status), which accept engine pieces; an upload goes through `/admin`,
 * which applies the sending's freeze and settles readiness, and returns the
 * procedure as it now is.
 */
@Component({
  selector: 'app-dossier-documents-panel',
  standalone: true,
  imports: [TranslatePipe, Button, Tag, Tooltip],
  templateUrl: './dossier-documents-panel.html',
  providers: [DialogService, ErrorMessageHandler],
})
export class DossierDocumentsPanel {
  private readonly documents = inject(AdministrativeDocumentService);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly dialogService = inject(DialogService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly lang = inject(LocaleService).locale;

  private dialogRef?: DynamicDialogRef | null;

  readonly detail = input.required<ProcedureDetailOut>();
  /** An upload returned the procedure as it now is. */
  readonly changed = output<ProcedureDetailOut>();
  /** A render landed: the procedure changed server-side, refetch it. */
  readonly stale = output<void>();

  /** Pieces whose render we are watching, and the state last observed. */
  readonly renderStates = signal<ReadonlyMap<number, RenderState>>(new Map());
  readonly downloadingIds = signal<ReadonlySet<number>>(new Set());

  constructor() {
    this.destroyRef.onDestroy(() => this.dialogRef?.destroy());

    // One timer for the panel, paused while the tab is hidden. Slowed, not
    // stopped, while the stream is live: a live stream proves the socket, not
    // that the docgen result consumer published.
    toObservable(this.realtime.live)
      .pipe(
        switchMap((live) => interval(live ? SAFETY_POLL_INTERVAL_MS : RENDER_POLL_INTERVAL_MS)),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        if (document.hidden) return;
        for (const [id, state] of this.renderStates()) {
          if (state === RenderState.PENDING) this.pollRender(id);
        }
      });

    // The fast path: the annex says a render ended. Same handler as the poll.
    this.realtime
      .on(REALTIME_TOPICS.ADMIN_DOCUMENT_READY)
      .pipe(takeUntilDestroyed())
      .subscribe((event) => {
        const id = Number(event.ref?.id);
        if (this.renderStates().get(id) === RenderState.PENDING) this.pollRender(id);
      });
  }

  // ---- render watching -----------------------------------------------------

  /** `render_state: null` plus a version is what "done" looks like. */
  private pollRender(pieceId: number): void {
    this.documents
      .renderStatus(pieceId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const state = response.data.render_state;
          if (state === RenderState.PENDING) return;
          this.stopWatching(pieceId);
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
          this.stale.emit();
        },
        // A transient poll failure is not worth a toast; the next tick retries.
        error: () => this.stopWatching(pieceId),
      });
  }

  private stopWatching(pieceId: number): void {
    this.renderStates.update((states) => {
      const next = new Map(states);
      next.delete(pieceId);
      return next;
    });
  }

  renderState(piece: PieceOut): RenderState | null {
    return this.renderStates().get(piece.id) ?? null;
  }

  isRendering(piece: PieceOut): boolean {
    return this.renderState(piece) === RenderState.PENDING;
  }

  renderLabelKey(state: RenderState): string {
    return renderStateLabelKey(state);
  }

  renderSeverity(state: RenderState): TagSeverity {
    return renderStateSeverity(state);
  }

  // ---- actions -------------------------------------------------------------

  canGenerate(piece: PieceOut): boolean {
    return canGenerate(this.detail(), piece);
  }

  canUpload(piece: PieceOut): boolean {
    return canUpload(this.detail(), piece);
  }

  canDownload(piece: PieceOut): boolean {
    return canDownload(piece);
  }

  /** Review the CRM-filled form, then queue the render and watch it land. */
  openGenerate(piece: PieceOut): void {
    this.dialogRef = this.dialogService.open(GenerateDialog, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      width: '58rem',
      styleClass: 'responsive-dialog',
      header: this.translate.instant('ADMINISTRATIVE_DOCUMENT.DIALOGS.GENERATE.TITLE') as string,
      data: { documentId: piece.id, title: this.label(piece) },
    });
    this.dialogRef?.onClose
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((queued: boolean) => {
        if (!queued) return;
        this.renderStates.update((states) => new Map(states).set(piece.id, RenderState.PENDING));
      });
  }

  openUpload(piece: PieceOut): void {
    this.dialogRef = this.dialogService.open(UploadVersionDialog, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      width: '32rem',
      styleClass: 'responsive-dialog',
      header: this.translate.instant(
        'ADMINISTRATIVE_DOCUMENT.DIALOGS.UPLOAD_VERSION.TITLE',
      ) as string,
      data: { dossierId: this.detail().id, pieceId: piece.id, title: this.label(piece) },
    });
    this.dialogRef?.onClose
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((updated: ProcedureDetailOut | null | undefined) => {
        if (updated) this.changed.emit(updated);
      });
  }

  /** The current version, exactly as it was filed. */
  download(piece: PieceOut): void {
    const versionId = piece.current_version_id;
    if (versionId === null) return;
    this.downloadingIds.update((set) => new Set(set).add(piece.id));
    this.documents
      .downloadVersion(piece.id, versionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ blob, filename }) => {
          this.stopDownloading(piece.id);
          downloadBlob(blob, filename);
        },
        error: (error: unknown) => {
          this.stopDownloading(piece.id);
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

  isDownloading(piece: PieceOut): boolean {
    return this.downloadingIds().has(piece.id);
  }

  // ---- presentation helpers ----------------------------------------------

  label(piece: PieceOut): string {
    return pickLabel(piece.labels, this.lang(), piece.code);
  }

  statusLabelKey(piece: PieceOut): string {
    return pieceStatusLabelKey(piece.status);
  }

  statusSeverity(piece: PieceOut): TagSeverity {
    return pieceStatusSeverity(piece.status);
  }

  kindLabelKey(piece: PieceOut): string {
    return pieceKindLabelKey(piece.kind);
  }
}
