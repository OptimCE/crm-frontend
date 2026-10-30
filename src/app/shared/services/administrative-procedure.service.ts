import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ApiResponse, ApiResponsePaginated } from '../../core/dtos/api.response';
import { defineTTL } from '../../core/services/cache/cache.helper';
import { UserContextService } from '../../core/services/authorization/authorization.service';
import { environments } from '../../../environments/environments';
import {
  BaselineConfirmIn,
  BaselineOut,
  ChangeExcludeIn,
  CorrespondenceIn,
  CorrespondenceProposalOut,
  EntrySheetOut,
  FinalizeOut,
  InboxOut,
  InboxQuery,
  ProcedureCreateIn,
  ProcedureDeadlineOut,
  ProcedureDeadlineQuery,
  ProcedureDefinitionOut,
  ProcedureDetailOut,
  ProcedureItemOut,
  ProcedureListQuery,
  ProcedureModuleStatusOut,
  ProcedureTransitionIn,
  RegenerateOut,
  SendIn,
  VerifyAccepted,
} from '../dtos/administrative-procedure.dtos';
import { ServiceBase } from './service.base';

/**
 * Shared with AdministrativeDocumentService on purpose: a piece rendered through
 * the July generation routes changes a procedure, and a procedure action changes
 * what those routes allow. One prefix, one invalidation.
 */
const CACHE_PREFIX = 'administrative-document';

/**
 * HTTP client for the procedures engine, `/administrative-document/admin/...`
 * behind the gateway. Managers only, module active (the annex refuses the rest).
 *
 * Reads are cached under `administrative-document:<communityId>:admin:*`, keyed by
 * the active community for the reason AdministrativeDocumentService gives. Every
 * action invalidates the whole prefix: one response moves a step, starts and
 * meets deadlines and appends to the thread, and the dashboard counts all of it.
 */
@Injectable({ providedIn: 'root' })
export class AdministrativeProcedureService extends ServiceBase {
  private readonly apiAddress: string;
  private readonly userContext = inject(UserContextService);

  constructor() {
    super();
    this.apiAddress = environments.apiUrl + '/administrative-document/admin';
  }

  private key(...parts: (string | number)[]): string {
    const community = this.userContext.activeCommunityId() ?? 'none';
    return [CACHE_PREFIX, community, 'admin', ...parts].join(':');
  }

