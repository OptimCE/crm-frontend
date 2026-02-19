import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { createAuthGuard, AuthGuardData } from 'keycloak-angular';

export const rootDispatchGuard = createAuthGuard(async (route, state, authData: AuthGuardData) => {
  const router = inject(Router);
  const { authenticated } = authData;

  // Logic: If connected -> Profile, Else -> Auth
  if (authenticated) {
    return router.createUrlTree(['/users']);
  } else {
    return router.createUrlTree(['/auth']);
  }
});
