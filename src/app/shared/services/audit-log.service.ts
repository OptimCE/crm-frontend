import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError } from 'rxjs';
import { environments } from '../../../environments/environments';
import { ApiResponsePaginated } from '../../core/dtos/api.response';
import { AuditLogDTO, AuditLogQuery } from '../dtos/audit-log.dtos';
import { ServiceBase } from './service.base';

@Injectable({
  providedIn: 'root',
})
export class AuditLogService extends ServiceBase {
  private readonly apiAddress: string;

  constructor() {
    super();
    this.apiAddress = environments.apiUrl + '/audit-logs';
  }

  getAuditLogList(query: AuditLogQuery): Observable<ApiResponsePaginated<AuditLogDTO[] | string>> {
    return this.cachedGet<ApiResponsePaginated<AuditLogDTO[] | string>>(
      `audit-logs-list:${JSON.stringify(query)}`,
      this.apiAddress + '/',
      query as unknown as Record<string, unknown>,
    );
  }

  exportAuditLogCsv(query: AuditLogQuery): Observable<HttpResponse<Blob>> {
    const params = Object.fromEntries(
      Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    ) as Record<string, string | number | boolean>;

    return this.http
      .get(this.apiAddress + '/export', {
        params,
        responseType: 'blob',
        observe: 'response',
      })
      .pipe(catchError((error: HttpErrorResponse) => this.blobErrorHandler(error)));
  }
}
