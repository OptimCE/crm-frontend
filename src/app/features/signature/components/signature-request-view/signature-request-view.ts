import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { debounceTime } from 'rxjs';

import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { RealtimeService } from '../../../../core/services/realtime/realtime.service';
import { REALTIME_TOPICS } from '../../../../core/services/realtime/realtime.types';
import { BackArrow } from '../../../../layout/back-arrow/back-arrow';
import {
  SignatureArtifact,
  SignatureEvent,
  SignatureRequestDetail,
  SignatureTimeline,
  SignerView,
} from '../../../../shared/dtos/signature.dtos';
import { LocaleDatePipe } from '../../../../shared/pipes/locale-format/locale-format-pipes';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { SignatureService } from '../../../../shared/services/signature.service';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error.utils';
import { downloadBlob } from '../../../../shared/utils/download.utils';
import {
  I18nText,
  TagSeverity,
  capacityText,
  eventIcon,
  eventText,
  isYourTurn,
  requestStatusKey,
  requestStatusSeverity,
  signerStatusKey,
  signerStatusSeverity,
  sourceText,
} from '../../signature-format';
import { SignatureStore } from '../../signature.store';
import { SignatureCancelDialog } from '../signature-cancel-dialog/signature-cancel-dialog';

const OPEN_STATUSES = new Set(['PREPARING', 'OPEN']);

/**
 * One request: who signs, where it stands, the files once complete. A signer
 * lands here from a notification or from their past signatures; a manager or
 * admin of the community (`can_follow`) also gets the timeline, with the hash
 * chain's verdict, and remind / cancel while it is open.
 */
@Component({
  selector: 'app-signature-request-view',
  standalone: true,
  imports: [TranslatePipe, Button, Tag, BackArrow, LocaleDatePipe, SignatureCancelDialog],
  templateUrl: './signature-request-view.html',
})
export class SignatureRequestView {
  private readonly service = inject(SignatureService);
  private readonly store = inject(SignatureStore);
  private readonly realtime = inject(RealtimeService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  readonly requestId = input.required<string>();

  readonly detail = signal<SignatureRequestDetail | null>(null);
  readonly timeline = signal<SignatureTimeline | null>(null);
  readonly loading = signal(true);
  readonly failed = signal<string | null>(null);
  readonly downloading = signal<SignatureArtifact | null>(null);
  readonly reminding = signal(false);
  readonly cancelVisible = signal(false);
  readonly cancelling = signal(false);

  readonly isOpen = computed(() => OPEN_STATUSES.has(this.detail()?.request.status ?? ''));
  /** The caller's own slots that can be signed now. */
  readonly mySignable = computed(() =>
    (this.detail()?.signers ?? []).filter(
      (signer) => signer.mine && isYourTurn(this.detail()?.request.status ?? '', signer.status),
    ),
  );
  /** Newest first: what happened last is what the reader came for. */
  readonly events = computed(() => [...(this.timeline()?.events ?? [])].reverse());

  constructor() {
    this.realtime
      .on(REALTIME_TOPICS.SIGNATURE_REQUEST_UPDATED, REALTIME_TOPICS.SIGNATURE_SIGNED)
      .pipe(debounceTime(400), takeUntilDestroyed())
      .subscribe(() => this.load(false));

    // Reused by the router when only the id changes (a notification for another request).
    effect(() => {
      this.requestId();
      untracked(() => {
        this.detail.set(null);
        this.timeline.set(null);
        this.load(true);
      });
    });
  }

  load(showSpinner: boolean): void {
    if (showSpinner) this.loading.set(true);
    this.service
      .getRequest(this.requestId(), true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.detail.set(data);
          this.failed.set(null);
          this.loading.set(false);
          if (data.can_follow) this.loadTimeline();
        },
        error: (error: unknown) => {
          this.failed.set(
            extractApiErrorMessage(error) ??
              (this.translate.instant('SIGNATURE.COMMON.LOAD_ERROR') as string),
          );
          this.loading.set(false);
        },
      });
  }

  private loadTimeline(): void {
    this.service
      .getEvents(this.requestId(), true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      // The timeline is a complement: the page stands without it.
      .subscribe({ next: ({ data }) => this.timeline.set(data), error: () => undefined });
  }

  // ---- presentation -------------------------------------------------------------

  capacity(signer: SignerView): I18nText {
    return capacityText(signer);
  }

  signerStatusKey(signer: SignerView): string {
    return signerStatusKey(signer.status);
  }

  signerSeverity(signer: SignerView): TagSeverity {
    return signerStatusSeverity(signer.status);
  }

  requestStatusKey(status: string): string {
    return requestStatusKey(status);
  }

  requestSeverity(status: string): TagSeverity {
    return requestStatusSeverity(status);
  }

  source(source: string): I18nText {
    return sourceText(source);
  }

  eventText(event: SignatureEvent): I18nText {
    return eventText(event);
  }

  eventIcon(event: SignatureEvent): string {
    return eventIcon(event.type);
  }

  // ---- actions ------------------------------------------------------------------

  sign(signer: SignerView): void {
    void this.router.navigate(['/signatures', this.requestId(), 'signers', signer.id]);
  }

  download(kind: SignatureArtifact): void {
    if (this.downloading()) return;
    this.downloading.set(kind);
    this.service
      .downloadArtifact(this.requestId(), kind)
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

  remind(): void {
    if (this.reminding()) return;
    this.reminding.set(true);
    this.service
      .remind(this.requestId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.reminding.set(false);
          this.snackbar.openSnackBar(
            this.translate.instant('SIGNATURE.REQUEST.REMINDED', {
              n: data?.reminded ?? 0,
            }) as string,
            VALIDATION_TYPE,
          );
          this.load(false);
        },
        error: (error: unknown) => {
          this.reminding.set(false);
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }

  cancel(reason: string | null): void {
    if (this.cancelling()) return;
    this.cancelling.set(true);
    this.service
      .cancel(this.requestId(), reason)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.cancelling.set(false);
          this.cancelVisible.set(false);
          this.snackbar.openSnackBar(
            this.translate.instant('SIGNATURE.REQUEST.CANCELLED') as string,
            VALIDATION_TYPE,
          );
          this.store.refresh();
          this.load(false);
        },
        error: (error: unknown) => {
          this.cancelling.set(false);
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }
}
