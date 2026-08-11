import { Component, inject } from '@angular/core';

import { Role } from '../../../../core/dtos/role';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { ManagerDashboard } from '../manager-dashboard/manager-dashboard';
import { MemberDashboard } from '../member-dashboard/member-dashboard';

/**
 * The community dashboard: one route, two genuinely different dashboards.
 *
 * Not one tile set with hidden rows. Every manager tile reads a manager-gated
 * endpoint (`/members`, `/meters`, `/sharing_operations`, `/invitations`,
 * `/audit-logs` are all `roleChecker(GESTIONNAIRE)`), so a member rendering that
 * dashboard would 401 on every one of them. The two roles are also asking
 * different questions — "is my community healthy?" versus "what am I getting out
 * of this, and is my part in order?".
 *
 * `compareWithActiveRole` reads `activeCommunityRole()`, a computed off
 * `activeCommunityId`, so the branch re-evaluates on every community switch.
 * Role is a property of the ACTIVE COMMUNITY, never of the session: the same
 * person is MANAGER in one community and MEMBER in another.
 */
@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [ManagerDashboard, MemberDashboard],
  templateUrl: './dashboard-page.html',
})
export class DashboardPage {
  protected readonly userContext = inject(UserContextService);
  protected readonly Role = Role;
}
