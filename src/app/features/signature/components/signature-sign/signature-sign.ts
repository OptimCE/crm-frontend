import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import Keycloak from 'keycloak-js';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import {
  Subject,
  Subscription,
  catchError,
  debounceTime,
  exhaustMap,
  filter,
  from,
  map,
  merge,
  of,
  switchMap,
  takeUntil,
  takeWhile,
  timer,
} from 'rxjs';

import { ERROR_TYPE, INFO_TYPE } from '../../../../core/dtos/notification';
import { RealtimeService } from '../../../../core/services/realtime/realtime.service';
import {
  REALTIME_RECONNECTED,
  REALTIME_TOPICS,
} from '../../../../core/services/realtime/realtime.types';
import { BackArrow } from '../../../../layout/back-arrow/back-arrow';
import {
  SIGNATURE_ERRORS,
  SignIn,
  SignMethod,
  SignatureFieldView,
  SignatureRequestDetail,
} from '../../../../shared/dtos/signature.dtos';
import { LocaleDatePipe } from '../../../../shared/pipes/locale-format/locale-format-pipes';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { SignatureService } from '../../../../shared/services/signature.service';
import {
  extractApiErrorCode,
  extractApiErrorMessage,
} from '../../../../shared/utils/api-error.utils';
import { downloadBlob } from '../../../../shared/utils/download.utils';
import { PdfDocumentHandle, PdfPageInfo, PdfRenderer } from '../../pdf-renderer';
import { SignatureInk, SignaturePadHandle } from '../../signature-ink';
import {
  FieldValues,
  PercentBox,
  boxStyle,
  capacityText,
  clearDraft,
  fieldsPayload,
  initialFieldValues,
  isFillable,
  loadDraft,
  requestStatusKey,
  requiredFieldsFilled,
  saveDraft,
} from '../../signature-format';
import { SignatureStore } from '../../signature.store';

/** How often the screen asks whether the seal is done (realtime is off in production). */
export const SEAL_POLL_MS = 2000;
/** After this, stop asking and say so calmly: the notification will tell. */
export const SEAL_TIMEOUT_MS = 120_000;

/**
 * - `loading`: the request, then the document.
 * - `ready`: the user's turn; the document is shown and can be signed.
 * - `waiting`: an earlier signer goes first (sequential order); read only.
 * - `sealing` / `slow`: the 202 came back, the seal worker is on it.
 * - `signed`, `declined`, `closed`: nothing left to do here.
 * - `stale`: the document changed under the signer (409 2511); reload it.
 * - `error`: the request could not be read (404: not the user's).
 */
export type SignPhase =
  | 'loading'
  | 'ready'
  | 'waiting'
  | 'sealing'
  | 'slow'
  | 'signed'
  | 'declined'
  | 'closed'
  | 'stale'
  | 'error';

interface PlacedField {
  field: SignatureFieldView;
  page: number;
  style: Record<string, string>;
}

/**
 * The signing screen (spec « Signing screen »): the document as it will be
 * signed, the signer's slot and fields over it, a typed or drawn signature,
 * the consent statement, and Sign.
 *
 * WYSIWYS: the bytes rendered are the bytes hashed (SignatureService hashes
 * them in the browser), and that hash goes back on view and on sign; the
 * annexe refuses a hash of a revision it never served.
 *
 * Step-up: the annexe wants a login of less than 5 minutes. On 401 (2510) the
 * draft goes to sessionStorage and Keycloak is asked for a fresh login
 * (`max_age=0`), back to this screen with `?resume=1`, where the draft is
 * restored.
 */
