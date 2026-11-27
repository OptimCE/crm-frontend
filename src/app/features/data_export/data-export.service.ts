import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environments } from '../../../environments/environments';
import { ApiResponse, ApiResponsePaginated } from '../../core/dtos/api.response';
import { ServiceBase } from '../../shared/services/service.base';
import {
  CreateDataExportDTO,
  DataExportCreatedDTO,
  DataExportDownloadUrlDTO,
  DataExportDTO,
  DataExportListQuery,
} from './data-export.dto';

/**
 * REST client for the crm-backend export module (`/exports`). Nothing is
 * cached: the list is polled while an export is in preparation and must show
 * each step, and a download URL is single-use by design (5 minutes, audited).
 */
@Injectable({
  providedIn: 'root',
})
export class DataExportService extends ServiceBase {
  private readonly apiAddress: string;

  constructor() {
    super();
    this.apiAddress = environments.apiUrl + '/exports';
  }

  /** Ask for an export. 401 35000 means a fresh login is needed first (step-up). */
  request(body: CreateDataExportDTO): Observable<ApiResponse<DataExportCreatedDTO>> {
    return this.http.post<ApiResponse<DataExportCreatedDTO>>(`${this.apiAddress}/`, body);
  }

  /** The caller's own exports (`mine`), or every export of the active community (`community`, ADMIN). */
  list(query: DataExportListQuery): Observable<ApiResponsePaginated<DataExportDTO[]>> {
    return this.http.get<ApiResponsePaginated<DataExportDTO[]>>(`${this.apiAddress}/`, {
      params: { view: query.view, page: query.page, limit: query.limit },
    });
  }

  /** A presigned URL for the requester's ready export; the browser downloads it straight from storage. */
  downloadUrl(id: string): Observable<ApiResponse<DataExportDownloadUrlDTO>> {
    return this.http.post<ApiResponse<DataExportDownloadUrlDTO>>(
      `${this.apiAddress}/${encodeURIComponent(id)}/download-url`,
      {},
    );
  }
}
