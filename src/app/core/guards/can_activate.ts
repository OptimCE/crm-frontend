import { createAuthGuard, AuthGuardData } from 'keycloak-angular';
import { inject } from '@angular/core';
import {ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot} from '@angular/router';
import {UserContextService} from '../services/authorization/authorization.service';
import {Role} from '../dtos/role';

export const canActivateAuth = createAuthGuard(
  async (route, state, authData: AuthGuardData) => {

    const router = inject(Router);
    const { authenticated } = authData;

    if (!authenticated) {
        return router.createUrlTree(['/auth']);
    }
    const userContext = inject(UserContextService);
    userContext.refreshUserContext();
    return true;
  }
);

export const minRoleGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
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
