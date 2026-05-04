import { inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environments } from '../../../environments/environments';
import {
  from,
  Observable,
  of,
  retry,
  shareReplay,
  switchMap,
  tap,
  throwError,
  timeout,
  timer,
} from 'rxjs';
import { defineTTL } from '../../core/services/cache/cache.helper';
import { CacheService } from '../../core/services/cache/cache.service';

export class ServiceBase {
  protected cache = inject(CacheService);
  protected baseURL: string;
  protected http = inject(HttpClient);
  private inFlight = new Map<string, Observable<unknown>>();
  constructor() {
    this.baseURL = environments.apiUrl;
  }
  private withTimeoutAndRetry<T>(
    source$: Observable<T>,
    ms: number,
    retries: number,
  ): Observable<T> {
    return source$.pipe(
      timeout(ms),
      retry({
        count: retries,
        delay: (error: HttpErrorResponse, retryCount) => {
          if (error.status && error.status >= 400 && error.status < 500) {
            throw error; // eslint-disable-line @typescript-eslint/only-throw-error
          }
          return timer(retryCount * 1000);
        },
      }),
    );
  }
  protected cachedGet<T>(
    key: string,
    url: string,
    params?: object,
    ttl = defineTTL(5),
    options?: { timeout?: number; retries?: number },
  ): Observable<T> {
    const ms = options?.timeout ?? 10_000;
    const retries = options?.retries ?? 2;
    const cached = this.cache.get<T>(key);
    if (cached) return of(cached);

    const existing = this.inFlight.get(key);
    if (existing) return existing as Observable<T>;

    const httpParams = params
      ? (Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as Record<
          string,
          string | number | boolean | readonly (string | number | boolean)[]
        >)
      : undefined;

    const request$ = this.withTimeoutAndRetry(
      this.http.get<T>(url, { params: httpParams }),
      ms,
      retries,
    ).pipe(
      tap((data) => {
        this.cache.set(key, data, ttl);
        this.inFlight.delete(key);
      }),
      tap({ error: () => this.inFlight.delete(key) }),
      shareReplay(1),
    );

    this.inFlight.set(key, request$);
    return request$;
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
