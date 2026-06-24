import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { CommunityServicesStore } from '../services/community-services.store';

/**
 * Allows access when the given annex feature is subscribed for the active
 * community — for ANY member (not role-gated; cf. `minRoleGuard`). On a missing
 * subscription or a load error, redirects to the app root.
 */
export function activeFeatureGuard(feature: string): CanActivateFn {
  return () => {
    const store = inject(CommunityServicesStore);
    const router = inject(Router);

    return store.ensureLoaded().pipe(
      map((services) =>
        services.some((s) => s.feature === feature && s.subscribed)
          ? true
          : router.createUrlTree(['/']),
      ),
      catchError(() => of(router.createUrlTree(['/']))),
    );
  };
}
