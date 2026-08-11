import { HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ApiResponse, ApiResponsePaginated } from '../../core/dtos/api.response';
import { extensionForMimeType } from '../../features/administrative_document/administrative-document-format';
import { defineTTL } from '../../core/services/cache/cache.helper';
import { UserContextService } from '../../core/services/authorization/authorization.service';
import { COMMUNITY_ID } from '../../core/interceptors/community.context.inteceptor';
import { environments } from '../../../environments/environments';
import {
  AcknowledgeIn,
  DeadlineOut,
  DeadlineQuery,
  DeadlineResolveIn,
  DeadlineSweepOut,
  DocumentDetailOut,
  DocumentIn,
  DocumentOut,
  DocumentVersionOut,
  DossierDetailOut,
  DossierIn,
  DossierOut,
  DossierPatch,
  DossierQuery,
  GenerateAccepted,
  GenerateIn,
  MarkSentIn,
  MyFilingOut,
  PrefillOut,
  RenderStatusOut,
  RollbackIn,
  SharingOperationOut,
  StatusEventOut,
  TemplateOut,
  TransitionIn,
} from '../dtos/administrative-document.dtos';
import { ServiceBase } from './service.base';

const CACHE_PREFIX = 'administrative-document';

/**
 * HTTP client for the administrative-document annex.
 *
 * The KrakenD gateway prepends `/administrative-document` and injects
 * x-user-id / x-user-orgs from the JWT; the community-context and bearer
 * interceptors add X-Community-ID and auth.
 *
 * Reads are cached under `administrative-document:<communityId>:*` and every
 * mutation invalidates the whole prefix — the dossier/document/deadline/journal
 * graph is too interconnected for finer-grained invalidation to be safe (a
 * single mark-sent changes the dossier payload, derives deadlines and appends a
 * journal entry).
 */
@Injectable({ providedIn: 'root' })
export class AdministrativeDocumentService extends ServiceBase {
  private readonly apiAddress: string;
  private readonly userContext = inject(UserContextService);

  constructor() {
    super();
    this.apiAddress = environments.apiUrl + '/administrative-document';
  }

  /**
   * Build a cache key scoped to the ACTIVE COMMUNITY.
   *
   * `UserContextService.switchCommunity()` invalidates only a hardcoded list of
   * prefixes that does not include this feature, so the community id must live
   * inside the key — otherwise switching community would serve the previous
   * community's dossiers. A switch then simply misses the cache and refetches.
   */
  private key(...parts: (string | number)[]): string {
    const community = this.userContext.activeCommunityId() ?? 'none';
    return [CACHE_PREFIX, community, ...parts].join(':');
  }

