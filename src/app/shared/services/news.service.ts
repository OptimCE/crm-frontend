import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { environments } from '../../../environments/environments';
import { ApiResponse, ApiResponsePaginated } from '../../core/dtos/api.response';
import { defineTTL } from '../../core/services/cache/cache.helper';
import {
  CastVoteRequest,
  CreatePostRequest,
  NewsQuery,
  PollResults,
  PostDetail,
  PostListItem,
  UpdatePostRequest,
} from '../dtos/news.dtos';
import { ServiceBase } from './service.base';

const CACHE_PREFIX = 'news';

/**
 * HTTP access to the News Board annex. The KrakenD gateway prepends `/news`;
 * the community-context + bearer interceptors inject X-Community-ID / auth.
 */
@Injectable({ providedIn: 'root' })
export class NewsService extends ServiceBase {
  private readonly apiAddress: string;

  constructor() {
    super();
    this.apiAddress = environments.apiUrl + '/news';
  }

  listPosts(query: NewsQuery): Observable<ApiResponsePaginated<PostListItem[]>> {
    return this.cachedGet<ApiResponsePaginated<PostListItem[]>>(
      `${CACHE_PREFIX}:list:${JSON.stringify(query)}`,
      `${this.apiAddress}/posts`,
      query,
    );
  }

  getPost(id: number): Observable<ApiResponse<PostDetail>> {
    return this.cachedGet<ApiResponse<PostDetail>>(
      `${CACHE_PREFIX}:detail:${id}`,
      `${this.apiAddress}/posts/${id}`,
    );
  }

  /** Visibility-enforced poll results. Short TTL — votes change them. */
  getResults(id: number): Observable<ApiResponse<PollResults>> {
    return this.cachedGet<ApiResponse<PollResults>>(
      `${CACHE_PREFIX}:results:${id}`,
      `${this.apiAddress}/posts/${id}/results`,
      undefined,
      defineTTL(1),
    );
  }

  createPost(body: CreatePostRequest): Observable<ApiResponse<{ id: number }>> {
    return this.http
      .post<ApiResponse<{ id: number }>>(`${this.apiAddress}/posts`, body)
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  updatePost(id: number, body: UpdatePostRequest): Observable<ApiResponse<PostDetail>> {
    return this.http
      .patch<ApiResponse<PostDetail>>(`${this.apiAddress}/posts/${id}`, body)
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  deletePost(id: number): Observable<ApiResponse<string>> {
    return this.http
      .delete<ApiResponse<string>>(`${this.apiAddress}/posts/${id}`)
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  castVote(id: number, optionIds: number[]): Observable<ApiResponse<string>> {
    const body: CastVoteRequest = { option_ids: optionIds };
    return this.http
      .post<ApiResponse<string>>(`${this.apiAddress}/posts/${id}/votes`, body)
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  retractVote(id: number): Observable<ApiResponse<string>> {
    return this.http
      .delete<ApiResponse<string>>(`${this.apiAddress}/posts/${id}/votes`)
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  invalidate(): void {
    this.cache.invalidate(CACHE_PREFIX);
  }
}
