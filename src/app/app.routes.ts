import { Routes } from '@angular/router';
import { rootDispatchGuard } from './core/guards/root_dispatch';
import { canActivateAuth, minRoleGuard } from './core/guards/can_activate';
import { activeFeatureGuard } from './core/guards/active-feature.guard';
import { activeCommunityGuard } from './core/guards/active-community.guard';
import { Role } from './core/dtos/role';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [rootDispatchGuard],
    children: [], // No component needed, the guard handles the redirect
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    // The post-login landing, and the only route out of the
    // no-active-community state — so it must NOT carry `activeCommunityGuard`,
    // which redirects here. Every read on it is user-scoped.
    path: 'home',
    canActivate: [canActivateAuth],
    loadChildren: () => import('./features/home/home.routes').then((m) => m.HOME_ROUTES),
  },
  {
    path: 'users',
    canActivate: [canActivateAuth],
    loadChildren: () => import('./features/user/profile.routes').then((m) => m.PROFILE_ROUTES),
  },
  {
    // The landing page for "inside a community". One route, two genuinely
    // different dashboards chosen by the active community's role — not one set
    // with hidden rows, because every manager tile reads a manager-gated
    // endpoint that would 401 for a member.
    //
    // Ordering is load-bearing: canActivateAuth must stay at index 0 so an
    // unauthenticated deep link resolves to /auth rather than to the community
    // picker, which would bounce it straight back.
    path: 'dashboard',
    canActivate: [canActivateAuth, activeCommunityGuard],
    loadChildren: () =>
      import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
  },
  {
    path: 'keys',
    canActivate: [canActivateAuth, minRoleGuard],
    data: { minRole: Role.GESTIONNAIRE },
    loadChildren: () =>
      import('./features/allocation_key/allocation_key.routes').then(
        (m) => m.ALLOCATION_KEY_ROUTES,
      ),
  },
  {
    path: 'members',
    canActivate: [canActivateAuth, minRoleGuard],
    data: { minRole: Role.GESTIONNAIRE },
    loadChildren: () => import('./features/member/member.routes').then((m) => m.MEMBER_ROUTES),
  },
  {
    path: 'meters',
    canActivate: [canActivateAuth, minRoleGuard],
    data: { minRole: Role.GESTIONNAIRE },
    loadChildren: () => import('./features/meter/meter.routes').then((m) => m.METER_ROUTES),
  },
  {
    path: 'sharing_operations',
    canActivate: [canActivateAuth, minRoleGuard],
    data: { minRole: Role.GESTIONNAIRE },
    loadChildren: () =>
      import('./features/sharing_operation/sharing_operation.routes').then(
        (m) => m.SHARING_OPERATION_ROUTES,
      ),
  },
  {
    path: 'audit-logs',
    canActivate: [canActivateAuth, minRoleGuard],
    data: { minRole: Role.GESTIONNAIRE },
    loadChildren: () =>
      import('./features/audit_log/audit-log.routes').then((m) => m.AUDIT_LOG_ROUTES),
  },
  {
    path: 'communities',
    canActivate: [canActivateAuth],
    loadChildren: () =>
      import('./features/community/community.routes').then((m) => m.COMMUNITY_ROUTES),
  },
  {
    path: 'notifications',
    canActivate: [canActivateAuth],
    loadChildren: () =>
      import('./features/notifications/notifications.routes').then((m) => m.NOTIFICATIONS_ROUTES),
  },
  {
    path: 'annexes-services',
    canActivate: [canActivateAuth, minRoleGuard],
    data: { minRole: Role.MEMBER },
    loadChildren: () =>
      import('./features/annexes_services/annexes-services.routes').then(
        (m) => m.ANNEXES_SERVICES_ROUTES,
      ),
  },
  {
    path: 'news',
    canActivate: [canActivateAuth, activeFeatureGuard('news')],
    loadChildren: () => import('./features/news/news.routes').then((m) => m.NEWS_ROUTES),
  },
  {
    path: 'billing',
    canActivate: [canActivateAuth, activeFeatureGuard('billing')],
    loadChildren: () => import('./features/billing/billing.routes').then((m) => m.BILLING_ROUTES),
  },
  {
    // Subscription-gated only, exactly like billing — the annex catalog now sets
    // minRole MEMBER because members have a read of their own here ("what has
    // been filed about me"). The role split happens INSIDE the hub, and every
    // manager-only read is gated server-side with `manager_only`; the guard was
    // never the protection.
    path: 'administrative-document',
    canActivate: [canActivateAuth, activeFeatureGuard('administrative-document')],
    loadChildren: () =>
      import('./features/administrative_document/administrative-document.routes').then(
        (m) => m.ADMINISTRATIVE_DOCUMENT_ROUTES,
      ),
  },
];
