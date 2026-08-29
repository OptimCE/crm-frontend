import { Injectable } from '@angular/core';
import { forkJoin, map, Observable, of } from 'rxjs';
import { environments } from '../../../environments/environments';
import { ApiResponse, ApiResponsePaginated } from '../../core/dtos/api.response';
import {
  MunicipalityGeometryDTO,
  MunicipalityPartialDTO,
  MunicipalitySearchQuery,
} from '../dtos/municipality.dtos';
import { defineTTL } from '../../core/services/cache/cache.helper';
import { ServiceBase } from './service.base';

@Injectable({
  providedIn: 'root',
})
export class MunicipalityService extends ServiceBase {
  private readonly apiAddress: string;

  constructor() {
    super();
    this.apiAddress = environments.apiUrl + '/municipalities';
  }

  searchMunicipalities(
    query: MunicipalitySearchQuery,
  ): Observable<ApiResponsePaginated<MunicipalityPartialDTO[] | string>> {
    return this.cachedGet<ApiResponsePaginated<MunicipalityPartialDTO[] | string>>(
      `municipalities-search:${JSON.stringify(query)}`,
      this.apiAddress + '/',
      query,
    );
  }

  /**
   * Simplified commune boundaries for the map.
   *
   * Cached for a day and deliberately absent from COMMUNITY_SCOPED_CACHE_PREFIXES:
   * commune boundaries are national reference data, identical for every tenant,
   * and clearing them on a community switch would just re-download megabytes.
   *
   * Requests are bucketed by NIS thousands (the leading digits are the
   * arrondissement) rather than sliced into fixed-size chunks. Buckets stay
   * stable as a user narrows a filter, so the cache is reused; slicing would
   * produce a different key set for every selection and never hit. It also
   * keeps each query string short — 581 codes in one URL is ~3.5 kB, which the
   * gateway is under no obligation to carry.
   */
  getGeometries(nisCodes: readonly number[]): Observable<MunicipalityGeometryDTO[]> {
    const buckets = new Map<number, number[]>();
    for (const code of new Set(nisCodes)) {
      const bucket = Math.floor(code / 1000);
      const existing = buckets.get(bucket);
      if (existing) {
        existing.push(code);
      } else {
        buckets.set(bucket, [code]);
      }
    }
    if (buckets.size === 0) {
      return of([]);
    }

    return forkJoin(
      [...buckets.values()].map((codes) => {
        const sorted = [...codes].sort((a, b) => a - b);
        return this.cachedGet<ApiResponse<MunicipalityGeometryDTO[] | string>>(
          `municipalities-geometry:${sorted.join(',')}`,
          this.apiAddress + '/geometry',
          { nis_codes: sorted.join(',') },
          defineTTL(24 * 60),
        );
      }),
    ).pipe(
      map((responses) =>
        // `data` is typed `MunicipalityGeometryDTO[] | string` by the envelope;
        // the Array.isArray guard is what makes the string case fall out.
        responses.flatMap((response) => (Array.isArray(response?.data) ? response.data : [])),
      ),
    );
  }
}
