import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environments } from '../../../environments/environments';
import { ApiResponse } from '../../core/dtos/api.response';
import { UserContextService } from '../../core/services/authorization/authorization.service';
import { defineTTL } from '../../core/services/cache/cache.helper';
import { CommunityDashboardDTO } from '../dtos/dashboard.dtos';
import { ServiceBase } from './service.base';

const CACHE_PREFIX = 'dashboard';

/**
 * Cache lifetime for dashboard reads.
 *
 * Anything under a minute buys nothing — every CRM GET is `@Cache(…, 60)`
 * server-side, so that is the real floor. The default five minutes is too stale
 * for a page whose entire job is "is anything wrong right now". Two minutes
 * keeps a read-through consistent and still shows a manager their fix quickly.
 */
export const DASHBOARD_TTL = defineTTL(2);

/**
 * HTTP client for the community dashboard aggregate.
 *
 * Keys are scoped to the ACTIVE COMMUNITY. `switchCommunity()` does invalidate
 * the `dashboard` prefix, but keeping the id in the key means a switch can never
 * serve the previous community's counters even if that list drifts.
 */
@Injectable({ providedIn: 'root' })
export class DashboardService extends ServiceBase {
  private readonly apiAddress: string;
  private readonly userContext = inject(UserContextService);

  constructor() {
    super();
    this.apiAddress = environments.apiUrl + '/communities';
  }

  private key(...parts: string[]): string {
    const community = this.userContext.activeCommunityId() ?? 'none';
    return [CACHE_PREFIX, community, ...parts].join(':');
  }

  /**
   * `GET /communities/dashboard` — the manager readiness aggregate.
   *
   * Requires GESTIONNAIRE; a member view must never call it.
   */
  getCommunityDashboard(): Observable<ApiResponse<CommunityDashboardDTO | string>> {
    return this.cachedGet<ApiResponse<CommunityDashboardDTO | string>>(
      this.key('community'),
      `${this.apiAddress}/dashboard`,
      undefined,
      DASHBOARD_TTL,
    );
  }

  /** Drops every dashboard entry, for the page's refresh control. */
  invalidate(): void {
    this.cache.invalidate(CACHE_PREFIX);
  }
}
