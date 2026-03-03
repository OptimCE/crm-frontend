import { inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environments } from '../../../environments/environments';
import { from, Observable, of, switchMap, tap, throwError } from 'rxjs';
import { defineTTL } from '../../core/services/cache/cache.helper';
import { CacheService } from '../../core/services/cache/cache.service';

export class ServiceBase {
  protected cache = inject(CacheService);
  protected baseURL: string;
  protected http = inject(HttpClient);
  constructor() {
    this.baseURL = environments.apiUrl;
  }

  protected cachedGet<T>(
    key: string,
    url: string,
    params?: object,
    ttl = defineTTL(5),
  ): Observable<T> {
    const cached = this.cache.get<T>(key);
    if (cached) return of(cached);
    const httpParams = params
      ? (Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as Record<
          string,
          string | number | boolean
        >)
      : undefined;
    return this.http
      .get<T>(url, { params: httpParams })
      .pipe(tap((data) => this.cache.set(key, data, ttl)));
  }

  protected blobErrorHandler(error: HttpErrorResponse): Observable<never> {
    if (error.error instanceof Blob) {
      return from(error.error.text()).pipe(
        switchMap((text) => {
          try {
            const parsed: unknown = JSON.parse(text);
            error = new HttpErrorResponse({
              error: parsed as Record<string, unknown>,
              headers: error.headers,
              status: error.status,
              url: error.url ?? undefined,
            });
          } catch (_e) {
            /* ignore JSON parse errors — rethrow original error */
          }
          return throwError(() => error);
        }),
      );
    }
    return throwError(() => error);
  }
}
