import { inject, Injectable } from '@angular/core';
import { map, Observable, of, switchMap, throwError } from 'rxjs';

import { CommunityDetailDTO, MyCommunityDTO } from '../../shared/dtos/community.dtos';
import { CommunityService } from '../../shared/services/community.service';
import { UserContextService } from './authorization/authorization.service';

/**
 * Resolves the active community's DETAIL record.
 *
 * Two ids exist for a community and they are not interchangeable:
 * `UserContextService.activeCommunityId()` is the Keycloak org UUID (what
 * `X-Community-ID` carries), while every `/communities/{id}` route takes the
 * internal integer. Nothing in the frontend maps one to the other synchronously,
 * so the only way across is `GET /communities/my-communities` matched on
 * `auth_community_id` — the round trip `community-info.ts` performs inline.
 *
 * Hoisted here because the member dashboard needs the same answer for several
 * tiles and would otherwise repeat it once per tile.
 *
 * Note `/communities/info` is a FRONTEND route: there is no such endpoint, and
 * `GET /communities/info` would resolve to `GET /:id` with `id = 'info'`.
 */
@Injectable({ providedIn: 'root' })
export class ActiveCommunityStore {
  private readonly communityService = inject(CommunityService);
  private readonly userContext = inject(UserContextService);

  /** Cached detail, and the org id it describes — same discipline as CommunityServicesStore. */
  private loadedFor: string | null = null;
  private detail: CommunityDetailDTO | null = null;

  /**
   * The active community's detail record, fetched on first access.
   *
   * `GET /communities/:id` carries `idChecker()` only, so this is member-safe.
   */
  ensureLoaded(): Observable<CommunityDetailDTO | null> {
    const orgId = this.userContext.activeCommunityId();
    if (!orgId) return of(null);
    if (this.loadedFor === orgId && this.detail) return of(this.detail);

    return this.communityService.getMyCommunities({ page: 1, limit: 100 }).pipe(
      switchMap((response) => {
        // The envelope carries a plain string instead of the list on failure.
        const memberships: MyCommunityDTO[] = Array.isArray(response.data) ? response.data : [];
        const match = memberships.find((c) => c.auth_community_id === orgId);
        if (!match) {
          return throwError(() => new Error('Active community not found in user memberships'));
        }
        return this.communityService.getCommunityDetail(match.id);
      }),
      map((response) => {
        // The community may have changed under an in-flight request; only cache
        // the answer if it still describes the one that is active.
        if (this.userContext.activeCommunityId() !== orgId) return response.data;
        this.detail = response.data;
        this.loadedFor = orgId;
        return response.data;
      }),
    );
  }

  /** Forces the next `ensureLoaded()` to refetch. */
  invalidate(): void {
    this.loadedFor = null;
    this.detail = null;
  }
}
