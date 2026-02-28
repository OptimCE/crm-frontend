import { Injectable } from '@angular/core';
import { environments } from '../../../environments/environments';
import { ApiResponse, ApiResponsePaginated } from '../../core/dtos/api.response';
import {
  CreateKeyDTO,
  KeyDTO,
  KeyPartialDTO,
  KeyPartialQuery,
  UpdateKeyDTO,
} from '../dtos/key.dtos';
import { catchError, map, Observable, tap } from 'rxjs';
import { ServiceBase } from './service.base';
import { HttpErrorResponse } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class KeyService extends ServiceBase {
  private readonly apiAddress: string;

  constructor() {
    super();
    this.apiAddress = environments.apiUrl + '/keys';
  }

  // private toHttpParams(obj: Record<string, unknown>): Record<string, string | number | boolean> {
  //   const params: Record<string, string | number | boolean> = {};
  //   for (const [key, value] of Object.entries(obj)) {
  //     if (value !== undefined && value !== null) {
  //       params[key] = value as string | number | boolean;
  //     }
  //   }
  //   return params;
  // }

  getKeysList(query: KeyPartialQuery): Observable<ApiResponsePaginated<KeyPartialDTO[] | string>> {
    return this.cachedGet<ApiResponsePaginated<KeyPartialDTO[] | string>>(
      `keys-list:${JSON.stringify(query)}`,
      this.apiAddress + '/',
      query,
    );
    // return this.http.get<ApiResponsePaginated<KeyPartialDTO[] | string>>(this.apiAddress + '/', {
    //   params: this.toHttpParams(query as unknown as Record<string, unknown>),
    // });
  }

  getKey(id: number): Observable<ApiResponse<KeyDTO | string>> {
    return this.cachedGet<ApiResponse<KeyDTO | string>>(`keys:${id}`, this.apiAddress + `/${id}`);
    // return this.http.get<ApiResponse<KeyDTO | string>>(this.apiAddress + '/' + id);
  }

  downloadKey(id: number): Observable<{ blob: Blob; filename: string }> {
    return this.http
      .get(this.apiAddress + '/' + id + '/download', {
        observe: 'response', // Gives us access to headers
        responseType: 'blob',
      })
      .pipe(
        map((response) => {
          const blob = response.body as Blob;

          const contentDisposition = response.headers.get('content-disposition');
          let filename = 'cle_repartition.xlsx';
          if (contentDisposition) {
            const match = contentDisposition.match(/filename="(.+)"/);
            if (match?.[1]) {
              filename = match[1];
            }
          }

          return { blob, filename };
        }),
        catchError((error: HttpErrorResponse) => this.blobErrorHandler(error)),
      );
  }

  addKey(create_key: CreateKeyDTO): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(this.apiAddress + '/', create_key).pipe(
      tap(() => {
        this.cache.invalidate('keys');
      }),
    );
  }

  updateKey(update_key: UpdateKeyDTO): Observable<ApiResponse<string>> {
    return this.http.put<ApiResponse<string>>(this.apiAddress + '/', update_key).pipe(
      tap(() => {
        this.cache.invalidate('keys');
      }),
    );
  }

  deleteKey(id: number): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(this.apiAddress + '/' + id).pipe(
      tap(() => {
        this.cache.invalidate('keys');
      }),
    );
  }
}
