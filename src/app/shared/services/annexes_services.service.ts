import { HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environments } from '../../../environments/environments';
import { ApiResponse } from '../../core/dtos/api.response';
import { COMMUNITY_ID } from '../../core/interceptors/community.context.inteceptor';
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

  /**
   * The catalog of an ARBITRARY community, for the user dashboard's fan-out.
   *
   * Two things make this different from `getCommunityServices()` and both are
   * load-bearing: the request is pinned to `communityId` with the `COMMUNITY_ID`
   * context token (the interceptor would otherwise stamp the ACTIVE community),
   * and the cache key embeds the community — the key above deliberately does
   * not, which is why `CommunityServicesStore` has to invalidate it on every
   * switch.
   */
  getServicesForCommunity(communityId: string): Observable<ApiResponse<CommunityAnnex[]>> {
    return this.cachedGet<ApiResponse<CommunityAnnex[]>>(
      `annexes-services:community:${communityId}`,
      this.apiAddress,
      undefined,
      undefined,
      { context: new HttpContext().set(COMMUNITY_ID, communityId) },
    );
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
