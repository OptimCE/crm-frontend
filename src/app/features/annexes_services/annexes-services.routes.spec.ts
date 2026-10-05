import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { Role } from '../../core/dtos/role';
import { UserContextService } from '../../core/services/authorization/authorization.service';
import { CommunityServicesStore } from '../../core/services/community-services.store';
import { CommunityAnnex } from '../../shared/dtos/annexes_services.dtos';
import { ANNEXES_SERVICES_ROUTES } from './annexes-services.routes';

function annex(feature: string, subscribed: boolean): CommunityAnnex {
  return {
    feature,
    displayKey: '',
    descriptionKey: '',
    icon: '',
    minRole: Role.GESTIONNAIRE,
    frontendRoute: `/annexes-services/${feature}`,
    subscribePath: '',
    unsubscribePath: '',
    subscribed,
  };
}

describe('ANNEXES_SERVICES_ROUTES', () => {
  /**
   * Navigates through the real route objects, mounted where app.routes.ts mounts
   * them, and returns where the router ended up. The parent route's own guards
   * (auth, the MEMBER floor) are not under test. No outlet is rendered, so the
   * hubs are never instantiated.
   */
  async function navigate(
    url: string,
    catalog: CommunityAnnex[],
    isManager = true,
  ): Promise<string> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', pathMatch: 'full', children: [] },
          { path: 'annexes-services', children: ANNEXES_SERVICES_ROUTES },
        ]),
        { provide: CommunityServicesStore, useValue: { ensureLoaded: () => of(catalog) } },
        { provide: UserContextService, useValue: { compareWithActiveRole: () => isManager } },
      ],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    return router.url;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('keeps the catalog page open with nothing subscribed, since a manager subscribes from it', async () => {
    const catalog = [annex('algorithm', false), annex('simulation', false)];

    expect(await navigate('/annexes-services', catalog)).toBe('/annexes-services');
  });

  describe.each([
    ['algorithm', 'simulation'],
    ['simulation', 'algorithm'],
  ])('/annexes-services/%s', (feature, other) => {
    const url = `/annexes-services/${feature}`;

    it('opens for a manager whose community is subscribed', async () => {
      expect(await navigate(url, [annex(feature, true)])).toBe(url);
    });

    it('redirects to / when the community is not subscribed', async () => {
      // A bookmark or a typed URL: the list never links an unsubscribed annex.
      expect(await navigate(url, [annex(feature, false), annex(other, true)])).toBe('/');
    });

    it('redirects to / when the deployment hides the annex from the catalog', async () => {
      // ANNEX_CATALOG_DISABLE and `defaultEnabled: false` drop the entry from
      // GET /annexes-services altogether. The sibling being subscribed also
      // proves the route checks its OWN feature name.
      expect(await navigate(url, [annex(other, true)])).toBe('/');
    });

    it('still requires the manager role when subscribed', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      expect(await navigate(url, [annex(feature, true)], false)).toBe('/');
    });
  });
});
