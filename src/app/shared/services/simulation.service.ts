import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { environments } from '../../../environments/environments';
import { ApiResponse, ApiResponsePaginated } from '../../core/dtos/api.response';
import {
  CreateSimulationPayload,
  CreateSimulationResponse,
  SimulationDetailDTO,
  SimulationPartialDTO,
  SimulationQuery,
  SimulationTimeseriesDTO,
} from '../dtos/simulation.dtos';
import { ServiceBase } from './service.base';

const CACHE_PREFIX = 'simulation';

@Injectable({
  providedIn: 'root',
})
export class SimulationService extends ServiceBase {
  private readonly apiAddress: string;

  constructor() {
    super();
    this.apiAddress = environments.apiUrl + '/simulation';
  }

  listSimulations(
    query: SimulationQuery,
  ): Observable<ApiResponsePaginated<SimulationPartialDTO[] | string>> {
    return this.cachedGet<ApiResponsePaginated<SimulationPartialDTO[] | string>>(
      `${CACHE_PREFIX}:list:${JSON.stringify(query)}`,
      `${this.apiAddress}/`,
      query,
    );
  }

  getSimulation(id: number): Observable<ApiResponse<SimulationDetailDTO | string>> {
    return this.cachedGet<ApiResponse<SimulationDetailDTO | string>>(
      `${CACHE_PREFIX}:detail:${id}`,
      `${this.apiAddress}/${id}`,
    );
  }

  getTimeseries(id: number): Observable<ApiResponse<SimulationTimeseriesDTO | string>> {
    return this.cachedGet<ApiResponse<SimulationTimeseriesDTO | string>>(
      `${CACHE_PREFIX}:timeseries:${id}`,
      `${this.apiAddress}/${id}/timeseries`,
    );
  }

  startSimulation(
    payload: CreateSimulationPayload,
  ): Observable<ApiResponse<CreateSimulationResponse>> {
    const fd = new FormData();
    fd.append('file', payload.file);
    fd.append('name', payload.name);
    fd.append('id_key', String(payload.idKey));
    fd.append('injection_name', payload.injectionName);

    return this.http
      .post<ApiResponse<CreateSimulationResponse>>(`${this.apiAddress}/`, fd)
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  deleteSimulation(id: number): Observable<ApiResponse<string>> {
    return this.http
      .delete<ApiResponse<string>>(`${this.apiAddress}/${id}`)
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  invalidate(): void {
    this.cache.invalidate(CACHE_PREFIX);
  }
}
