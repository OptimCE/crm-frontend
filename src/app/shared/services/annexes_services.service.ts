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

  /**
   * The ACTIVE community's catalog, for `CommunityServicesStore`, which passes
   * the id it is loading.
   *
   * Keyed AND pinned by `communityId`, and both are load-bearing. The key used
   * to be the community-agnostic `annexes-services:list`, and `cachedGet` shares
   * a pending request by key while `CacheService.invalidate` cannot reach that
   * in-flight map: a switch during the fetch handed the NEW community the old
   * one's request, its answer, and a "loaded" flag. The pin covers what the key
   * cannot: the interceptor stamps whichever community is active when a request
   * is SENT, and `cachedGet` re-sends on a timeout or 5xx, so a retry after a
   * switch would ask for the new community and cache the answer under the old
   * one's key.
   *
   * Same request as `getServicesForCommunity`; the key family differs so the
   * store's active path and the dashboard fan-out never share an entry.
   */
  getCommunityServices(communityId: string): Observable<ApiResponse<CommunityAnnex[]>> {
    return this.cachedGet<ApiResponse<CommunityAnnex[]>>(
      `annexes-services:list:${communityId}`,
      this.apiAddress,
      undefined,
      undefined,
      { context: new HttpContext().set(COMMUNITY_ID, communityId) },
    );
  }

  /**
   * The catalog of an ARBITRARY community, for the user dashboard's fan-out.
   *
   * Pinned to `communityId` with the `COMMUNITY_ID` context token (the
   * interceptor would otherwise stamp the ACTIVE community), and keyed by it —
   * see `getCommunityServices` for why both matter.
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
