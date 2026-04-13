import { Injectable } from '@angular/core';
import { environments } from '../../../environments/environments';
import { DocumentExposedDTO, DocumentQueryDTO, DownloadDocument } from '../dtos/document.dtos';
import { ApiResponse, ApiResponsePaginated } from '../../core/dtos/api.response';
import { Observable, tap } from 'rxjs';
import { ServiceBase } from './service.base';

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
  }

  downloadDocument(
    memberId: number,
    documentId: number,
  ): Observable<ApiResponse<DownloadDocument>> {
    return this.http.get<ApiResponse<DownloadDocument>>(
      this.apiAddress + '/' + memberId + '/' + documentId,
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
