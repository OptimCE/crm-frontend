import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environments } from '../../../environments/environments';
import { ApiResponse } from '../../core/dtos/api.response';
import { defineTTL } from '../../core/services/cache/cache.helper';
import {
  AddressPreviewDTO,
  AddressPreviewQuery,
  AddressSuggestionDTO,
} from '../dtos/geocoding.dtos';
import { ServiceBase } from './service.base';

/**
 * Address suggestions and the "can we locate this?" check.
 *
 * Both are **national reference data, identical for every tenant**, so their
 * cache keys are deliberately ABSENT from `COMMUNITY_SCOPED_CACHE_PREFIXES` in
 * `authorization.service.ts` — the same call that file already makes for
 * `municipalities-search` and `regulators`. Clearing them on a community switch
 * would only cost a refetch.
 */
@Injectable({
  providedIn: 'root',
})
export class GeocodingService extends ServiceBase {
  private readonly apiAddress: string;

  constructor() {
    super();
    this.apiAddress = environments.apiUrl + '/geocoding';
  }

  /**
   * Suggestions for free text.
   *
   * `retries: 0` is the important argument. `cachedGet` defaults to two retries
   * with a backoff, and this fires once per debounced keystroke across six
   * forms — a default retry turns a slow provider into three times the traffic
   * against services that are, on the fallback path, free and public. An
   * unanswered keystroke is not worth retrying: the next one supersedes it.
   *
   * The 60 s TTL is short for reference data on purpose. Suggestions are cheap
   * to refetch, and a longer window mostly caches queries nobody repeats.
   */
  suggestAddresses(
    query: string,
    limit = 8,
  ): Observable<ApiResponse<AddressSuggestionDTO[] | string>> {
    return this.cachedGet<ApiResponse<AddressSuggestionDTO[] | string>>(
      `geocoding-suggest:${limit.toString()}:${query.trim().toLowerCase()}`,
      this.apiAddress + '/suggest',
      { q: query, limit },
      defineTTL(1),
      { retries: 0 },
    );
  }

  /**
   * Can this address be placed on the map? Reads only; writes nothing.
   *
   * A GET rather than a POST because `ServiceBase` has only `cachedGet` — as a
   * POST this would forfeit in-flight deduplication, the cache, the timeout and
   * the retry policy, and gain nothing for an idempotent, side-effect-free call.
   */
  previewAddress(query: AddressPreviewQuery): Observable<ApiResponse<AddressPreviewDTO | string>> {
    return this.cachedGet<ApiResponse<AddressPreviewDTO | string>>(
      `geocoding-preview:${JSON.stringify(query)}`,
      this.apiAddress + '/preview',
      query,
      defineTTL(1),
      { retries: 0 },
    );
  }
}
