import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, from, map, switchMap, tap, throwError } from 'rxjs';

import { environments } from '../../../environments/environments';
import { ApiResponse } from '../../core/dtos/api.response';
import { defineTTL } from '../../core/services/cache/cache.helper';
import { UserContextService } from '../../core/services/authorization/authorization.service';
import {
  CommunitySignatureQuery,
  CommunitySignatureRequests,
  MySignatureRow,
  SignIn,
  SignatureArtifact,
  SignatureDocument,
  SignatureRequestDetail,
  SignatureTimeline,
} from '../dtos/signature.dtos';
import { ServiceBase } from './service.base';

/** Every read is cached under this prefix, and every action drops all of it. */
const CACHE_PREFIX = 'signature';

const ARTIFACT_NAMES: Record<SignatureArtifact, string> = {
  final: 'signed.pdf',
  'evidence-pdf': 'evidence.pdf',
  'evidence-json': 'evidence.json',
};

/**
 * The SHA-256 of the bytes, lowercase hex: what the signer saw, as the
 * annexe records it on view and on sign (WYSIWYS). `crypto.subtle` needs a
 * secure context, which https and localhost both are.
 */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fileNameFrom(response: HttpResponse<unknown>, fallback: string): string {
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i.exec(disposition);
  return match?.[1] ? decodeURIComponent(match[1]) : fallback;
}

/**
 * HTTP client for the signature annexe. The signer's reads are cross-community
 * (`/me/requests`, a request by id); only the follow-up list is scoped to the
 * active community, by the usual X-Community-ID interceptor, so only its cache
 * key carries the community.
 *
 * Files (the document to sign, the artifacts) are never cached: the document's
 * hash is computed here, in the browser, over the very bytes the screen renders.
 */
@Injectable({ providedIn: 'root' })
export class SignatureService extends ServiceBase {
  private readonly apiAddress: string;
  private readonly userContext = inject(UserContextService);

  constructor() {
    super();
    this.apiAddress = environments.apiUrl + '/signature';
  }

  private key(...parts: (string | number)[]): string {
    return [CACHE_PREFIX, ...parts].join(':');
  }

