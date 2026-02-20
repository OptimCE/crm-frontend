import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environments } from '../../../environments/environments';
import { ApiResponse, ApiResponsePaginated } from '../../core/dtos/api.response';
import {
  CreateKeyDTO,
  KeyDTO,
  KeyPartialDTO,
  KeyPartialQuery,
  UpdateKeyDTO,
} from '../dtos/key.dtos';
import { from, map, Observable, switchMap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class KeyService {
  private http = inject(HttpClient);
  private apiAddress: string;

  constructor() {
    this.apiAddress = environments.apiUrl + '/keys';
  }

  private toHttpParams(obj: Record<string, unknown>): Record<string, string | number | boolean> {
    const params: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null) {
        params[key] = value as string | number | boolean;
      }
    }
    return params;
  }

  getKeysList(query: KeyPartialQuery): Observable<ApiResponsePaginated<KeyPartialDTO[] | string>> {
    return this.http.get<ApiResponsePaginated<KeyPartialDTO[] | string>>(this.apiAddress + '/', {
      params: this.toHttpParams(query as unknown as Record<string, unknown>),
    });
  }

  getKey(id: number): Observable<ApiResponse<KeyDTO | string>> {
    return this.http.get<ApiResponse<KeyDTO | string>>(this.apiAddress + '/' + id);
  }

  downloadKey(id: number): Observable<ApiResponse<string> | { blob: Blob; filename: string }> {
    return this.http
      .get(this.apiAddress + '/' + id + '/download', {
        observe: 'response', // Gives us access to headers
        responseType: 'blob',
      })
      .pipe(
        switchMap((response) => {
          const blob = response.body as Blob;

          if (blob.type === 'application/json') {
            return from(blob.text()).pipe(map((text) => JSON.parse(text) as ApiResponse<string>));
          }

          // Extract filename from Content-Disposition
          const contentDisposition = response.headers.get('content-disposition');
          let filename = 'cle_repartition.xlsx'; // Default
          if (contentDisposition) {
            const match = contentDisposition.match(/filename="(.+)"/);
            if (match && match[1]) {
              filename = match[1];
            }
          }

          return [{ blob, filename }];
        }),
      );
  }

  addKey(create_key: CreateKeyDTO): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(this.apiAddress + '/', create_key);
  }

  updateKey(update_key: UpdateKeyDTO): Observable<ApiResponse<string>> {
    return this.http.put<ApiResponse<string>>(this.apiAddress + '/', update_key);
  }

  deleteKey(id: number): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(this.apiAddress + '/' + id);
  }
}
