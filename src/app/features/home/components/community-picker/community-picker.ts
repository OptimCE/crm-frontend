import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';

import { safeReturnUrl } from '../../../../core/guards/active-community.guard';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { CommunityLogo } from '../../../../shared/components/community-logo/community-logo';
import { MyCommunityDTO } from '../../../../shared/dtos/community.dtos';

/**
 * "Mes communautés" — the way into a community, and the only route out of the
 * no-active-community state.
 *
 * Cards rather than the filterable `p-table` at `/users/communities`: this is
 * the most important click in the application for someone who has just logged
 * in, and a table row with four action links buries it. That page still exists
 * and still owns creating, renaming and leaving.
 */
@Component({
  selector: 'app-community-picker',
  standalone: true,
  imports: [TranslatePipe, RouterLink, Button, CommunityLogo],
  templateUrl: './community-picker.html',
})
export class CommunityPicker {
  private readonly userContext = inject(UserContextService);
  private readonly router = inject(Router);

  readonly communities = input.required<MyCommunityDTO[]>();
  readonly loading = input.required<boolean>();
  readonly failed = input.required<boolean>();
  /** Where `activeCommunityGuard` was sending the user before it bounced them here. */
  readonly returnUrl = input<string | undefined>();

  readonly retry = output<void>();

  /** The community currently being entered, for the button's busy state. */
  readonly entering = signal<string | null>(null);

  /**
   * One community is the common case, and `initializeDefaultCommunity()` has
   * already selected it — so the card is a shortcut into a context the user is
   * already in, and its label says so.
   */
  readonly isOnlyCommunity = computed(() => this.communities().length === 1);

  readonly isEmpty = computed(
    () => !this.loading() && !this.failed() && this.communities().length === 0,
  );

  enter(community: MyCommunityDTO): void {
    this.entering.set(community.auth_community_id);
    this.userContext.switchCommunity(community.auth_community_id);
    // Navigate immediately rather than awaiting the annexe catalogue. The race
    // that used to make this unsafe was fixed in `CommunityServicesStore`
    // (`loadedFor`), and blocking the most important click in the app on a
    // 300-800 ms request would still be wrong when that request fails.
    void this.router.navigateByUrl(safeReturnUrl(this.returnUrl()) ?? '/dashboard');
  }

  /** Translation key for the role, reusing the labels the rest of the app uses. */
  roleKey(community: MyCommunityDTO): string {
    return `COMMON.ROLE.${community.role}`;
  }
}