  private invalidating<T>(request$: Observable<T>): Observable<T> {
    return request$.pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  /** Drop every cached read (a realtime hint, a refresh). */
  invalidate(): void {
    this.cache.invalidate(CACHE_PREFIX);
  }

  // ---- the signer ------------------------------------------------------------

  /**
   * Every slot the user may sign, in every community; `status` narrows it.
   * `fresh` skips the cache (a realtime hint, the periodic read).
   */
  myRequests(
    status?: 'pending' | 'done',
    fresh = false,
  ): Observable<ApiResponse<MySignatureRow[]>> {
    const key = this.key('me', status ?? 'all');
    if (fresh) this.cache.invalidate(key);
    return this.cachedGet<ApiResponse<MySignatureRow[]>>(
      key,
      `${this.apiAddress}/me/requests`,
      status ? { status } : undefined,
      defineTTL(1),
    );
  }

  /** A request, its signers and the caller's own slots. `fresh` skips the cache (polling). */
  getRequest(id: string, fresh = false): Observable<ApiResponse<SignatureRequestDetail>> {
    const key = this.key('request', id);
    if (fresh) this.cache.invalidate(key);
    return this.cachedGet<ApiResponse<SignatureRequestDetail>>(
      key,
      `${this.apiAddress}/requests/${id}`,
      undefined,
      defineTTL(1),
    );
  }

  /**
   * The current revision's bytes and their SHA-256, computed here. The screen
   * renders exactly these bytes and sends exactly this hash back.
   */
  getDocument(id: string): Observable<SignatureDocument> {
    return this.http
      .get(`${this.apiAddress}/requests/${id}/document`, {
        observe: 'response',
        responseType: 'arraybuffer',
      })
      .pipe(
        catchError((error: HttpErrorResponse) => this.arrayBufferErrorHandler(error)),
        switchMap((response) => {
          const bytes = response.body ?? new ArrayBuffer(0);
          const revision = Number(response.headers.get('X-Document-Revision'));
          return from(sha256Hex(bytes)).pipe(
            map((sha256) => ({
              bytes,
              sha256,
              revision: Number.isInteger(revision) && revision > 0 ? revision : null,
            })),
          );
        }),
      );
  }

  /** Records that the signer saw this revision (its hash). 204. */
  view(id: string, signerId: string, documentSha256: string): Observable<unknown> {
    return this.invalidating(
      this.http.post(`${this.apiAddress}/requests/${id}/signers/${signerId}/view`, {
        document_sha256: documentSha256,
      }),
    );
  }

  /** 202 `{status: 'signing'}`; 401 (2510) asks for a fresh login first. */
  sign(id: string, signerId: string, body: SignIn): Observable<ApiResponse<{ status: string }>> {
    return this.invalidating(
      this.http.post<ApiResponse<{ status: string }>>(
        `${this.apiAddress}/requests/${id}/signers/${signerId}/sign`,
        body,
      ),
    );
  }

  /** 204. The reason goes to the requester as is. */
  decline(id: string, signerId: string, reason: string): Observable<unknown> {
    return this.invalidating(
      this.http.post(`${this.apiAddress}/requests/${id}/signers/${signerId}/decline`, { reason }),
    );
  }

  /** The signed PDF or the evidence, once the request is COMPLETED. Never cached. */
  downloadArtifact(
    id: string,
    kind: SignatureArtifact,
  ): Observable<{ blob: Blob; filename: string }> {
    return this.http
      .get(`${this.apiAddress}/requests/${id}/artifacts/${kind}`, {
        observe: 'response',
        responseType: 'blob',
      })
      .pipe(
        map((response) => ({
          blob: response.body as Blob,
          filename: fileNameFrom(response, ARTIFACT_NAMES[kind]),
        })),
        catchError((error: HttpErrorResponse) => this.blobErrorHandler(error)),
      );
  }

  // ---- the follow-up (managers and admins of the request's community) --------

  /** The event log in order, and the hash chain's verdict. `fresh` skips the cache. */
  getEvents(id: string, fresh = false): Observable<ApiResponse<SignatureTimeline>> {
    const key = this.key('request', id, 'events');
    if (fresh) this.cache.invalidate(key);
    return this.cachedGet<ApiResponse<SignatureTimeline>>(
      key,
      `${this.apiAddress}/requests/${id}/events`,
      undefined,
      defineTTL(1),
    );
  }

  /** Re-notifies the pending signers. 409 (2530) within 24 h of the last reminder. */
  remind(id: string): Observable<ApiResponse<{ reminded: number }>> {
    return this.invalidating(
      this.http.post<ApiResponse<{ reminded: number }>>(
        `${this.apiAddress}/requests/${id}/remind`,
        {},
      ),
    );
  }

  /** 204. The reason is optional. */
  cancel(id: string, reason: string | null): Observable<unknown> {
    return this.invalidating(
      this.http.post(`${this.apiAddress}/requests/${id}/cancel`, { reason: reason || null }),
    );
  }

  /** The active community's requests (MANAGER minimum; 403 1003 when the module is off). */
  listCommunityRequests(
    query: CommunitySignatureQuery = {},
  ): Observable<ApiResponse<CommunitySignatureRequests>> {
    const community = this.userContext.activeCommunityId() ?? 'none';
    const entries = Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .sort(([a], [b]) => a.localeCompare(b));
    const params = Object.fromEntries(entries) as Record<string, string | number>;
    return this.cachedGet<ApiResponse<CommunitySignatureRequests>>(
      this.key('community', community, JSON.stringify(params)),
      `${this.apiAddress}/admin/requests`,
      params,
      defineTTL(1),
    );
  }

  /** `arraybuffer` errors carry the JSON envelope as bytes: decode it like `blobErrorHandler`. */
  private arrayBufferErrorHandler(error: HttpErrorResponse): Observable<never> {
    if (error.error instanceof ArrayBuffer) {
      try {
        const parsed: unknown = JSON.parse(new TextDecoder().decode(error.error));
        return throwError(
          () =>
            new HttpErrorResponse({
              error: parsed as Record<string, unknown>,
              headers: error.headers,
              status: error.status,
              statusText: error.statusText,
              url: error.url ?? undefined,
            }),
        );
      } catch {
        /* not JSON: rethrow the original error */
      }
    }
    return throwError(() => error);
  }
}
