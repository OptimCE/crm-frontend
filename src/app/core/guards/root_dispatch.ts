import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { createAuthGuard, AuthGuardData } from 'keycloak-angular';

export const rootDispatchGuard = createAuthGuard((_route, _state, authData: AuthGuardData) => {
  const router = inject(Router);
  const { authenticated } = authData;

  if (authenticated) {
    // `/home`, not `/users` (the profile FORM). This is also where every failed
    // guard lands, because `minRoleGuard` and `activeFeatureGuard` redirect to
    // `/` — so the fallback destination is now a page that explains itself and
    // offers the way back in, rather than an edit form.
    return Promise.resolve(router.createUrlTree(['/home']));
  }

  return Promise.resolve(router.createUrlTree(['/auth']));
});
