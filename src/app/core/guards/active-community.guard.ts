import { inject } from '@angular/core';
import { CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { UserContextService } from '../services/authorization/authorization.service';

/** Query parameter carrying where the user was going before being bounced. */
export const RETURN_URL_PARAM = 'returnUrl';

/**
 * The only route out of the no-active-community state.
 *
 * `/home` is both the post-login landing and the community picker, so a user
 * bounced here always sees the way in as the page's primary action.
 * `/users/communities` still exists, but it is the community MANAGEMENT page
 * (create, rename, leave) — landing an already-confused user on a filterable
 * table was the thing this workstream set out to fix.
 */
export const COMMUNITY_PICKER_URL = '/home';

/**
 * Accepts only same-origin, path-absolute URLs.
 *
 * The value ends up in `Router.navigateByUrl`, and it arrives from the query
 * string, so a crafted link could otherwise steer the user off-site:
 * `navigateByUrl('//evil.example')` is a protocol-relative URL and navigates
 * away. `/\evil.example` is the same trick with the slash browsers normalise.
 */
export function safeReturnUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//') || raw.startsWith('/\\')) return null;
  return raw;
}

/**
 * Community-scoped routes need an ACTIVE COMMUNITY, not merely a session.
 *
 * With none, `communityContextInterceptor` omits `X-Community-ID`, so
 * `contextMiddleware` leaves both `community_id` and `role` undefined and every
 * guarded route answers 400/401. Left to itself that surfaces as a bounce to
 * `/`, which tells the user nothing. This replaces it with an intentional
 * redirect to the picker that remembers where they were going.
 *
 * Synchronous and issues no HTTP, unlike `activeFeatureGuard`. Keep
 * `canActivateAuth` at index 0 of the `canActivate` array: guards there are
 * subscribed concurrently and only the first non-`true` RESULT wins, so an
 * unauthenticated deep link must resolve to `/auth` rather than to a picker that
 * would immediately bounce again.
 */
export const activeCommunityGuard: CanActivateFn = (_route, state: RouterStateSnapshot) => {
  const userContext = inject(UserContextService);
  const router = inject(Router);

  if (userContext.activeCommunityId()) return true;

  return router.createUrlTree([COMMUNITY_PICKER_URL], {
    queryParams: { [RETURN_URL_PARAM]: state.url },
  });
};
