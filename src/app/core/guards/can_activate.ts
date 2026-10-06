import { createAuthGuard, AuthGuardData } from 'keycloak-angular';
import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { UserContextService } from '../services/authorization/authorization.service';
import { Role } from '../dtos/role';
import { RETURN_URL_PARAM } from './active-community.guard';

export const canActivateAuth = createAuthGuard((_route, state, authData: AuthGuardData) => {
  const router = inject(Router);
  const { authenticated } = authData;

  if (!authenticated) {
    // Remember where the visitor was going: the login page hands it to Keycloak
    // as the redirect. Without it every deep link — the public website's
    // `/users/communities?create=1` among them — ended up on `/home` after login.
    return Promise.resolve(
      router.createUrlTree(['/auth'], { queryParams: { [RETURN_URL_PARAM]: state.url } }),
    );
  }

  const userContext = inject(UserContextService);
  userContext.refreshUserContext();
  return Promise.resolve(true);
});

export const minRoleGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
) => {
  const userContext = inject(UserContextService);
  const router = inject(Router);

  const requiredRole = route.data['minRole'] as Role;

  if (!requiredRole) {
    return true;
  }

  const hasPermission = userContext.compareWithActiveRole(requiredRole);

  if (hasPermission) {
    return true;
  }

  console.warn(`Access denied: User role is insufficient for ${state.url}`);
  return router.createUrlTree(['/']);
};
