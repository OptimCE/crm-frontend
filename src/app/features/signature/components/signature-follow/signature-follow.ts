import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { debounceTime } from 'rxjs';

import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { RealtimeService } from '../../../../core/services/realtime/realtime.service';
import { REALTIME_TOPICS } from '../../../../core/services/realtime/realtime.types';
import { HeaderPage } from '../../../../layout/header-page/header-page';
import {
  CommunitySignatureRequest,
  SignatureArtifact,
  SignatureRequestStatus,
} from '../../../../shared/dtos/signature.dtos';
import { LocaleDatePipe } from '../../../../shared/pipes/locale-format/locale-format-pipes';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { SignatureService } from '../../../../shared/services/signature.service';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error.utils';
import { downloadBlob } from '../../../../shared/utils/download.utils';
import { translatedOptions } from '../../../../shared/utils/translated-options.utils';
import {
  I18nText,
  TagSeverity,
  requestStatusKey,
  requestStatusSeverity,
  sourceText,
} from '../../signature-format';
import { SignatureCancelDialog } from '../signature-cancel-dialog/signature-cancel-dialog';

export const FOLLOW_PAGE_SIZE = 20;

const FILTER_STATUSES: SignatureRequestStatus[] = [
  'OPEN',
  'COMPLETED',
  'DECLINED',
  'CANCELLED',
  'EXPIRED',
  'FAILED',
  'PREPARING',
  'COMPLETING',
];

const OPEN_STATUSES = new Set<string>(['PREPARING', 'OPEN']);

/**
 * The community's signature requests (spec « Community admin view »), for its
 * managers: what each is, who asked, how far it got, until when; remind,
 * cancel, open the timeline, download once complete.
 */
@Component({
  selector: 'app-signature-follow',
  standalone: true,
  imports: [
    TranslatePipe,
    FormsModule,
    TableModule,
    Tag,
    Button,
    Select,
    Tooltip,
    HeaderPage,
    LocaleDatePipe,
    SignatureCancelDialog,
  ],
  templateUrl: './signature-follow.html',
})
export class SignatureFollow {
  private readonly service = inject(SignatureService);
  private readonly realtime = inject(RealtimeService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  readonly pageSize = FOLLOW_PAGE_SIZE;
  readonly rows = signal<CommunitySignatureRequest[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly failed = signal<string | null>(null);
  readonly first = signal(0);
  readonly status = signal<SignatureRequestStatus | null>(null);
  readonly statusOptions = translatedOptions(
    FILTER_STATUSES.map((value) => ({ value, label: requestStatusKey(value) })),
  );

  readonly reminding = signal<string | null>(null);
  readonly downloading = signal<string | null>(null);
  readonly cancelTarget = signal<CommunitySignatureRequest | null>(null);
  readonly cancelling = signal(false);

  constructor() {
    this.realtime
      .on(REALTIME_TOPICS.SIGNATURE_REQUEST_UPDATED)
      .pipe(debounceTime(400), takeUntilDestroyed())
      .subscribe(() => this.load(true));
  }

  load(fresh = false): void {
    if (fresh) this.service.invalidate();
    this.loading.set(true);
    this.service
      .listCommunityRequests({
        status: this.status() ?? undefined,
        limit: this.pageSize,
        offset: this.first(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.rows.set([...(data?.items ?? [])]);
          this.total.set(data?.total ?? 0);
          this.failed.set(null);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.rows.set([]);
          this.total.set(0);
          this.failed.set(
            extractApiErrorMessage(error) ??
              (this.translate.instant('SIGNATURE.FOLLOW.LOAD_ERROR') as string),
          );
          this.loading.set(false);
        },
      });
  }

  /** The table asks for its first page itself (lazy), then for each page turned. */
  onPage(event: TableLazyLoadEvent): void {
    this.first.set(event.first ?? 0);
    this.load();
  }

  onStatus(status: SignatureRequestStatus | null): void {
    this.status.set(status);
    this.first.set(0);
    this.load();
  }

  // ---- presentation -------------------------------------------------------------

  isOpen(row: CommunitySignatureRequest): boolean {
    return OPEN_STATUSES.has(row.status);
  }

  statusKey(row: CommunitySignatureRequest): string {
    return requestStatusKey(row.status);
  }

  statusSeverity(row: CommunitySignatureRequest): TagSeverity {
    return requestStatusSeverity(row.status);
  }

  source(row: CommunitySignatureRequest): I18nText {
    return sourceText(row.source_service);
  }

  // ---- actions ------------------------------------------------------------------

  open(row: CommunitySignatureRequest): void {
    void this.router.navigate(['/signatures/requests', row.id]);
  }

  remind(row: CommunitySignatureRequest): void {
    if (this.reminding()) return;
    this.reminding.set(row.id);
    this.service
      .remind(row.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.reminding.set(null);
          this.snackbar.openSnackBar(
            this.translate.instant('SIGNATURE.REQUEST.REMINDED', {
              n: data?.reminded ?? 0,
            }) as string,
            VALIDATION_TYPE,
          );
          this.load();
        },
        error: (error: unknown) => {
          this.reminding.set(null);
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }

  askCancel(row: CommunitySignatureRequest): void {
    this.cancelTarget.set(row);
  }

  cancel(reason: string | null): void {
    const row = this.cancelTarget();
    if (!row || this.cancelling()) return;
    this.cancelling.set(true);
    this.service
      .cancel(row.id, reason)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.cancelling.set(false);
          this.cancelTarget.set(null);
          this.snackbar.openSnackBar(
            this.translate.instant('SIGNATURE.REQUEST.CANCELLED') as string,
            VALIDATION_TYPE,
          );
          this.load();
        },
        error: (error: unknown) => {
          this.cancelling.set(false);
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }

  isDownloading(row: CommunitySignatureRequest, kind: SignatureArtifact): boolean {
    return this.downloading() === `${row.id}:${kind}`;
  }

  download(row: CommunitySignatureRequest, kind: SignatureArtifact): void {
    if (this.downloading()) return;
    this.downloading.set(`${row.id}:${kind}`);
    this.service
      .downloadArtifact(row.id, kind)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ blob, filename }) => {
          this.downloading.set(null);
          downloadBlob(blob, filename);
        },
        error: (error: unknown) => {
          this.downloading.set(null);
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }
}
