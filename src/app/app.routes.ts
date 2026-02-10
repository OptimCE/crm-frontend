import { Routes } from '@angular/router';
import {rootDispatchGuard} from './core/guards/root_dispatch';
import {canActivateAuth, minRoleGuard} from './core/guards/can_activate';
import {Role} from './core/dtos/role';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [rootDispatchGuard],
    children: [] // No component needed, the guard handles the redirect
  },
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },
  {
    path: 'users',
    canActivate: [canActivateAuth],
    loadChildren: () =>
      import('./features/user/profile.routes').then(m =>m.PROFILE_ROUTES)
  },
  {
    path: 'keys',
    canActivate: [canActivateAuth, minRoleGuard],
    data: {minRole: Role.GESTIONNAIRE},
    loadChildren: () =>
      import('./features/allocation_key/allocation_key.routes').then(m =>m.ALLOCATION_KEY_ROUTES)
  },
  {
    path: 'members',
    canActivate: [canActivateAuth, minRoleGuard],
    data: {minRole: Role.GESTIONNAIRE},
    loadChildren: () =>
      import('./features/member/member.routes').then(m =>m.MEMBER_ROUTES)
  },
  {
    path: 'meters',
    canActivate: [canActivateAuth, minRoleGuard],
    data: {minRole: Role.GESTIONNAIRE},
    loadChildren: () =>
      import('./features/meter/meter.routes').then(m =>m.METER_ROUTES)
  },
  {
    path: 'sharing_operations',
    canActivate: [canActivateAuth, minRoleGuard],
    data: {minRole: Role.GESTIONNAIRE},
    loadChildren: () =>
      import('./features/sharing_operation/sharing_operation.routes').then(m =>m.SHARING_OPERATION_ROUTES)
  },
  {
    path: 'communities',
    canActivate: [canActivateAuth, minRoleGuard],
    data: {minRole: Role.MEMBER},
    loadChildren: () =>
      import('./features/community/community.routes').then(m =>m.COMMUNITY_ROUTES)
  },
];
