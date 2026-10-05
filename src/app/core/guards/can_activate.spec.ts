import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import Keycloak from 'keycloak-js';
import { vi } from 'vitest';

import { UserContextService } from '../services/authorization/authorization.service';
import { canActivateAuth } from './can_activate';

describe('canActivateAuth', () => {
  let refreshUserContext: ReturnType<typeof vi.fn>;

  function run(url: string, authenticated: boolean): Promise<boolean | UrlTree> {
    refreshUserContext = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Keycloak, useValue: { authenticated } },
        { provide: UserContextService, useValue: { refreshUserContext } },
      ],
    });
    return TestBed.runInInjectionContext(() =>
      canActivateAuth({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    ) as Promise<boolean | UrlTree>;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('sends a visitor who is not logged in to /auth, remembering where they were going', async () => {
    const result = await run('/users/communities?create=1', false);

    expect(result).toBeInstanceOf(UrlTree);
    // Without the returnUrl, login always came back to `/`, and the public
    // website could not link to anything deeper than the landing page.
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe(
      '/auth?returnUrl=%2Fusers%2Fcommunities%3Fcreate%3D1',
    );
  });

  it('lets a logged-in user through and refreshes their context', async () => {
    expect(await run('/users/communities', true)).toBe(true);
    expect(refreshUserContext).toHaveBeenCalled();
  });
});
