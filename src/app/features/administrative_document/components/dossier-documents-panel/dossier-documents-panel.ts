import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
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
  DocumentKind,
  PieceOut,
  ProcedureDetailOut,
  RenderPurpose,
} from '../../../../shared/dtos/administrative-procedure.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeDocumentService } from '../../../../shared/services/administrative-document.service';
import { AdministrativeProcedureService } from '../../../../shared/services/administrative-procedure.service';
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
  canRegenerate,
  canUpload,
  canVerify,
  checkOutcomeLabelKey,
  checkOutcomeSeverity,
  pickLabel,
  pieceKindLabelKey,
  pieceStatusLabelKey,
  pieceStatusSeverity,
  versionStageLabelKey,
  versionStageSeverity,
} from '../../procedures/procedure-format';
import { GenerateDialog } from '../generate-dialog/generate-dialog';
import { UploadVersionDialog } from '../upload-version-dialog/upload-version-dialog';

/** Rendering is a NATS round trip through another service; seconds, not ms. */
const RENDER_POLL_INTERVAL_MS = 4000;
/** While the realtime stream is live it says when a render ends; poll only as a safety net. */
const SAFETY_POLL_INTERVAL_MS = 20_000;

/**
 * A procedure's pieces: the checklist, with Generate, Upload and Download on
 * each (spec "Détail d'une démarche"), the stage of what each holds (draft,
 * final, form to sign), one click for a stale piece, and, on a rendered final,
 * a check that it regenerates identically.
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
  private readonly procedures = inject(AdministrativeProcedureService);
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
  /** Why each watched piece renders, for what to say when it ends. */
  private readonly renderPurposes = new Map<number, RenderPurpose>();
  readonly downloadingIds = signal<ReadonlySet<number>>(new Set());
  readonly busyIds = signal<ReadonlySet<number>>(new Set());

  /** The stale pieces one click regenerates. */
  readonly stalePieces = computed(() =>
    this.detail().pieces.filter((piece) => canRegenerate(this.detail(), piece)),
  );

  constructor() {
    this.destroyRef.onDestroy(() => this.dialogRef?.destroy());

    // What renders is the server's to say: a render started before a reload,
    // in another tab or by another manager is watched like one started here.
    effect(() => {
      const pending = this.detail().pieces.filter(
        (piece) => piece.render?.state === RenderState.PENDING,
      );
      untracked(() => {
        for (const piece of pending) {
          if (piece.render) this.renderPurposes.set(piece.id, piece.render.purpose);
          this.watch(piece.id);
        }
      });
    });

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
          const purpose = this.renderPurposes.get(pieceId);
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
              this.translate.instant(
                purpose === RenderPurpose.VERIFY
                  ? 'ADMINISTRATIVE_DOCUMENT.PROCEDURES.PIECES.VERIFY_DONE'
                  : 'ADMINISTRATIVE_DOCUMENT.DOCUMENTS.RENDER_DONE',
              ) as string,
              VALIDATION_TYPE,
            );
          }
          this.stale.emit();
        },
        // A transient poll failure is not worth a toast; the next tick retries.
        error: () => this.stopWatching(pieceId),
      });
  }

  private watch(pieceId: number): void {
    if (this.renderStates().get(pieceId) === RenderState.PENDING) return;
    this.renderStates.update((states) => new Map(states).set(pieceId, RenderState.PENDING));
  }

  private stopWatching(pieceId: number): void {
    this.renderPurposes.delete(pieceId);
    this.renderStates.update((states) => {
      const next = new Map(states);
      next.delete(pieceId);
      return next;
    });
  }

  /** Watched here, or failed on the server (the slot keeps a failure until a retry). */
  renderState(piece: PieceOut): RenderState | null {
    return (
      this.renderStates().get(piece.id) ??
      (piece.render?.state === RenderState.FAILED ? RenderState.FAILED : null)
    );
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

  canRegenerate(piece: PieceOut): boolean {
    return canRegenerate(this.detail(), piece) && !this.isRendering(piece);
  }

  canVerify(piece: PieceOut): boolean {
    return canVerify(piece) && !this.isRendering(piece);
  }

  isBusy(piece: PieceOut): boolean {
    return this.busyIds().has(piece.id);
  }

  private setBusy(ids: number[], busy: boolean): void {
    this.busyIds.update((set) => {
      const next = new Set(set);
      for (const id of ids) {
        if (busy) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  /**
   * One click: a fresh pre-fill with the reviewer's own edits carried over.
   * Without a piece, every stale one. A piece whose version cannot say what was
   * typed opens the review form instead.
   */
  regenerate(piece?: PieceOut): void {
    const targets = piece ? [piece] : this.stalePieces();
    const ids = targets.map((p) => p.id);
    if (ids.length === 0) return;
    this.setBusy(ids, true);
    this.procedures
      .regenerate(this.detail().id, piece ? ids : undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.setBusy(ids, false);
          for (const id of data.requested) {
            this.renderPurposes.set(id, RenderPurpose.RENDER);
            this.watch(id);
          }
          if (data.requested.length) {
            this.snackbar.openSnackBar(
              this.translate.instant(
                'ADMINISTRATIVE_DOCUMENT.PROCEDURES.PIECES.REGENERATE_REQUESTED',
              ) as string,
              VALIDATION_TYPE,
            );
          }
          const review = targets.find((p) => data.needs_review.includes(p.id));
          if (review) this.openGenerate(review);
        },
        error: (error: unknown) => {
          this.setBusy(ids, false);
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }

  /** Regenerate the final from what it froze; the outcome shows on the row. */
  verify(piece: PieceOut): void {
    const version = piece.current_version;
    if (version === null) return;
    this.setBusy([piece.id], true);
    this.procedures
      .verify(this.detail().id, piece.id, version.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.setBusy([piece.id], false);
          this.renderPurposes.set(piece.id, RenderPurpose.VERIFY);
          this.watch(piece.id);
          this.snackbar.openSnackBar(
            this.translate.instant(
              'ADMINISTRATIVE_DOCUMENT.PROCEDURES.PIECES.VERIFY_REQUESTED',
            ) as string,
            VALIDATION_TYPE,
          );
        },
        error: (error: unknown) => {
          this.setBusy([piece.id], false);
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
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
      data: {
        documentId: piece.id,
        title: this.label(piece),
        toSign: piece.kind === DocumentKind.COLLECTED,
        upgradeAvailable: piece.template_superseded,
      },
    });
    this.dialogRef?.onClose
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((queued: boolean) => {
        if (!queued) return;
        this.renderPurposes.set(piece.id, RenderPurpose.RENDER);
        this.watch(piece.id);
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
    const label = pickLabel(piece.labels, this.lang(), piece.code);
    return piece.member_name ? `${label} — ${piece.member_name}` : label;
  }

  isToSign(piece: PieceOut): boolean {
    return piece.kind === DocumentKind.COLLECTED;
  }

  stageLabelKey(piece: PieceOut): string | null {
    return piece.current_version ? versionStageLabelKey(piece.current_version.stage) : null;
  }

  stageSeverity(piece: PieceOut): TagSeverity {
    return piece.current_version ? versionStageSeverity(piece.current_version.stage) : 'secondary';
  }

  checkLabelKey(piece: PieceOut): string | null {
    return piece.last_check ? checkOutcomeLabelKey(piece.last_check.outcome) : null;
  }

  checkSeverity(piece: PieceOut): TagSeverity {
    return piece.last_check ? checkOutcomeSeverity(piece.last_check.outcome) : 'secondary';
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
