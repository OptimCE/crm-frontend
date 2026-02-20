import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { createAuthGuard, AuthGuardData } from 'keycloak-angular';

export const rootDispatchGuard = createAuthGuard((_route, _state, authData: AuthGuardData) => {
  const router = inject(Router);
  const { authenticated } = authData;

  if (authenticated) {
    return Promise.resolve(router.createUrlTree(['/users']));
  }

  return Promise.resolve(router.createUrlTree(['/auth']));
});
