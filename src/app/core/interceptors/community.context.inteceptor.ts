import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { UserContextService } from '../services/authorization/authorization.service';

/**
 * Pins a single request to a specific community, overriding the active one.
 *
 * The user dashboard fans out across every community the user belongs to, and
 * annexe endpoints resolve their tenant from `X-Community-ID` — so without this
 * there is no way to ask community B a question while A is active. This
 * interceptor used to clone with `setHeaders` unconditionally, and
 * `req.clone({ setHeaders })` wins over anything the caller set, so overriding
 * the header at the call site was impossible.
 *
 * A context token rather than "yield when the header is already set": it is
 * explicit at the call site and cannot be triggered by accident.
 *
 * ```ts
 * this.http.get(url, { context: new HttpContext().set(COMMUNITY_ID, orgId) });
 * ```
 */
export const COMMUNITY_ID = new HttpContextToken<string | null>(() => null);

export const communityContextInterceptor: HttpInterceptorFn = (req, next) => {
  const userContext = inject(UserContextService);
  const communityId = req.context.get(COMMUNITY_ID) ?? userContext.activeCommunityId();

  // No pinned community and none active: omit the header entirely. The backend
  // then leaves `community_id` and `role` undefined, which is exactly what the
  // user-scoped `/me/*` and `/notifications` routes expect.
  if (!communityId) return next(req);

  return next(req.clone({ setHeaders: { 'X-Community-ID': communityId } }));
};
