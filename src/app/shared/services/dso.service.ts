import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environments } from '../../../environments/environments';
import { ApiResponse } from '../../core/dtos/api.response';
import { defineTTL } from '../../core/services/cache/cache.helper';
import { DsoOperatorDTO, DsoResolutionDTO, DsoResolveQuery } from '../dtos/dso.dtos';
import { ServiceBase } from './service.base';

/**
 * The query with its empty fields dropped and its keys sorted, so two forms that
 * build the same query in a different order share one cache entry and one request.
 */
function stableQuery(query: DsoResolveQuery): DsoResolveQuery {
  return Object.fromEntries(
    Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  ) as DsoResolveQuery;
}

/**
 * Which GRD serves an address, and the list of GRDs (crm-backend `/dso`).
 *
 * - `dso-operators` is national reference data, identical for every tenant, so it
 *   is deliberately ABSENT from `COMMUNITY_SCOPED_CACHE_PREFIXES` in
 *   `authorization.service.ts`, like `regulators`.
 * - `dso-resolve` is there: its warnings compare the address with the ACTIVE
 *   community's regulator, so another community's cached answer would be wrong.
 *
 * Neither retries (`retries: 0`). The backend answers 200 even when dso-lookup is
 * down, so a failure here is a missing route or a gateway timeout, which a retry
 * would only repeat; the form carries on with its static list either way.
 */
@Injectable({
  providedIn: 'root',
})
export class DsoService extends ServiceBase {
  private readonly apiAddress: string;

  constructor() {
    super();
    this.apiAddress = environments.apiUrl + '/dso';
  }

  /** The operator catalogue; `[]` when dso-lookup is off. Changes weekly at most. */
  getOperators(): Observable<ApiResponse<DsoOperatorDTO[] | string>> {
    return this.cachedGet<ApiResponse<DsoOperatorDTO[] | string>>(
      'dso-operators',
      this.apiAddress + '/operators',
      undefined,
      defineTTL(60),
      { retries: 0 },
    );
  }

  /** The GRD of an address. Reads only; the query never reaches a log or the database. */
  resolve(query: DsoResolveQuery): Observable<ApiResponse<DsoResolutionDTO | string>> {
    const params = stableQuery(query);
    return this.cachedGet<ApiResponse<DsoResolutionDTO | string>>(
      `dso-resolve:${JSON.stringify(params)}`,
      this.apiAddress + '/resolve',
      params,
      defineTTL(5),
      { retries: 0 },
    );
  }
}
