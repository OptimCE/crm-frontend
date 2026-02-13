import { Routes } from '@angular/router';
import { UsersCommunityList } from './components/users-community-list/users-community-list';
import { ManagersCommunityList } from './components/managers-community-list/managers-community-list';
import { canActivateAuth, minRoleGuard } from '../../core/guards/can_activate';
import { Role } from '../../core/dtos/role';

export const COMMUNITY_ROUTES: Routes = [
  {
    path: 'users',
    canActivate: [canActivateAuth, minRoleGuard],
    data: { minRole: Role.GESTIONNAIRE },
    component: UsersCommunityList,
  },
  {
    path: 'managers',
    component: ManagersCommunityList,
  },
];
