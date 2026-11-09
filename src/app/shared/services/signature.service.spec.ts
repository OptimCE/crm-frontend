import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';

import { environments } from '../../../environments/environments';
import { UserContextService } from '../../core/services/authorization/authorization.service';
import { CacheService } from '../../core/services/cache/cache.service';
import { SignIn, SignatureDocument } from '../dtos/signature.dtos';
import { SignatureService, sha256Hex } from './signature.service';

const API = `${environments.apiUrl}/signature`;
/** SHA-256("abc"), the FIPS 180-2 test vector. */
const ABC_SHA256 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

function bytesOf(text: string): ArrayBuffer {
  const encoded = new TextEncoder().encode(text);
  const buffer = new ArrayBuffer(encoded.byteLength);
  new Uint8Array(buffer).set(encoded);
  return buffer;
}

describe('SignatureService', () => {
  let service: SignatureService;
  let http: HttpTestingController;
  let cache: CacheService;
  const activeCommunityId = signal<string | null>('org-a');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: UserContextService, useValue: { activeCommunityId } },
      ],
    });
    service = TestBed.inject(SignatureService);
    http = TestBed.inject(HttpTestingController);
    cache = TestBed.inject(CacheService);
  });

  afterEach(() => {
    http.match(() => true);
    http.verify();
    TestBed.resetTestingModule();
  });

  it('hashes bytes as lowercase hex SHA-256', async () => {
    expect(await sha256Hex(bytesOf('abc'))).toBe(ABC_SHA256);
  });

  it('reads my requests, every community, cached until asked fresh', () => {
    service.myRequests().subscribe();
    const request = http.expectOne((r) => r.url === `${API}/me/requests`);
    expect(request.request.params.has('status')).toBe(false);
    request.flush({ data: [] });

    service.myRequests().subscribe();
    http.expectNone(`${API}/me/requests`);

    service.myRequests(undefined, true).subscribe();
    http.expectOne(`${API}/me/requests`).flush({ data: [] });
  });

  it('narrows my requests by status', () => {
    service.myRequests('pending').subscribe();
    const request = http.expectOne((r) => r.url === `${API}/me/requests`);
    expect(request.request.params.get('status')).toBe('pending');
    // Answered, or cachedGet's 10 s timeout retries it after the TestBed is gone (NG0205).
    request.flush({ data: [] });
  });

  it('reads a request, and again when asked fresh (the seal poll)', () => {
    service.getRequest('r1').subscribe();
    http.expectOne(`${API}/requests/r1`).flush({ data: {} });
    service.getRequest('r1').subscribe();
    http.expectNone(`${API}/requests/r1`);
    service.getRequest('r1', true).subscribe();
    http.expectOne(`${API}/requests/r1`).flush({ data: {} });
  });

  it('fetches the document as bytes and hashes THOSE bytes in the browser', async () => {
    const result = firstValueFrom(service.getDocument('r1'));
    const request = http.expectOne(`${API}/requests/r1/document`);
    expect(request.request.responseType).toBe('arraybuffer');
    // The server's own header says something else: the browser's hash wins.
    request.flush(bytesOf('abc'), {
      headers: { 'X-Document-Revision': '2', 'X-Document-SHA256': 'f'.repeat(64) },
    });
    const document: SignatureDocument = await result;
    expect(document.sha256).toBe(ABC_SHA256);
    expect(document.revision).toBe(2);
    expect(new TextDecoder().decode(document.bytes)).toBe('abc');
  });

  it('decodes the JSON envelope of a failed document read', async () => {
    const result = firstValueFrom(service.getDocument('r1')).catch((error: unknown) => error);
    http
      .expectOne(`${API}/requests/r1/document`)
      .flush(bytesOf(JSON.stringify({ data: 'Introuvable', error_code: 2501 })), {
        status: 404,
        statusText: 'Not Found',
      });
    const error = (await result) as { status: number; error: { error_code: number } };
    expect(error.status).toBe(404);
    expect(error.error.error_code).toBe(2501);
  });

  it('records the view with the hash of what is displayed', () => {
    service.view('r1', 's1', ABC_SHA256).subscribe();
    const request = http.expectOne(`${API}/requests/r1/signers/s1/view`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ document_sha256: ABC_SHA256 });
  });

  it('signs, then drops every cached read', () => {
    const invalidate = vi.spyOn(cache, 'invalidate');
    const body: SignIn = {
      method: 'TYPED',
      typed_name: 'Alice Dupont',
      image_png: 'data:image/png;base64,AAAA',
      fields: { initials: 'AD' },
      consent_version: 'v1',
      consent_accepted: true,
      document_sha256: ABC_SHA256,
    };
    service.sign('r1', 's1', body).subscribe();
    const request = http.expectOne(`${API}/requests/r1/signers/s1/sign`);
    expect(request.request.body).toEqual(body);
    request.flush({ data: { status: 'signing' } }, { status: 202, statusText: 'Accepted' });
    expect(invalidate).toHaveBeenCalledWith('signature');
  });

  it('declines with the reason, then invalidates', () => {
    const invalidate = vi.spyOn(cache, 'invalidate');
    service.decline('r1', 's1', 'Mauvais montant').subscribe();
    const request = http.expectOne(`${API}/requests/r1/signers/s1/decline`);
    expect(request.request.body).toEqual({ reason: 'Mauvais montant' });
    request.flush(null, { status: 204, statusText: 'No Content' });
    expect(invalidate).toHaveBeenCalledWith('signature');
  });

  it('reminds and cancels (an empty reason is no reason), each invalidating', () => {
    const invalidate = vi.spyOn(cache, 'invalidate');
    service.remind('r1').subscribe();
    http.expectOne(`${API}/requests/r1/remind`).flush({ data: { reminded: 2 } });
    service.cancel('r1', '').subscribe();
    const cancel = http.expectOne(`${API}/requests/r1/cancel`);
    expect(cancel.request.body).toEqual({ reason: null });
    cancel.flush(null, { status: 204, statusText: 'No Content' });
    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  it('downloads an artifact under its served name', async () => {
    const result = firstValueFrom(service.downloadArtifact('r1', 'evidence-pdf'));
    http.expectOne(`${API}/requests/r1/artifacts/evidence-pdf`).flush(new Blob(['%PDF']), {
      headers: { 'Content-Disposition': 'attachment; filename="evidence-1b4e28ba.pdf"' },
    });
    expect((await result).filename).toBe('evidence-1b4e28ba.pdf');
  });

  it('lists the active community’s requests, cached per community and query', () => {
    service.listCommunityRequests({ status: 'OPEN', limit: 20, offset: 0 }).subscribe();
    const request = http.expectOne((r) => r.url === `${API}/admin/requests`);
    expect(request.request.params.get('status')).toBe('OPEN');
    expect(request.request.params.get('limit')).toBe('20');
    request.flush({ data: { total: 0, items: [] } });

    // Same query, other key order: one cache entry.
    service.listCommunityRequests({ offset: 0, limit: 20, status: 'OPEN' }).subscribe();
    http.expectNone((r) => r.url === `${API}/admin/requests`);

    // Another community: another entry.
    activeCommunityId.set('org-b');
    service.listCommunityRequests({ status: 'OPEN', limit: 20, offset: 0 }).subscribe();
    http
      .expectOne((r) => r.url === `${API}/admin/requests`)
      .flush({ data: { total: 0, items: [] } });
    activeCommunityId.set('org-a');
  });

  it('reads the timeline', () => {
    service.getEvents('r1').subscribe();
    http.expectOne(`${API}/requests/r1/events`).flush({ data: { chain: {}, events: [] } });
  });
});
