import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';

import { HeaderPage } from '../../../../layout/header-page/header-page';
import { MySignatureRow } from '../../../../shared/dtos/signature.dtos';
import { LocaleDatePipe } from '../../../../shared/pipes/locale-format/locale-format-pipes';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SignatureService } from '../../../../shared/services/signature.service';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error.utils';
import { downloadBlob } from '../../../../shared/utils/download.utils';
import {
  I18nText,
  TagSeverity,
  capacityText,
  pastRows,
  pendingRows,
  requestStatusKey,
  requestStatusSeverity,
  signerStatusKey,
  signerStatusSeverity,
} from '../../signature-format';
import { SignatureStore } from '../../signature.store';

/**
 * « À signer » (spec « To sign inbox »): every slot the user may sign, in every
 * community, the ones they can sign now first; then what they already signed
 * or declined, with the signed PDF once every party has signed.
 *
 * The rows are the SignatureStore's, so the badge and this list never disagree.
 */
@Component({
  selector: 'app-signature-inbox',
  standalone: true,
  imports: [TranslatePipe, RouterLink, Button, Tag, HeaderPage, LocaleDatePipe],
  templateUrl: './signature-inbox.html',
})
export class SignatureInbox implements OnInit {
  protected readonly store = inject(SignatureStore);
  private readonly service = inject(SignatureService);
  private readonly router = inject(Router);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  readonly pending = computed(() => pendingRows(this.store.rows()));
  readonly past = computed(() => pastRows(this.store.rows()));
  readonly downloadingIds = signal<ReadonlySet<string>>(new Set());

  ngOnInit(): void {
    this.store.refresh();
  }

  capacity(row: MySignatureRow): I18nText {
    return capacityText(row.signer);
  }

  requestStatusKey(row: MySignatureRow): string {
    return requestStatusKey(row.request.status);
  }

  requestSeverity(row: MySignatureRow): TagSeverity {
    return requestStatusSeverity(row.request.status);
  }

  signerStatusKey(row: MySignatureRow): string {
    return signerStatusKey(row.signer.status);
  }

  signerSeverity(row: MySignatureRow): TagSeverity {
    return signerStatusSeverity(row.signer.status);
  }

  signLink(row: MySignatureRow): string[] {
    return ['/signatures', row.request.id, 'signers', row.signer.id];
  }

  openSign(row: MySignatureRow): void {
    void this.router.navigate(this.signLink(row));
  }

  detailLink(row: MySignatureRow): string[] {
    return ['/signatures/requests', row.request.id];
  }

  isDownloading(row: MySignatureRow): boolean {
    return this.downloadingIds().has(row.request.id);
  }

  /** The PDF every party signed, once the request is complete. */
  download(row: MySignatureRow): void {
    const id = row.request.id;
    if (this.downloadingIds().has(id)) return;
    this.downloadingIds.update((ids) => new Set(ids).add(id));
    this.service
      .downloadArtifact(id, 'final')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ blob, filename }) => {
          this.stopDownloading(id);
          downloadBlob(blob, filename);
        },
        error: (error: unknown) => {
          this.stopDownloading(id);
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }

  private stopDownloading(id: string): void {
    this.downloadingIds.update((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
  }
}