  /** Order-independent, so two equal queries share one cache entry. */
  private queryKey(query: object): string {
    const entries = Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== null)
      .sort(([a], [b]) => a.localeCompare(b));
    return JSON.stringify(Object.fromEntries(entries));
  }

  private invalidating<T>(request$: Observable<T>): Observable<T> {
    return request$.pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  /** Escape hatch for a guaranteed-fresh read (a realtime hint, a refresh). */
  invalidate(): void {
    this.cache.invalidate(CACHE_PREFIX);
  }

  // ---- reads ---------------------------------------------------------------

  /**
   * Active, regulator followed or not, the starting state to confirm. The
   * annex opens the tracking period on first sight, so this is not cached for
   * long.
   */
  getStatus(): Observable<ApiResponse<ProcedureModuleStatusOut>> {
    return this.cachedGet<ApiResponse<ProcedureModuleStatusOut>>(
      this.key('status'),
      `${this.apiAddress}/status`,
      undefined,
      defineTTL(1),
    );
  }

  /** The regulator's catalogue, every version, with its labels. Near-static. */
  listDefinitions(): Observable<ApiResponse<ProcedureDefinitionOut[]>> {
    return this.cachedGet<ApiResponse<ProcedureDefinitionOut[]>>(
      this.key('definitions'),
      `${this.apiAddress}/procedure-definitions`,
      undefined,
      defineTTL(30),
    );
  }

  /** The dashboard: procedures by bucket, next action and due date, the banner. */
  getInbox(query: InboxQuery = {}): Observable<ApiResponse<InboxOut>> {
    return this.cachedGet<ApiResponse<InboxOut>>(
      this.key('inbox', this.queryKey(query)),
      `${this.apiAddress}/inbox`,
      query,
      defineTTL(1),
    );
  }

  /** Every procedure, newest first, finished ones included. */
  listProcedures(query: ProcedureListQuery): Observable<ApiResponsePaginated<ProcedureItemOut[]>> {
    return this.cachedGet<ApiResponsePaginated<ProcedureItemOut[]>>(
      this.key('procedures', this.queryKey(query)),
      `${this.apiAddress}/dossiers`,
      query,
      defineTTL(1),
    );
  }

  /** The agenda. Without a range: every open deadline. */
  listDeadlines(
    query: ProcedureDeadlineQuery = {},
  ): Observable<ApiResponse<ProcedureDeadlineOut[]>> {
    return this.cachedGet<ApiResponse<ProcedureDeadlineOut[]>>(
      this.key('deadlines', this.queryKey(query)),
      `${this.apiAddress}/deadlines`,
      query,
      defineTTL(1),
    );
  }

  getProcedure(id: number): Observable<ApiResponse<ProcedureDetailOut>> {
    return this.cachedGet<ApiResponse<ProcedureDetailOut>>(
      this.key('procedure', id),
      `${this.apiAddress}/dossiers/${id}`,
      undefined,
      defineTTL(1),
    );
  }

  /**
   * The starting state to confirm, or what was chosen. Uncached: it is a
   * photograph the annex may take on this very call.
   */
  getBaseline(): Observable<ApiResponse<BaselineOut>> {
    return this.http.get<ApiResponse<BaselineOut>>(`${this.apiAddress}/baseline`);
  }

  // ---- actions ---------------------------------------------------------------
  // Each returns the procedure as it now is, so the caller needs no refetch.

  /** A procedure opened by hand from the catalogue. 409 (2377): one draft per family. */
  createProcedure(body: ProcedureCreateIn): Observable<ApiResponse<ProcedureDetailOut>> {
    return this.invalidating(
      this.http.post<ApiResponse<ProcedureDetailOut>>(`${this.apiAddress}/dossiers`, body),
    );
  }

  /** The change joins the next procedure of its type once this one is sent or cancelled. */
  deferChange(id: number, changeId: number): Observable<ApiResponse<ProcedureDetailOut>> {
    return this.invalidating(
      this.http.post<ApiResponse<ProcedureDetailOut>>(
        `${this.apiAddress}/dossiers/${id}/changes/${changeId}/defer`,
        {},
      ),
    );
  }

  excludeChange(
    id: number,
    changeId: number,
    body: ChangeExcludeIn,
  ): Observable<ApiResponse<ProcedureDetailOut>> {
    return this.invalidating(
      this.http.post<ApiResponse<ProcedureDetailOut>>(
        `${this.apiAddress}/dossiers/${id}/changes/${changeId}/exclude`,
        body,
      ),
    );
  }

  /** A step change by hand along one of the catalogue's edges, with its reason. */
  transition(id: number, body: ProcedureTransitionIn): Observable<ApiResponse<ProcedureDetailOut>> {
    return this.invalidating(
      this.http.post<ApiResponse<ProcedureDetailOut>>(
        `${this.apiAddress}/dossiers/${id}/transition`,
        body,
      ),
    );
  }

  /**
   * A signed or received piece. No Content-Type header: the browser sets the
   * multipart boundary. 409 (2378) once sent, except for a received piece.
   */
  uploadPiece(
    id: number,
    pieceId: number,
    file: File,
  ): Observable<ApiResponse<ProcedureDetailOut>> {
    const form = new FormData();
    form.append('file', file);
    return this.invalidating(
      this.http.post<ApiResponse<ProcedureDetailOut>>(
        `${this.apiAddress}/dossiers/${id}/documents/${pieceId}/versions`,
        form,
      ),
    );
  }

  /** "Mark as sent". Freezes the procedure. */
  send(id: number, body: SendIn): Observable<ApiResponse<ProcedureDetailOut>> {
    const form = new FormData();
    form.append('sent_on', body.sent_on);
    form.append('channel', body.channel);
    if (body.subject) form.append('subject', body.subject);
    if (body.body_text) form.append('body_text', body.body_text);
    if (body.file) form.append('file', body.file);
    return this.invalidating(
      this.http.post<ApiResponse<ProcedureDetailOut>>(
        `${this.apiAddress}/dossiers/${id}/send`,
        form,
      ),
    );
  }

  /**
   * Render the finals before sending: each reviewed draft again, unstamped.
   * 409 (2386) unless the pieces are complete and it is not sent yet. Each
   * final lands later (realtime `admin.document.ready`).
   */
  finalize(id: number): Observable<ApiResponse<FinalizeOut>> {
    return this.invalidating(
      this.http.post<ApiResponse<FinalizeOut>>(`${this.apiAddress}/dossiers/${id}/finalize`, {}),
    );
  }

  /**
   * One click: the stale pieces (or the ones named) from a fresh pre-fill, the
   * reviewer's own edits carried over. `needs_review` ones need the review form.
   */
  regenerate(id: number, documentIds?: number[]): Observable<ApiResponse<RegenerateOut>> {
    return this.invalidating(
      this.http.post<ApiResponse<RegenerateOut>>(`${this.apiAddress}/dossiers/${id}/regenerate`, {
        document_ids: documentIds ?? null,
      }),
    );
  }

  /** Regenerate a rendered version from what it froze and compare the bytes. */
  verify(id: number, pieceId: number, versionId: number): Observable<ApiResponse<VerifyAccepted>> {
    return this.invalidating(
      this.http.post<ApiResponse<VerifyAccepted>>(
        `${this.apiAddress}/dossiers/${id}/documents/${pieceId}/versions/${versionId}/verify`,
        {},
      ),
    );
  }

  /** The fiches de saisie of the procedure's form pieces. Uncached: a render may just have landed. */
  getEntrySheets(id: number): Observable<ApiResponse<EntrySheetOut[]>> {
    return this.http.get<ApiResponse<EntrySheetOut[]>>(
      `${this.apiAddress}/dossiers/${id}/entry-sheet`,
    );
  }

  /** Every final in one archive, with SHA256SUMS.txt. 409 (2385) while one is a draft. */
  downloadFinals(id: number): Observable<{ blob: Blob; filename: string }> {
    return this.http
      .get(`${this.apiAddress}/dossiers/${id}/finals.zip`, {
        observe: 'response',
        responseType: 'blob',
      })
      .pipe(
        map((response) => {
          const disposition = response.headers.get('Content-Disposition') ?? '';
          const match = /filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i.exec(disposition);
          const filename = match?.[1] ? decodeURIComponent(match[1]) : `OPT-${id}-pieces.zip`;
          return { blob: response.body as Blob, filename };
        }),
        catchError((error: HttpErrorResponse) => this.blobErrorHandler(error)),
      );
  }

  /** What recording this response would do. Writes nothing, so it invalidates nothing. */
  previewResponse(
    id: number,
    body: CorrespondenceIn,
  ): Observable<ApiResponse<CorrespondenceProposalOut>> {
    return this.http.post<ApiResponse<CorrespondenceProposalOut>>(
      `${this.apiAddress}/dossiers/${id}/correspondence`,
      this.correspondenceForm({ ...body, file: null }),
      { params: { dry_run: true } },
    );
  }

  recordResponse(id: number, body: CorrespondenceIn): Observable<ApiResponse<ProcedureDetailOut>> {
    return this.invalidating(
      this.http.post<ApiResponse<ProcedureDetailOut>>(
        `${this.apiAddress}/dossiers/${id}/correspondence`,
        this.correspondenceForm(body),
      ),
    );
  }

  private correspondenceForm(body: CorrespondenceIn): FormData {
    const form = new FormData();
    form.append('type', body.type);
    form.append('occurred_on', body.occurred_on);
    if (body.subject) form.append('subject', body.subject);
    if (body.body_text) form.append('body_text', body.body_text);
    if (body.external_ref) form.append('external_ref', body.external_ref);
    if (body.file) form.append('file', body.file);
    return form;
  }

  /**
   * Confirm the starting state; the annex writes its effects to the core. 409
   * (2373) carries `conflicts`: the EANs already tracked in another operation.
   */
  confirmBaseline(body: BaselineConfirmIn): Observable<ApiResponse<BaselineOut>> {
    return this.invalidating(
      this.http.post<ApiResponse<BaselineOut>>(`${this.apiAddress}/baseline/confirm`, body),
    );
  }

  /** A message's file, exactly as it was recorded. Never cached. */
  downloadCorrespondence(
    id: number,
    correspondenceId: number,
  ): Observable<{ blob: Blob; filename: string }> {
    return this.http
      .get(`${this.apiAddress}/dossiers/${id}/correspondence/${correspondenceId}/file`, {
        observe: 'response',
        responseType: 'blob',
      })
      .pipe(
        map((response) => {
          const disposition = response.headers.get('Content-Disposition') ?? '';
          const match = /filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i.exec(disposition);
          const filename = match?.[1]
            ? decodeURIComponent(match[1])
            : `message-${correspondenceId}`;
          return { blob: response.body as Blob, filename };
        }),
        catchError((error: HttpErrorResponse) => this.blobErrorHandler(error)),
      );
  }
}
