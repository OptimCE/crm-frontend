import { inject, Injectable } from '@angular/core';
import Keycloak from 'keycloak-js';
import { firstValueFrom } from 'rxjs';

import { CommunityService } from '../../shared/services/community.service';
import { UserContextService } from './authorization/authorization.service';

/**
 * Lands the session in the community a membership change concerns.
 *
 * Creating a community or accepting an invitation changes the user's Keycloak
 * groups, which the app only sees in a refreshed token. Before this, neither
 * flow refreshed the context into the new community: a creator with other
 * communities and every invitee stayed where they were, and the new community
 * showed up only after the next token refresh and a manual pick. Activating it
 * is also what lets the onboarding offer come at that moment
 * (features/onboarding offers role tours when a community becomes active).
 *
 * Never navigates: the user stays on the page they acted from.
 */
@Injectable({ providedIn: 'root' })
export class CommunityActivationService {
  private readonly keycloak = inject(Keycloak);
  private readonly userContext = inject(UserContextService);
  private readonly communityService = inject(CommunityService);

  /**
   * After creating a community: the org the refreshed token added becomes active.
   * `POST /communities/` returns no id, hence the before/after comparison.
   * @returns The activated org id, or null when none could be told apart.
   */
  async activateCreated(): Promise<string | null> {
    const before = new Set(Object.keys(this.userContext.communitiesById()));
    await this.refresh();
    const added = Object.keys(this.userContext.communitiesById()).filter((id) => !before.has(id));
    return this.activate(added.length === 1 ? added[0] : null);
  }

  /**
   * After accepting an invitation to `communityId` (the internal id the
   * invitation carries): that community becomes active, including when the user
   * already belonged to it (a member who accepts to become its manager).
   * @returns The activated org id, or null when it could not be resolved.
   */
  async activateJoined(communityId: number): Promise<string | null> {
    await this.refresh();
    return this.activate(await this.orgIdOf(communityId));
  }

  private async refresh(): Promise<void> {
    try {
      await this.keycloak.updateToken(-1);
    } catch (error) {
      console.error('Community activation: token refresh failed', error);
    }
    this.userContext.refreshUserContext();
  }

  /** The Keycloak org of an internal community id, through the user's own memberships. */
  private async orgIdOf(communityId: number): Promise<string | null> {
    try {
      const response = await firstValueFrom(
        this.communityService.getMyCommunities({ page: 1, limit: 100 }),
      );
      const memberships = Array.isArray(response.data) ? response.data : [];
      return memberships.find((c) => c.id === communityId)?.auth_community_id ?? null;
    } catch {
      return null;
    }
  }

  private activate(orgId: string | null): string | null {
    if (!orgId || !this.userContext.communitiesById()[orgId]) return null;
    this.userContext.switchCommunity(orgId);
    return orgId;
  }
}
