import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environments } from '../../../environments/environments';
import { DocumentExposedDTO, DocumentQueryDTO } from '../dtos/document.dtos';
import { ApiResponse, ApiResponsePaginated } from '../../core/dtos/api.response';
import { from, map, Observable, switchMap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class DocumentService {
  private http = inject(HttpClient);
  private apiAddress: string;

  constructor() {
    this.apiAddress = environments.apiUrl + '/documents';
  }

  getDocuments(
    memberId: number,
    query: DocumentQueryDTO,
  ): Observable<ApiResponsePaginated<DocumentExposedDTO[]>> {
    return this.http.get<ApiResponsePaginated<DocumentExposedDTO[]>>(
      this.apiAddress + '/' + memberId,
      {
        params: { ...query },
      },
    );
  }

  downloadDocument(
    memberId: number,
    documentId: number,
  ): Observable<ApiResponse<string> | { blob: Blob; filename: string }> {
    return this.http
      .get(this.apiAddress + '/' + memberId + '/' + documentId, {
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

  uploadDocument(formData: FormData): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(this.apiAddress + '/', formData);
  }

  deleteDocument(documentId: number): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(this.apiAddress + '/' + documentId);
  }
}
