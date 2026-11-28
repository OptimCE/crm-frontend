import { Routes } from '@angular/router';
import { UsersCommunityList } from './components/users-community-list/users-community-list';
import { ManagersCommunityList } from './components/managers-community-list/managers-community-list';
import { PublicCommunityList } from './components/public-community-list/public-community-list';
import { CommunityInfo } from './components/community-info/community-info';
import { canActivateAuth, minRoleGuard } from '../../core/guards/can_activate';
import { Role } from '../../core/dtos/role';

export const COMMUNITY_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'public',
    pathMatch: 'full',
  },
  {
    path: 'info',
    canActivate: [canActivateAuth, minRoleGuard],
    data: { minRole: Role.MEMBER },
    component: CommunityInfo,
  },
  {
    path: 'users',
    canActivate: [canActivateAuth, minRoleGuard],
    data: { minRole: Role.GESTIONNAIRE },
    component: UsersCommunityList,
  },
  {
    // The community's data exports: ADMIN only, the API refuses a manager (35001).
    path: 'exports',
    canActivate: [canActivateAuth, minRoleGuard],
    data: { minRole: Role.ADMIN },
    loadComponent: () =>
      import('../data_export/components/community-exports/community-exports').then(
        (m) => m.CommunityExports,
      ),
  },
  {
    path: 'managers',
    component: ManagersCommunityList,
  },
  {
    path: 'public',
    component: PublicCommunityList,
  },
];
