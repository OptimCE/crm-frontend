import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environments } from '../../../environments/environments';
import { DocumentExposedDTO, DocumentQueryDTO } from '../dtos/document.dtos';
import { ApiResponse, ApiResponsePaginated } from '../../core/dtos/api.response';
import { Observable } from 'rxjs';

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

  downloadDocument(memberId: number, documentId: number): Observable<Blob> {
    return this.http.get(this.apiAddress + '/' + memberId + '/' + documentId, {
      responseType: 'blob',
    });
  }

  uploadDocument(formData: FormData): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(this.apiAddress + '/', formData);
  }

  deleteDocument(documentId: number): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(this.apiAddress + '/' + documentId);
  }
}
