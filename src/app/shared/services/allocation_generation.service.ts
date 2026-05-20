import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { environments } from '../../../environments/environments';
import { ApiResponse, ApiResponsePaginated } from '../../core/dtos/api.response';
import {
  AlgorithmMetadata,
  AllocationKeyDetailDTO,
  AllocationKeyPartialDTO,
  AllocationKeyQuery,
  CreateGenerationPayload,
  CreateGenerationResponse,
  GenerationPartialDTO,
  GenerationQuery,
  SaveKeyPayload,
} from '../dtos/allocation_generation.dtos';
import { ServiceBase } from './service.base';

const CACHE_PREFIX = 'generation';
const KEYS_CACHE_PREFIX = 'keys';

@Injectable({
  providedIn: 'root',
})
export class AllocationGenerationService extends ServiceBase {
  private readonly apiAddress: string;

  constructor() {
    super();
    this.apiAddress = environments.apiUrl + '/generation';
  }

  listAlgorithms(): Observable<ApiResponse<AlgorithmMetadata[]>> {
    return this.cachedGet<ApiResponse<AlgorithmMetadata[]>>(
      `${CACHE_PREFIX}:algorithms`,
      `${this.apiAddress}/algorithms`,
    );
  }

  getAlgorithm(name: string): Observable<ApiResponse<AlgorithmMetadata>> {
    return this.cachedGet<ApiResponse<AlgorithmMetadata>>(
      `${CACHE_PREFIX}:algorithm:${name}`,
      `${this.apiAddress}/algorithms/${encodeURIComponent(name)}`,
    );
  }

  listGenerations(
    query: GenerationQuery,
  ): Observable<ApiResponsePaginated<GenerationPartialDTO[] | string>> {
    return this.cachedGet<ApiResponsePaginated<GenerationPartialDTO[] | string>>(
      `${CACHE_PREFIX}:list:${JSON.stringify(query)}`,
      `${this.apiAddress}/`,
      query,
    );
  }

  getGenerationKeys(
    idGeneration: number,
    query: AllocationKeyQuery,
  ): Observable<ApiResponsePaginated<AllocationKeyPartialDTO[] | string>> {
    return this.cachedGet<ApiResponsePaginated<AllocationKeyPartialDTO[] | string>>(
      `${CACHE_PREFIX}:${idGeneration}:keys:${JSON.stringify(query)}`,
      `${this.apiAddress}/${idGeneration}`,
      query,
    );
  }

  getKey(idKey: number): Observable<ApiResponse<AllocationKeyDetailDTO | string>> {
    return this.cachedGet<ApiResponse<AllocationKeyDetailDTO | string>>(
      `${CACHE_PREFIX}:key:${idKey}`,
      `${this.apiAddress}/key/${idKey}`,
    );
  }

  startGeneration(
    payload: CreateGenerationPayload,
  ): Observable<ApiResponse<CreateGenerationResponse>> {
    const fd = new FormData();
    fd.append('file', payload.file);
    fd.append('name', payload.name);
    fd.append('injection_name', payload.injectionName);
    fd.append('algorithm_name', payload.algorithmName);
    fd.append('inputs', JSON.stringify(payload.inputs));

    return this.http
      .post<ApiResponse<CreateGenerationResponse>>(`${this.apiAddress}/`, fd)
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  saveKey(payload: SaveKeyPayload): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(`${this.apiAddress}/save`, payload).pipe(
      tap(() => {
        this.cache.invalidate(CACHE_PREFIX);
        // The persisted key now appears in the CRM `/keys` store; drop the
        // sibling list cache so the keys page refetches on next visit.
        this.cache.invalidate(KEYS_CACHE_PREFIX);
      }),
    );
  }

  deleteGeneration(idGeneration: number): Observable<ApiResponse<string>> {
    return this.http
      .delete<ApiResponse<string>>(`${this.apiAddress}/generation/${idGeneration}`)
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  deleteKey(idKey: number): Observable<ApiResponse<string>> {
    return this.http
      .delete<ApiResponse<string>>(`${this.apiAddress}/key/${idKey}`)
      .pipe(tap(() => this.cache.invalidate(CACHE_PREFIX)));
  }

  invalidate(): void {
    this.cache.invalidate(CACHE_PREFIX);
  }
}