@Component({
  selector: 'app-signature-sign',
  standalone: true,
  imports: [
    TranslatePipe,
    FormsModule,
    RouterLink,
    Button,
    Checkbox,
    Dialog,
    InputText,
    Textarea,
    BackArrow,
    LocaleDatePipe,
  ],
  templateUrl: './signature-sign.html',
  styleUrl: './signature-sign.css',
})
export class SignatureSign {
  private readonly service = inject(SignatureService);
  private readonly renderer = inject(PdfRenderer);
  private readonly ink = inject(SignatureInk);
  private readonly store = inject(SignatureStore);
  private readonly realtime = inject(RealtimeService);
  private readonly keycloak = inject(Keycloak);
  private readonly location = inject(Location);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  /** Route params, bound by `withComponentInputBinding()`. */
  readonly requestId = input.required<string>();
  readonly signerId = input.required<string>();

  private readonly pageCanvases = viewChildren<ElementRef<HTMLCanvasElement>>('pageCanvas');
  private readonly padCanvas = viewChild<ElementRef<HTMLCanvasElement>>('padCanvas');
  private readonly slotElement = viewChild<ElementRef<HTMLElement>>('slotAnchor');

  readonly phase = signal<SignPhase>('loading');
  readonly detail = signal<SignatureRequestDetail | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly pages = signal<PdfPageInfo[]>([]);
  /** The SHA-256 of the bytes on screen: sent on view and on sign. */
  readonly documentSha = signal<string | null>(null);

  readonly method = signal<SignMethod>('TYPED');
  readonly typedName = signal('');
  readonly drawnPng = signal<string | null>(null);
  readonly fieldValues = signal<FieldValues>({});
  readonly consent = signal(false);
  /** The draft kept across the step-up login was put back. */
  readonly restored = signal(false);
  readonly submitting = signal(false);

  readonly declineVisible = signal(false);
  readonly declineReason = signal('');
  readonly declining = signal(false);
  readonly downloading = signal(false);

  readonly signer = computed(
    () => this.detail()?.signers.find((signer) => signer.id === this.signerId()) ?? null,
  );
  readonly slot = computed(
    () => this.detail()?.my_slots.find((slot) => slot.signer_id === this.signerId()) ?? null,
  );
  readonly fields = computed(() => this.slot()?.fields ?? []);
  readonly fillableFields = computed(() => this.fields().filter(isFillable));
  readonly dateFields = computed(() => this.fields().filter((field) => !isFillable(field)));
  readonly capacity = computed(() => {
    const signer = this.signer();
    return signer ? capacityText(signer) : null;
  });

  readonly hasSignature = computed(() =>
    this.method() === 'TYPED' ? this.typedName().trim().length > 0 : this.drawnPng() !== null,
  );
  readonly fieldsFilled = computed(() => requiredFieldsFilled(this.fields(), this.fieldValues()));
  /** « Signer » stays disabled until consent, every required field and a signature. */
  readonly canSign = computed(
    () =>
      this.phase() === 'ready' &&
      this.slot() !== null &&
      this.documentSha() !== null &&
      this.consent() &&
      this.fieldsFilled() &&
      this.hasSignature() &&
      !this.submitting(),
  );
  readonly canDecline = computed(
    () => (this.phase() === 'ready' || this.phase() === 'waiting') && this.slot() !== null,
  );

  /** The signer's own slot, highlighted, in percent of its page. */
  readonly slotBox = computed<{ page: number; style: Record<string, string> } | null>(() => {
    const slot = this.signer()?.slot;
    if (!slot) return null;
    const page = this.pages()[slot.page];
    if (!page) return null;
    return { page: slot.page, style: boxStyle(this.toBox(page, slot.rect)) };
  });

  readonly placedFields = computed<PlacedField[]>(() => {
    const pages = this.pages();
    return this.fields().flatMap((field) => {
      const page = field.slot ? pages[field.slot.page] : undefined;
      if (!field.slot || !page) return [];
      return [{ field, page: field.slot.page, style: boxStyle(this.toBox(page, field.slot.rect)) }];
    });
  });