  /**
   * Order-independent serialisation of a query object, so two logically equal
   * queries share one cache entry (a raw JSON.stringify is key-order sensitive).
   */
  private queryKey(query: object): string {
    const entries = Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== null)
      .sort(([a], [b]) => a.localeCompare(b));
    return JSON.stringify(Object.fromEntries(entries));
  }

  // ---- sharing operations ------------------------------------------------

  /** The operations a dossier may be filed for. Near-static CRM mirror. */
  listSharingOperations(): Observable<ApiResponse<SharingOperationOut[]>> {
    return this.cachedGet<ApiResponse<SharingOperationOut[]>>(
      this.key('sharing-operations'),
      `${this.apiAddress}/sharing-operations`,
      undefined,
      defineTTL(30),
    );
  }

  // ---- filings about me (member-reachable) --------------------------------

  /**
   * Filings of record that name the caller, reduced to their own rows.
   *
   * The only read in this annex a member may make. The row filtering happens
   * server-side, so this response contains no other member's data — a client
   * filter would leave the whole community in the network log.
   */
  listMyFilings(limit = 50): Observable<ApiResponse<MyFilingOut[]>> {
    return this.cachedGet<ApiResponse<MyFilingOut[]>>(
      this.key('filings-mine', limit),
      `${this.apiAddress}/filings/mine`,
      { limit },
      defineTTL(5),
    );
  }

  /**
   * The same read, for an EXPLICIT community.
   *
   * The user dashboard shows filings across every community the member belongs
   * to, and this annexe resolves its tenant from `X-Community-ID` — so each
   * community is asked in turn, with the header pinned by the `COMMUNITY_ID`
   * context token. The cache key embeds the target id rather than the active
   * one, which `key()` would otherwise use.
   */
  listMyFilingsForCommunity(
    communityId: string,
    limit = 50,
  ): Observable<ApiResponse<MyFilingOut[]>> {
    return this.cachedGet<ApiResponse<MyFilingOut[]>>(
      [CACHE_PREFIX, communityId, 'filings-mine', limit].join(':'),
      `${this.apiAddress}/filings/mine`,
      { limit },
      defineTTL(5),
      { context: new HttpContext().set(COMMUNITY_ID, communityId) },
    );
  }

  // ---- templates ---------------------------------------------------------

  /** Registered document templates — drives the document-type picker. */
  listTemplates(): Observable<ApiResponse<TemplateOut[]>> {
    return this.cachedGet<ApiResponse<TemplateOut[]>>(
      this.key('templates'),
      `${this.apiAddress}/templates`,
      undefined,
      defineTTL(30),
    );
  }

  // ---- dossiers ----------------------------------------------------------

  listDossiers(query: DossierQuery): Observable<ApiResponsePaginated<DossierOut[]>> {
    return this.cachedGet<ApiResponsePaginated<DossierOut[]>>(
      this.key('dossiers', this.queryKey(query)),
      `${this.apiAddress}/dossiers`,
      query,
    );
  }

  /** Detail payload: the dossier plus its documents and deadlines in one call. */
  getDossier(id: number): Observable<ApiResponse<DossierDetailOut>> {
    return this.cachedGet<ApiResponse<DossierDetailOut>>(
      this.key('dossier', id),
      `${this.apiAddress}/dossiers/${id}`,
      undefined,
      defineTTL(1),
    );
  }

  /** The immutable journal for the dossier and every document inside it. */
  getDossierTimeline(id: number): Observable<ApiResponse<StatusEventOut[]>> {
    return this.cachedGet<ApiResponse<StatusEventOut[]>>(
      this.key('dossier-timeline', id),
      `${this.apiAddress}/dossiers/${id}/timeline`,
      undefined,
      defineTTL(1),
    );
  }

  listDossierDeadlines(id: number): Observable<ApiResponse<DeadlineOut[]>> {
    return this.cachedGet<ApiResponse<DeadlineOut[]>>(
      this.key('dossier-deadlines', id),
      `${this.apiAddress}/dossiers/${id}/deadlines`,
      undefined,
      defineTTL(1),
    );
  }

  listDossierDocuments(id: number): Observable<ApiResponse<DocumentOut[]>> {
    return this.cachedGet<ApiResponse<DocumentOut[]>>(
      this.key('dossier-documents', id),
      `${this.apiAddress}/dossiers/${id}/documents`,
      undefined,
      defineTTL(1),
    );
  }

  createDossier(body: DossierIn): Observable<ApiResponse<DossierOut>> {
    return this.http
      .post<ApiResponse<DossierOut>>(`${this.apiAddress}/dossiers`, body)
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  updateDossier(id: number, body: DossierPatch): Observable<ApiResponse<DossierOut>> {
    return this.http
      .patch<ApiResponse<DossierOut>>(`${this.apiAddress}/dossiers/${id}`, body)
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  transitionDossier(id: number, body: TransitionIn): Observable<ApiResponse<DossierOut>> {
    return this.http
      .post<ApiResponse<DossierOut>>(`${this.apiAddress}/dossiers/${id}/transition`, body)
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  rollbackDossier(id: number, body: RollbackIn): Observable<ApiResponse<DossierOut>> {
    return this.http
      .post<ApiResponse<DossierOut>>(`${this.apiAddress}/dossiers/${id}/rollback`, body)
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  // ---- documents ---------------------------------------------------------

  getDocument(id: number): Observable<ApiResponse<DocumentDetailOut>> {
    return this.cachedGet<ApiResponse<DocumentDetailOut>>(
      this.key('document', id),
      `${this.apiAddress}/documents/${id}`,
      undefined,
      defineTTL(1),
    );
  }

  createDocument(dossierId: number, body: DocumentIn): Observable<ApiResponse<DocumentOut>> {
    return this.http
      .post<ApiResponse<DocumentOut>>(`${this.apiAddress}/dossiers/${dossierId}/documents`, body)
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  /**
   * Store an uploaded file as the document's next immutable version.
   *
   * No Content-Type header: the browser must generate the multipart boundary.
   * Rejected with 409 (2333) unless the document is still draft or ready.
   */
  uploadVersion(documentId: number, file: File): Observable<ApiResponse<DocumentVersionOut>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http
      .post<
        ApiResponse<DocumentVersionOut>
      >(`${this.apiAddress}/documents/${documentId}/versions`, formData)
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  /** Stream a stored version back exactly as it was filed. Never cached. */
  downloadVersion(
    documentId: number,
    versionId: number,
  ): Observable<{ blob: Blob; filename: string }> {
    return this.http
      .get(`${this.apiAddress}/documents/${documentId}/versions/${versionId}/file`, {
        observe: 'response',
        responseType: 'blob',
      })
      .pipe(
        map((response) => {
          const blob = response.body as Blob;
          const disposition = response.headers.get('Content-Disposition');
          let filename = '';
          if (disposition) {
            const match = /filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i.exec(disposition);
            if (match?.[1]) {
              filename = decodeURIComponent(match[1]);
            }
          }
          // The backend always sends a name with an extension, so this only runs
          // if the header is missing or unparseable. Even then the file must be
          // openable: a download the OS cannot identify looks broken to the user.
          if (!filename) {
            filename = `document-${documentId}-v${versionId}${extensionForMimeType(blob.type)}`;
          }
          return { blob, filename };
        }),
        // A blob request's error body arrives as a Blob, not JSON — re-parse it
        // so the caller can still read the backend's message.
        catchError((error: HttpErrorResponse) => this.blobErrorHandler(error)),
      );
  }

  // ---- generation --------------------------------------------------------

  /**
   * Build the render payload from the CRM WITHOUT persisting it.
   *
   * Deliberately uncached: this is what the review form starts from, and serving
   * a stale participant list would mean filing stale data. Cheap enough — it is
   * only fetched when the dialog opens.
   */
  prefillDocument(documentId: number): Observable<ApiResponse<PrefillOut>> {
    return this.http.get<ApiResponse<PrefillOut>>(
      `${this.apiAddress}/documents/${documentId}/prefill`,
    );
  }

  /**
   * Submit the reviewed payload and hand the render off.
   *
   * Returns as soon as the request is queued; the artifact arrives
   * asynchronously, so poll `renderStatus` until a version lands. 409 (2364)
   * means a render is already in flight for this document.
   */
  generateDocument(
    documentId: number,
    body: GenerateIn,
  ): Observable<ApiResponse<GenerateAccepted>> {
    return this.http
      .post<
        ApiResponse<GenerateAccepted>
      >(`${this.apiAddress}/documents/${documentId}/generate`, body)
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  /**
   * Poll target. NEVER cached: the whole point is to observe a change, and the
   * cached `getDocument` would serve the pre-render state back for its whole TTL.
   */
  renderStatus(documentId: number): Observable<ApiResponse<RenderStatusOut>> {
    return this.http.get<ApiResponse<RenderStatusOut>>(
      `${this.apiAddress}/documents/${documentId}/render-status`,
    );
  }

  transitionDocument(id: number, body: TransitionIn): Observable<ApiResponse<DocumentOut>> {
    return this.http
      .post<ApiResponse<DocumentOut>>(`${this.apiAddress}/documents/${id}/transition`, body)
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  markDocumentReady(id: number): Observable<ApiResponse<DocumentOut>> {
    return this.http
      .post<ApiResponse<DocumentOut>>(`${this.apiAddress}/documents/${id}/mark-ready`, {})
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  markDocumentSent(id: number, body: MarkSentIn): Observable<ApiResponse<DocumentOut>> {
    return this.http
      .post<ApiResponse<DocumentOut>>(`${this.apiAddress}/documents/${id}/mark-sent`, body)
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  acknowledgeDocument(id: number, body: AcknowledgeIn): Observable<ApiResponse<DocumentOut>> {
    return this.http
      .post<ApiResponse<DocumentOut>>(`${this.apiAddress}/documents/${id}/acknowledge`, body)
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  rollbackDocument(id: number, body: RollbackIn): Observable<ApiResponse<DocumentOut>> {
    return this.http
      .post<ApiResponse<DocumentOut>>(`${this.apiAddress}/documents/${id}/rollback`, body)
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  // ---- deadlines ---------------------------------------------------------

  listDeadlines(query: DeadlineQuery): Observable<ApiResponsePaginated<DeadlineOut[]>> {
    return this.cachedGet<ApiResponsePaginated<DeadlineOut[]>>(
      this.key('deadlines', this.queryKey(query)),
      `${this.apiAddress}/deadlines`,
      query,
    );
  }

  resolveDeadline(id: number, body: DeadlineResolveIn): Observable<ApiResponse<DeadlineOut>> {
    return this.http
      .post<ApiResponse<DeadlineOut>>(`${this.apiAddress}/deadlines/${id}`, body)
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  /** Flip past-due deadlines to missed and roll recurring ones. */
  deadlineSweep(): Observable<ApiResponse<DeadlineSweepOut>> {
    return this.http
      .post<ApiResponse<DeadlineSweepOut>>(`${this.apiAddress}/maintenance/deadline-sweep`, {})
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  /** Escape hatch for components that need a guaranteed-fresh read. */
  invalidate(): void {
    this.cache.invalidate(CACHE_PREFIX);
  }
}
