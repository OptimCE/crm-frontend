import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environments } from '../../../environments/environments';
import { ApiResponse } from '../../core/dtos/api.response';
import { RegulatoryStatusDTO, RegulatoryStatusQuery } from '../dtos/regulatory-status.dtos';
import { ServiceBase } from './service.base';

/**
 * What the regulator and the GRD have authorised for an operation's meters and
 * keys (crm-backend `GET /regulatory/status`): the CRM's regulatory badges.
 *
 * Plain GETs, never `cachedGet`: the administrative annexe writes these rows
 * straight into the core's database, so no action of this client would ever
 * invalidate a cached copy. A screen refetches on `admin.dossier.updated` and
 * `admin.change.detected`, the hints the annexe emits once its writes landed.
 */
@Injectable({ providedIn: 'root' })
export class RegulatoryStatusService extends ServiceBase {
  private readonly apiAddress: string;

  constructor() {
    super();
    this.apiAddress = environments.apiUrl + '/regulatory';
  }

  /**
   * One row per (operation, subject): of one operation or of the whole
   * community, narrowed to `subject_ref`; `[]` when the module is off.
   */
  status(query: RegulatoryStatusQuery): Observable<ApiResponse<RegulatoryStatusDTO[] | string>> {
    let params = new HttpParams();
    if (query.id_sharing_operation !== undefined)
      params = params.set('id_sharing_operation', String(query.id_sharing_operation));
    if (query.subject_type !== undefined)
      params = params.set('subject_type', String(query.subject_type));
    const refs = query.subject_ref === undefined ? [] : [query.subject_ref].flat();
    for (const ref of refs) params = params.append('subject_ref', ref);
    if (query.date !== undefined) params = params.set('date', query.date);
    return this.http.get<ApiResponse<RegulatoryStatusDTO[] | string>>(this.apiAddress + '/status', {
      params,
    });
  }
}
