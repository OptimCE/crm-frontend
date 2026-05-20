import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environments } from '../../../environments/environments';
import { ApiResponse } from '../../core/dtos/api.response';
import { CommunityAnnex } from '../dtos/annexes_services.dtos';
import { ServiceBase } from './service.base';

@Injectable({
  providedIn: 'root',
})
export class AnnexesServicesService extends ServiceBase {
  private readonly apiAddress: string;

  constructor() {
    super();
    this.apiAddress = environments.apiUrl + '/annexes-services';
  }

  getCommunityServices(): Observable<ApiResponse<CommunityAnnex[]>> {
    return this.cachedGet<ApiResponse<CommunityAnnex[]>>('annexes-services:list', this.apiAddress);
  }

  subscribe(subscribePath: string): Observable<ApiResponse<string>> {
    return this.http
      .post<ApiResponse<string>>(this.baseURL + subscribePath, {})
      .pipe(tap(() => this.cache.invalidate('annexes-services')));
  }

  unsubscribe(unsubscribePath: string): Observable<ApiResponse<string>> {
    return this.http
      .post<ApiResponse<string>>(this.baseURL + unsubscribePath, {})
      .pipe(tap(() => this.cache.invalidate('annexes-services')));
  }
}
