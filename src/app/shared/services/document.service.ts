import { Injectable } from '@angular/core';
import { environments } from '../../../environments/environments';
import { DocumentExposedDTO, DocumentQueryDTO } from '../dtos/document.dtos';
import { ApiResponse, ApiResponsePaginated } from '../../core/dtos/api.response';
import { catchError, map, Observable, tap } from 'rxjs';
import { ServiceBase } from './service.base';
import { HttpErrorResponse } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class DocumentService extends ServiceBase {
  private readonly apiAddress: string;

  constructor() {
    super();
    this.apiAddress = environments.apiUrl + '/documents';
  }

  getDocuments(
    memberId: number,
    query: DocumentQueryDTO,
  ): Observable<ApiResponsePaginated<DocumentExposedDTO[] | string>> {
    return this.cachedGet<ApiResponsePaginated<DocumentExposedDTO[] | string>>(
      `documents:${memberId}/${JSON.stringify(query)}`,
      this.apiAddress + '/' + memberId,
      query,
    );
    // return this.http.get<ApiResponsePaginated<DocumentExposedDTO[]>>(
    //   this.apiAddress + '/' + memberId,
    //   {
    //     params: { ...query },
    //   },
    // );
  }

  downloadDocument(
    memberId: number,
    documentId: number,
  ): Observable<{ blob: Blob; filename: string }> {
    return this.http
      .get(this.apiAddress + '/' + memberId + '/' + documentId, {
        observe: 'response',
        responseType: 'blob',
      })
      .pipe(
        map((response) => {
          const blob = response.body as Blob;

          const contentDisposition = response.headers.get('content-disposition');
          let filename = 'document.';
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

  uploadDocument(formData: FormData): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(this.apiAddress + '/', formData).pipe(
      tap(() => {
        this.cache.invalidate('documents');
      }),
    );
  }

  deleteDocument(documentId: number): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(this.apiAddress + '/' + documentId).pipe(
      tap(() => {
        this.cache.invalidate('documents');
      }),
    );
  }
}