  private document: PdfDocumentHandle | null = null;
  private pad: SignaturePadHandle | null = null;
  private padCanvasElement: HTMLCanvasElement | null = null;
  private sealing: Subscription | null = null;
  private fieldsInitialized = false;
  private draftChecked = false;
  private readonly repaint$ = new Subject<void>();

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.document?.destroy();
      this.pad?.destroy();
    });
    this.repaint$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => void this.paint());

    // The router reuses this screen when only the ids change (a notification
    // for another slot): start over for each slot.
    effect(() => {
      this.requestId();
      this.signerId();
      untracked(() => this.start());
    });
  }

  // ---- loading -----------------------------------------------------------------

  /** Everything about the previous slot goes; then the new one loads. */
  private start(): void {
    this.sealing?.unsubscribe();
    this.sealing = null;
    this.fieldsInitialized = false;
    this.draftChecked = false;
    this.detail.set(null);
    this.pages.set([]);
    this.documentSha.set(null);
    this.method.set('TYPED');
    this.typedName.set('');
    this.drawnPng.set(null);
    this.pad?.clear();
    this.fieldValues.set({});
    this.consent.set(false);
    this.restored.set(false);
    this.submitting.set(false);
    this.load();
  }

  /** The request first (what to say), then the document when there is something to sign. */
  load(): void {
    this.phase.set('loading');
    this.loadError.set(null);
    this.service
      .getRequest(this.requestId(), true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.detail.set(data);
          this.afterDetail(data);
        },
        error: (error: unknown) => {
          this.loadError.set(extractApiErrorMessage(error));
          this.phase.set('error');
        },
      });
  }

  private afterDetail(detail: SignatureRequestDetail): void {
    const signer = this.signer();
    const slot = this.slot();
    if (!signer || !slot) {
      this.phase.set('error');
      return;
    }
    switch (signer.status) {
      case 'SIGNED':
        this.phase.set('signed');
        return;
      case 'DECLINED':
        this.phase.set('declined');
        return;
      case 'SIGNING':
        this.phase.set('sealing');
        this.waitForSeal();
        return;
    }
    if (detail.request.status !== 'OPEN') {
      this.phase.set('closed');
      return;
    }
    if (!this.fieldsInitialized) {
      this.fieldValues.set(initialFieldValues(slot.fields));
      this.fieldsInitialized = true;
    }
    this.restoreDraft();
    this.loadDocument(signer.status === 'INVITED' || signer.status === 'VIEWED');
  }

  /**
   * The bytes, their hash, then pdf.js on THOSE bytes. The view is recorded
   * with the same hash, once the document is on screen.
   */
  private loadDocument(yourTurn: boolean): void {
    this.service
      .getDocument(this.requestId())
      .pipe(
        switchMap((document) =>
          from(this.renderer.open(document.bytes)).pipe(map((handle) => ({ document, handle }))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ document, handle }) => {
          this.document?.destroy();
          this.document = handle;
          this.documentSha.set(document.sha256);
          this.pages.set(handle.pages);
          this.phase.set(yourTurn ? 'ready' : 'waiting');
          afterNextRender(
            () => {
              void this.paint();
              if (this.method() === 'DRAWN') this.ensurePad();
            },
            { injector: this.injector },
          );
          if (yourTurn) {
            this.service
              .view(this.requestId(), this.signerId(), document.sha256)
              .pipe(takeUntilDestroyed(this.destroyRef))
              // A lost view record is the annexe's to regret, not the signer's.
              .subscribe({ error: () => undefined });
          }
        },
        error: (error: unknown) => {
          this.loadError.set(extractApiErrorMessage(error));
          this.phase.set('error');
        },
      });
  }

  private async paint(): Promise<void> {
    const handle = this.document;
    if (!handle) return;
    for (const [index, ref] of this.pageCanvases().entries()) {
      const canvas = ref.nativeElement;
      const width = canvas.parentElement?.clientWidth || 800;
      try {
        await handle.render(index, canvas, width);
      } catch {
        // One page that fails to draw must not hide the others.
      }
    }
  }

  /** A sharper render once the page settles at its new width. */
  onResize(): void {
    this.repaint$.next();
    this.pad?.resize();
  }

  private toBox(page: PdfPageInfo, rect: readonly number[]): PercentBox {
    return page.toBox(rect);
  }

  private restoreDraft(): void {
    if (this.draftChecked) return;
    this.draftChecked = true;
    const draft = loadDraft(this.signerId());
    if (!draft) return;
    this.method.set(draft.method);
    this.typedName.set(draft.typedName);
    this.drawnPng.set(draft.method === 'DRAWN' ? draft.imagePng : null);
    this.fieldValues.update((values) => ({ ...values, ...draft.fields }));
    this.consent.set(draft.consent);
    this.restored.set(true);
  }

  // ---- the signature --------------------------------------------------------

  selectMethod(method: SignMethod): void {
    this.method.set(method);
    if (method === 'DRAWN') {
      afterNextRender(() => this.ensurePad(), { injector: this.injector });
    }
  }

  /**
   * The pad is made the first time its canvas is shown, then refitted. A new
   * canvas (the panel was re-rendered, after a reload) gets a new pad, with
   * the drawing put back.
   */
  private ensurePad(): void {
    const canvas = this.padCanvas()?.nativeElement;
    if (!canvas) return;
    if (this.pad && this.padCanvasElement === canvas) {
      this.pad.resize();
      return;
    }
    this.pad?.destroy();
    const pad = this.ink.createPad(canvas);
    pad.onEnd(() => this.drawnPng.set(pad.isEmpty() ? null : pad.toDataURL()));
    this.pad = pad;
    this.padCanvasElement = canvas;
    const drawn = this.drawnPng();
    if (drawn) void pad.fromDataURL(drawn);
  }

  clearDrawing(): void {
    this.pad?.clear();
    this.drawnPng.set(null);
  }

  setField(name: string, value: string | boolean): void {
    this.fieldValues.update((values) => ({ ...values, [name]: value }));
  }

  textValue(name: string): string {
    const value = this.fieldValues()[name];
    return typeof value === 'string' ? value : '';
  }

  checked(name: string): boolean {
    return this.fieldValues()[name] === true;
  }

  scrollToSlot(): void {
    this.slotElement()?.nativeElement.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }

  async sign(): Promise<void> {
    const slot = this.slot();
    const sha = this.documentSha();
    if (!this.canSign() || !slot || !sha) return;
    this.submitting.set(true);

    const method = this.method();
    let image: string | null;
    try {
      const drawn = this.drawnPng();
      image =
        method === 'TYPED'
          ? await this.ink.typedPng(this.typedName())
          : drawn && (await this.ink.trimPng(drawn));
    } catch {
      image = null;
    }
    if (!image) {
      this.submitting.set(false);
      this.snackbar.openSnackBar(
        this.translate.instant('SIGNATURE.SIGN.IMAGE_FAILED') as string,
        ERROR_TYPE,
      );
      return;
    }

    const body: SignIn = {
      method,
      typed_name: method === 'TYPED' ? this.typedName().trim() : null,
      image_png: image,
      fields: fieldsPayload(slot.fields, this.fieldValues()),
      consent_version: slot.consent_version,
      consent_accepted: true,
      document_sha256: sha,
    };
    this.service
      .sign(this.requestId(), this.signerId(), body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          clearDraft(this.signerId());
          this.restored.set(false);
          this.submitting.set(false);
          this.phase.set('sealing');
          this.store.refresh();
          this.waitForSeal();
        },
        error: (error: unknown) => this.onSignError(error, image),
      });
  }

  private onSignError(error: unknown, image: string): void {
    this.submitting.set(false);
    const code = extractApiErrorCode(error);
    const status = error instanceof HttpErrorResponse ? error.status : 0;
    if (code === SIGNATURE_ERRORS.STEP_UP_REQUIRED || status === 401) {
      this.stepUp(image);
      return;
    }
    if (code === SIGNATURE_ERRORS.DOCUMENT_CHANGED) {
      this.phase.set('stale');
      return;
    }
    this.errorHandler.handleError(extractApiErrorMessage(error));
    if (code === SIGNATURE_ERRORS.SLOT_NOT_OPEN || code === SIGNATURE_ERRORS.REQUEST_CLOSED) {
      this.load();
    }
  }

  /** Keep what was prepared, then a fresh login that comes back here. */
  private stepUp(image: string): void {
    saveDraft(this.signerId(), {
      method: this.method(),
      typedName: this.typedName(),
      imagePng: image,
      fields: this.fieldValues(),
      consent: this.consent(),
    });
    this.snackbar.openSnackBar(
      this.translate.instant('SIGNATURE.SIGN.STEP_UP') as string,
      INFO_TYPE,
    );
    const path = this.location.prepareExternalUrl(
      `/signatures/${encodeURIComponent(this.requestId())}/signers/${encodeURIComponent(
        this.signerId(),
      )}?resume=1`,
    );
    void this.keycloak.login({
      // Absolute, on this origin, under the app's base href.
      redirectUri: new URL(path, window.location.origin).href,
      prompt: 'login',
      maxAge: 0,
    });
  }

  /**
   * Until the slot is SIGNED: the realtime `signature.signed` for this signer,
   * or a read every 2 s (realtime is off in production). Two minutes at most.
   */
  private waitForSeal(): void {
    this.sealing?.unsubscribe();
    const signed$ = this.realtime
      .on(REALTIME_TOPICS.SIGNATURE_SIGNED)
      .pipe(
        filter(
          (event) => event.topic === REALTIME_RECONNECTED || event.ref?.id === this.signerId(),
        ),
      );
    this.sealing = merge(timer(SEAL_POLL_MS, SEAL_POLL_MS), signed$)
      .pipe(
        exhaustMap(() =>
          this.service.getRequest(this.requestId(), true).pipe(catchError(() => of(null))),
        ),
        map((response) => response?.data ?? null),
        filter((detail): detail is SignatureRequestDetail => detail !== null),
        takeWhile((detail) => !this.settled(detail), true),
        takeUntil(timer(SEAL_TIMEOUT_MS)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (detail) => {
          this.detail.set(detail);
          if (!this.settled(detail)) return;
          const status = this.signer()?.status;
          if (status === 'SIGNED') this.phase.set('signed');
          else if (status === 'DECLINED') this.phase.set('declined');
          else this.phase.set('closed');
          this.store.refresh();
        },
        complete: () => {
          if (this.phase() === 'sealing') this.phase.set('slow');
        },
      });
  }

  private settled(detail: SignatureRequestDetail): boolean {
    const signer = detail.signers.find((s) => s.id === this.signerId());
    if (signer?.status === 'SIGNED' || signer?.status === 'DECLINED') return true;
    return ['DECLINED', 'CANCELLED', 'EXPIRED', 'FAILED'].includes(detail.request.status);
  }

  /** Ask again from the start, keeping what was typed (after a 409 2511). */
  reload(): void {
    this.documentSha.set(null);
    this.pages.set([]);
    this.load();
  }

  // ---- decline ----------------------------------------------------------------

  openDecline(): void {
    this.declineReason.set('');
    this.declineVisible.set(true);
  }

  decline(): void {
    const reason = this.declineReason().trim();
    if (!reason || this.declining()) return;
    this.declining.set(true);
    this.service
      .decline(this.requestId(), this.signerId(), reason.slice(0, 1000))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.declining.set(false);
          this.declineVisible.set(false);
          clearDraft(this.signerId());
          this.phase.set('declined');
          this.store.refresh();
        },
        error: (error: unknown) => {
          this.declining.set(false);
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }

  // ---- after ------------------------------------------------------------------

  downloadSigned(): void {
    if (this.downloading()) return;
    this.downloading.set(true);
    this.service
      .downloadArtifact(this.requestId(), 'final')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ blob, filename }) => {
          this.downloading.set(false);
          downloadBlob(blob, filename);
        },
        error: (error: unknown) => {
          this.downloading.set(false);
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }

  requestStatusKey(status: string): string {
    return requestStatusKey(status);
  }
}
