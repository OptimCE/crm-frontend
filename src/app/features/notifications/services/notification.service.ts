import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { environments } from '../../../../environments/environments';
import { ApiResponse, ApiResponsePaginated } from '../../../core/dtos/api.response';
import { defineTTL } from '../../../core/services/cache/cache.helper';
import { ServiceBase } from '../../../shared/services/service.base';
import {
  NotificationDTO,
  NotificationListQuery,
  NotificationPreferenceDTO,
  NotificationPreferencesDTO,
  UnreadCountDTO,
} from '../dtos/notification.dto';

const CACHE_PREFIX = 'notifications';

/**
 * Thin REST client for the crm-backend notification module
 * (mounted at `/notifications`). The feature is recipient-scoped on the
 * backend (auth header only) and polling-based — there is no SSE endpoint.
 * Scope is global: we never send `community_id`.
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationService extends ServiceBase {
  private readonly apiAddress: string;

  constructor() {
    super();
    this.apiAddress = environments.apiUrl + '/notifications';
  }

  /** Paginated list, newest-first. Short TTL — this list changes often. */
  list(query: NotificationListQuery): Observable<ApiResponsePaginated<NotificationDTO[]>> {
    return this.cachedGet<ApiResponsePaginated<NotificationDTO[]>>(
      `${CACHE_PREFIX}:list:${JSON.stringify(query)}`,
      `${this.apiAddress}/`,
      query,
      defineTTL(1),
    );
  }

  /** Unread badge count. Polled, so bypass the cache with a direct GET. */
  unreadCount(): Observable<ApiResponse<UnreadCountDTO>> {
    return this.http.get<ApiResponse<UnreadCountDTO>>(`${this.apiAddress}/unread-count`);
  }

  /** Mark a single notification read. 404 means it is not owned by the user. */
  markRead(id: string): Observable<ApiResponse<string>> {
    return this.http
      .patch<ApiResponse<string>>(`${this.apiAddress}/${id}/read`, {})
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  /** Mark every unread notification read for the current user. */
  markAllRead(): Observable<ApiResponse<string>> {
    return this.http
      .patch<ApiResponse<string>>(`${this.apiAddress}/read-all`, {})
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  /**
   * The current user's channel preferences, plus the type prefixes the backend
   * recognises. Uncached: it is read once when the tab opens and must reflect a
   * save immediately.
   */
  preferences(): Observable<ApiResponse<NotificationPreferencesDTO>> {
    return this.http.get<ApiResponse<NotificationPreferencesDTO>>(`${this.apiAddress}/preferences`);
  }

  /**
   * Replace the preference set wholesale and get the new state back. Rows absent
   * from `preferences` are deleted, which is how "reset to default" is
   * expressed — so always send the complete set, never a delta.
   */
  savePreferences(
    preferences: NotificationPreferenceDTO[],
  ): Observable<ApiResponse<NotificationPreferencesDTO>> {
    return this.http.put<ApiResponse<NotificationPreferencesDTO>>(
      `${this.apiAddress}/preferences`,
      { preferences },
    );
  }

  /** Drop the cached lists (call after a mutation outside this service). */
  invalidate(): void {
    this.cache.invalidate(CACHE_PREFIX);
  }
}
