import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import Keycloak from 'keycloak-js';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { RealtimeService } from '../../../../core/services/realtime/realtime.service';
import { REALTIME_TOPICS, RealtimeEvent } from '../../../../core/services/realtime/realtime.types';
import { SignIn, SignatureRequestDetail } from '../../../../shared/dtos/signature.dtos';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { SignatureService } from '../../../../shared/services/signature.service';
import { PdfDocumentHandle, PdfRenderer } from '../../pdf-renderer';
import { SignatureInk } from '../../signature-ink';
import { draftKey, loadDraft, pdfRectToBox } from '../../signature-format';
import { REQUEST_ID, SIGNER_ID, requestDetail } from '../../signature-fixtures';
import { SignatureStore } from '../../signature.store';
import { SEAL_POLL_MS, SEAL_TIMEOUT_MS, SignatureSign } from './signature-sign';

const DISPLAYED_SHA = 'a'.repeat(64);
const TYPED_PNG = 'data:image/png;base64,VFlQRUQ=';
const DRAWN_PNG = 'data:image/png;base64,RFJBV04=';
const TRIMMED_PNG = 'data:image/png;base64,VFJJTU1FRA==';

describe('SignatureSign (the signing screen)', () => {
  let fixture: ComponentFixture<SignatureSign>;
  let getRequest: ReturnType<typeof vi.fn>;
  let getDocument: ReturnType<typeof vi.fn>;
  let view: ReturnType<typeof vi.fn>;
  let sign: ReturnType<typeof vi.fn>;
  let decline: ReturnType<typeof vi.fn>;
  let open: ReturnType<typeof vi.fn>;
  let typedPng: ReturnType<typeof vi.fn>;
  let trimPng: ReturnType<typeof vi.fn>;
  let login: ReturnType<typeof vi.fn>;
  let refresh: ReturnType<typeof vi.fn>;
  let realtime: Subject<RealtimeEvent>;
  let displayed: ArrayBuffer;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byTestId = (id: string): HTMLElement | null =>
    root().querySelector(`[data-testid="${id}"]`);
  const signButton = (): HTMLButtonElement | null =>
    byTestId('signature-sign__button--sign')?.querySelector('button') ?? null;

  /** Promises (pdf.js, the typed PNG) settle on microtasks; let them, then render. */
  async function settle(): Promise<void> {
    for (let i = 0; i < 10; i++) await Promise.resolve();
    fixture.detectChanges();
  }

  function type(testId: string, value: string): void {
    const input = byTestId(testId) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function tickConsent(): void {
    byTestId('signature-sign__consent')?.querySelector('input')?.click();
    fixture.detectChanges();
  }

  /** The three things « Signer » waits for. */
  async function prepare(): Promise<void> {
    type('signature-sign__typed-name', 'Alice Dupont');
    type('signature-sign__field--place', 'Liège');
    tickConsent();
    await settle();
  }

  async function create(detail: SignatureRequestDetail = requestDetail()): Promise<void> {
    getRequest.mockReturnValue(of({ data: detail }));
    fixture = TestBed.createComponent(SignatureSign);
    fixture.componentRef.setInput('requestId', REQUEST_ID);
    fixture.componentRef.setInput('signerId', SIGNER_ID);
    fixture.detectChanges();
    await settle();
  }

  beforeEach(async () => {
    sessionStorage.clear();
    displayed = new TextEncoder().encode('%PDF-1.7 displayed').buffer;
    getRequest = vi.fn();
    getDocument = vi
      .fn()
      .mockReturnValue(of({ bytes: displayed, sha256: DISPLAYED_SHA, revision: 1 }));
    view = vi.fn().mockReturnValue(of(null));
    sign = vi.fn().mockReturnValue(of({ data: { status: 'signing' } }));
    decline = vi.fn().mockReturnValue(of(null));
    const handle: PdfDocumentHandle = {
      pages: [{ index: 0, width: 595, height: 842, toBox: (rect) => pdfRectToBox(rect, 595, 842) }],
      render: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn(),
    };
    open = vi.fn().mockResolvedValue(handle);
    typedPng = vi.fn().mockResolvedValue(TYPED_PNG);
    trimPng = vi.fn().mockResolvedValue(TRIMMED_PNG);
    login = vi.fn().mockResolvedValue(undefined);
    refresh = vi.fn();
    realtime = new Subject<RealtimeEvent>();

    await TestBed.configureTestingModule({
      imports: [SignatureSign, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        {
          provide: SignatureService,
          useValue: { getRequest, getDocument, view, sign, decline, downloadArtifact: vi.fn() },
        },
        { provide: PdfRenderer, useValue: { open } },
        { provide: SignatureInk, useValue: { typedPng, trimPng, createPad: vi.fn() } },
        { provide: SignatureStore, useValue: { refresh } },
        { provide: RealtimeService, useValue: { live: signal(false), on: () => realtime } },
        { provide: Keycloak, useValue: { login } },
        { provide: SnackbarNotification, useValue: { openSnackBar: vi.fn() } },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  it('keeps « Signer » disabled until consent, every required field and a signature', async () => {
    await create();
    expect(fixture.componentInstance.phase()).toBe('ready');
    expect(signButton()?.disabled).toBe(true);

    type('signature-sign__typed-name', 'Alice Dupont');
    expect(signButton()?.disabled).toBe(true);

    type('signature-sign__field--place', 'Liège'); // required TEXT
    expect(signButton()?.disabled).toBe(true);

    tickConsent();
    expect(signButton()?.disabled).toBe(false);

    // A blanked required field closes it again; so does an empty name.
    type('signature-sign__field--place', '  ');
    expect(signButton()?.disabled).toBe(true);
    type('signature-sign__field--place', 'Liège');
    type('signature-sign__typed-name', '');
    expect(signButton()?.disabled).toBe(true);
  });

  it('shows the exact consent statement the annexe sent', async () => {
    await create();
    expect(byTestId('signature-sign__consent-text')?.textContent?.trim()).toBe(
      requestDetail().my_slots[0].consent_text,
    );
  });

  it('renders the bytes it hashed, and sends that hash on view and on sign', async () => {
    await create();
    expect(open).toHaveBeenCalledWith(displayed);
    expect(view).toHaveBeenCalledWith(REQUEST_ID, SIGNER_ID, DISPLAYED_SHA);

    await prepare();
    signButton()?.click();
    await settle();

    const body = sign.mock.calls[0][2] as SignIn;
    expect(sign.mock.calls[0][0]).toBe(REQUEST_ID);
    expect(sign.mock.calls[0][1]).toBe(SIGNER_ID);
    expect(body).toEqual({
      method: 'TYPED',
      typed_name: 'Alice Dupont',
      image_png: TYPED_PNG,
      // CHECKBOX as a string, no DATE: the server writes the signing date.
      fields: { place: 'Liège', accept: 'false' },
      consent_version: 'v1',
      consent_accepted: true,
      document_sha256: DISPLAYED_SHA,
    });
    expect(typedPng).toHaveBeenCalledWith('Alice Dupont');
    expect(fixture.componentInstance.phase()).toBe('sealing');
    expect(refresh).toHaveBeenCalled();
  });

  it('sends a drawing cut to its ink, so the stamp does not shrink it', async () => {
    await create();
    await prepare();
    fixture.componentInstance.method.set('DRAWN');
    fixture.componentInstance.drawnPng.set(DRAWN_PNG);
    fixture.detectChanges();
    signButton()?.click();
    await settle();

    expect(trimPng).toHaveBeenCalledWith(DRAWN_PNG);
    const body = sign.mock.calls[0][2] as SignIn;
    expect(body.method).toBe('DRAWN');
    expect(body.typed_name).toBeNull();
    expect(body.image_png).toBe(TRIMMED_PNG);
    expect(typedPng).not.toHaveBeenCalled();
  });

  it('on a step-up (401, 2510) keeps the draft and asks Keycloak for a fresh login, back here', async () => {
    sign.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 401,
            error: { data: 'Reconnectez-vous', error_code: 2510 },
          }),
      ),
    );
    await create();
    await prepare();
    signButton()?.click();
    await settle();

    expect(loadDraft(SIGNER_ID)).toEqual({
      method: 'TYPED',
      typedName: 'Alice Dupont',
      imagePng: TYPED_PNG,
      fields: { place: 'Liège', accept: false },
      consent: true,
    });
    expect(login).toHaveBeenCalledWith({
      redirectUri: `${window.location.origin}/signatures/${REQUEST_ID}/signers/${SIGNER_ID}?resume=1`,
      prompt: 'login',
      maxAge: 0,
    });
    expect(fixture.componentInstance.phase()).toBe('ready');
  });

  it('restores the draft after the login, says so, and drops it once the sign is accepted', async () => {
    sessionStorage.setItem(
      draftKey(SIGNER_ID),
      JSON.stringify({
        method: 'TYPED',
        typedName: 'Alice Dupont',
        imagePng: TYPED_PNG,
        fields: { place: 'Liège', accept: true },
        consent: true,
      }),
    );
    await create();

    expect(byTestId('signature-sign__message--restored')).not.toBeNull();
    expect((byTestId('signature-sign__typed-name') as HTMLInputElement).value).toBe('Alice Dupont');
    expect((byTestId('signature-sign__field--place') as HTMLInputElement).value).toBe('Liège');
    expect(signButton()?.disabled).toBe(false);

    signButton()?.click();
    await settle();
    expect((sign.mock.calls[0][2] as SignIn).fields).toEqual({ place: 'Liège', accept: 'true' });
    expect(sessionStorage.getItem(draftKey(SIGNER_ID))).toBeNull();
    expect(byTestId('signature-sign__message--restored')).toBeNull();
  });

  it('after the 202, polls every 2 s and stops as soon as the slot is SIGNED', async () => {
    await create();
    await prepare();
    vi.useFakeTimers();
    signButton()?.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(fixture.componentInstance.phase()).toBe('sealing');
    const before = getRequest.mock.calls.length;

    getRequest.mockReturnValue(of({ data: requestDetail({}, { status: 'SIGNING' }) }));
    await vi.advanceTimersByTimeAsync(SEAL_POLL_MS);
    expect(getRequest.mock.calls.length).toBe(before + 1);
    expect(getRequest).toHaveBeenLastCalledWith(REQUEST_ID, true);
    expect(fixture.componentInstance.phase()).toBe('sealing');

    getRequest.mockReturnValue(of({ data: requestDetail({}, { status: 'SIGNED' }) }));
    await vi.advanceTimersByTimeAsync(SEAL_POLL_MS);
    expect(fixture.componentInstance.phase()).toBe('signed');
    const settled = getRequest.mock.calls.length;

    await vi.advanceTimersByTimeAsync(SEAL_POLL_MS * 10);
    expect(getRequest.mock.calls.length).toBe(settled);
    fixture.detectChanges();
    expect(byTestId('signature-sign__status')?.getAttribute('data-phase')).toBe('signed');
  });

  it('asks at once when the realtime says this signer is sealed', async () => {
    await create();
    await prepare();
    signButton()?.click();
    await settle();
    const before = getRequest.mock.calls.length;

    getRequest.mockReturnValue(of({ data: requestDetail({}, { status: 'SIGNED' }) }));
    realtime.next({
      v: 1,
      id: 'x',
      topic: REALTIME_TOPICS.SIGNATURE_SIGNED,
      at: '',
      scope: { community_id: 10 },
      ref: { kind: 'signature_signer', id: 'someone-else' },
      hint: { status: 'success' },
    });
    expect(getRequest.mock.calls.length).toBe(before);

    realtime.next({
      v: 1,
      id: 'y',
      topic: REALTIME_TOPICS.SIGNATURE_SIGNED,
      at: '',
      scope: { community_id: 10 },
      ref: { kind: 'signature_signer', id: SIGNER_ID },
      hint: { status: 'success' },
    });
    expect(getRequest.mock.calls.length).toBe(before + 1);
    expect(fixture.componentInstance.phase()).toBe('signed');
  });

  it('stops polling after 2 minutes, calmly', async () => {
    await create();
    await prepare();
    vi.useFakeTimers();
    getRequest.mockReturnValue(of({ data: requestDetail({}, { status: 'SIGNING' }) }));
    signButton()?.click();
    await vi.advanceTimersByTimeAsync(SEAL_TIMEOUT_MS);
    expect(fixture.componentInstance.phase()).toBe('slow');
    const calls = getRequest.mock.calls.length;
    await vi.advanceTimersByTimeAsync(SEAL_POLL_MS * 5);
    expect(getRequest.mock.calls.length).toBe(calls);
  });

  it('offers a reload when the document changed under the signer (409, 2511)', async () => {
    sign.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { data: 'Changé', error_code: 2511 } }),
      ),
    );
    await create();
    await prepare();
    signButton()?.click();
    await settle();
    expect(fixture.componentInstance.phase()).toBe('stale');
    expect(byTestId('signature-sign__button--reload')).not.toBeNull();
    expect(login).not.toHaveBeenCalled();
  });

  it('shows a waiting slot read-only, records no view and offers no Sign', async () => {
    await create(requestDetail({}, { status: 'WAITING' }));
    expect(fixture.componentInstance.phase()).toBe('waiting');
    expect(view).not.toHaveBeenCalled();
    expect(signButton()).toBeNull();
  });

  it('needs a reason to decline', async () => {
    await create();
    byTestId('signature-sign__button--decline')?.querySelector('button')?.click();
    fixture.detectChanges();
    const confirm = (): HTMLButtonElement | null =>
      document.querySelector<HTMLButtonElement>(
        '[data-testid="signature-sign__button--decline-confirm"] button',
      );
    expect(confirm()?.disabled).toBe(true);

    const reason = document.querySelector(
      '[data-testid="signature-sign__decline-reason"]',
    ) as HTMLTextAreaElement;
    reason.value = 'Le montant est faux';
    reason.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    confirm()?.click();
    await settle();

    expect(decline).toHaveBeenCalledWith(REQUEST_ID, SIGNER_ID, 'Le montant est faux');
    expect(fixture.componentInstance.phase()).toBe('declined');
  });
});
