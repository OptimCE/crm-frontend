import { DatePipe, JsonPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Tag } from 'primeng/tag';

import { ERROR_TYPE } from '../../../../core/dtos/notification';
import {
  DocumentDetailOut,
  DocumentVersionOut,
} from '../../../../shared/dtos/administrative-document.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeDocumentService } from '../../../../shared/services/administrative-document.service';
import { downloadBlob } from '../../../../shared/utils/download.utils';
import {
  docTypeLabelKey,
  extractApiErrorMessage,
  formatBytes,
  shortSha,
} from '../../administrative-document-format';

interface DocumentDetailDialogData {
  documentId: number;
}

/** Read-only: the stored versions of a document, newest first, downloadable. */
@Component({
  selector: 'app-document-detail-dialog',
  standalone: true,
  imports: [TranslatePipe, Button, Tag, DatePipe, JsonPipe],
  templateUrl: './document-detail-dialog.html',
  providers: [ErrorMessageHandler],
})
export class DocumentDetailDialog implements OnInit {
  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig<DocumentDetailDialogData>);
  private readonly service = inject(AdministrativeDocumentService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  private readonly dialogData = this.config.data as DocumentDetailDialogData | undefined;

  readonly document = signal<DocumentDetailOut | null>(null);
  readonly loading = signal<boolean>(true);
  readonly downloadingId = signal<number | null>(null);

  ngOnInit(): void {
    const id = this.dialogData?.documentId;
    if (id === undefined) {
      this.loading.set(false);
      return;
    }
    this.service
      .getDocument(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.document.set(res.data);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }

  /** Newest version first — the one people usually want. */
  versions(): DocumentVersionOut[] {
    return [...(this.document()?.versions ?? [])].sort((a, b) => b.version_no - a.version_no);
  }

  isCurrent(version: DocumentVersionOut): boolean {
    return this.document()?.current_version_id === version.id;
  }

  docTypeKey(): string {
    const doc = this.document();
    return doc ? docTypeLabelKey(doc.doc_type) : '';
  }

  size(version: DocumentVersionOut): string {
    return formatBytes(version.byte_size);
  }

  checksum(version: DocumentVersionOut): string {
    return shortSha(version.content_sha256);
  }

  // ---- generated-version provenance --------------------------------------

  readonly openSnapshots = signal<ReadonlySet<number>>(new Set());

  /** Only generated versions carry one; an upload has nothing to show. */
  hasSnapshot(version: DocumentVersionOut): boolean {
    return version.data_snapshot_json !== null && version.data_snapshot_json !== undefined;
  }

  isSnapshotOpen(version: DocumentVersionOut): boolean {
    return this.openSnapshots().has(version.id);
  }

  /**
   * Show the exact payload this version was rendered from.
   *
   * Raw JSON on purpose: this is evidence of what was filed, so nothing may be
   * summarised away — the same reasoning as the journal's raw-context toggle.
   */
  toggleSnapshot(version: DocumentVersionOut): void {
    this.openSnapshots.update((open) => {
      const next = new Set(open);
      if (next.has(version.id)) next.delete(version.id);
      else next.add(version.id);
      return next;
    });
  }

  download(version: DocumentVersionOut): void {
    const documentId = this.dialogData?.documentId;
    if (documentId === undefined) return;

    this.downloadingId.set(version.id);
    this.service
      .downloadVersion(documentId, version.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ blob, filename }) => {
          this.downloadingId.set(null);
          downloadBlob(blob, filename);
        },
        error: () => {
          this.downloadingId.set(null);
          this.snackbar.openSnackBar(
            this.translate.instant(
              'ADMINISTRATIVE_DOCUMENT.DIALOGS.DOCUMENT_DETAIL.DOWNLOAD_FAILED',
            ) as string,
            ERROR_TYPE,
          );
        },
      });
  }

  isDownloading(version: DocumentVersionOut): boolean {
    return this.downloadingId() === version.id;
  }

  close(): void {
    this.ref.close(false);
  }
}
