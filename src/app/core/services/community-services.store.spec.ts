import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ApiResponse } from '../dtos/api.response';
import { Role } from '../dtos/role';
import { CommunityAnnex } from '../../shared/dtos/annexes_services.dtos';
import { AnnexesServicesService } from '../../shared/services/annexes_services.service';
import { ROLE_HIERARCHY, UserContextService } from './authorization/authorization.service';
import { CacheService } from './cache/cache.service';
import { CommunityServicesStore } from './community-services.store';

function annex(feature: string, subscribed: boolean, minRole: Role): CommunityAnnex {
  return {
    feature,
    subscribed,
    minRole,
    displayKey: `ANNEXES_SERVICES.${feature}.NAME`,
    descriptionKey: `ANNEXES_SERVICES.${feature}.DESCRIPTION`,
    icon: 'pi pi-box',
    frontendRoute: `/${feature}`,
    subscribePath: `/annexes-services/${feature}/subscribe`,
    unsubscribePath: `/annexes-services/${feature}/unsubscribe`,
  };
}

describe('CommunityServicesStore', () => {
  let activeCommunityId: WritableSignal<string | null>;
  let activeRole: Role | null;
  /** Catalog the fake backend returns next, keyed by nothing — see `calls`. */
  let nextCatalog: CommunityAnnex[];
  let calls: number;

  function build(): CommunityServicesStore {
    activeCommunityId = signal<string | null>(null);
    activeRole = Role.GESTIONNAIRE;
    nextCatalog = [];
    calls = 0;

    TestBed.configureTestingModule({
      providers: [
        CacheService,
        {
          provide: UserContextService,
          useValue: {
            activeCommunityId,
            // Uses the real hierarchy so the fake cannot drift from the service.
            compareWithActiveRole: (role: Role) =>
              activeRole !== null && ROLE_HIERARCHY[activeRole] >= ROLE_HIERARCHY[role],
          },
        },
        {
          provide: AnnexesServicesService,
          useValue: {
            getCommunityServices: () => {
              calls += 1;
              return of(new ApiResponse<CommunityAnnex[]>(nextCatalog, 0));
            },
          },
        },
      ],
    });
    return TestBed.inject(CommunityServicesStore);
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('serves the new community immediately after a switch, without waiting for an effect', () => {
    const store = build();

    nextCatalog = [annex('billing', true, Role.MEMBER)];
    activeCommunityId.set('org-a');
    store.ensureLoaded().subscribe();
    expect(store.isActive('billing')).toBe(true);

    // The regression: `loaded` used to be reset inside a signal effect, which runs
    // at change detection rather than at .set() time — so this call resolved from
    // the PREVIOUS community's catalog. `joinCommunity()` navigating straight to
    // /dashboard makes that reachable on the most important click in the app.
    nextCatalog = [annex('billing', false, Role.MEMBER)];
    activeCommunityId.set('org-b');
    store.ensureLoaded().subscribe();

    expect(store.isActive('billing')).toBe(false);
    expect(calls).toBe(2);
  });

  it('does not refetch while the community is unchanged', () => {
    const store = build();
    nextCatalog = [annex('news', true, Role.MEMBER)];
    activeCommunityId.set('org-a');

    store.ensureLoaded().subscribe();
    store.ensureLoaded().subscribe();
    store.ensureLoaded().subscribe();

    expect(calls).toBe(1);
  });

  it('reports an empty catalog and issues no request with no active community', () => {
    const store = build();
    let emitted: CommunityAnnex[] | null = null;
    store.ensureLoaded().subscribe((v) => (emitted = v));

    expect(emitted).toEqual([]);
    expect(calls).toBe(0);
    expect(store.isActive('billing')).toBe(false);
  });

  describe('canReach', () => {
    it('is false for a subscribed annexe whose minRole the active role does not clear', () => {
      const store = build();
      nextCatalog = [annex('administrative-document', true, Role.GESTIONNAIRE)];
      activeCommunityId.set('org-a');
      store.ensureLoaded().subscribe();

      activeRole = Role.MEMBER;
      // A link rendered here would bounce off minRoleGuard to `/` → `/users`.
      expect(store.canReach('administrative-document')).toBe(false);
      expect(store.isActive('administrative-document')).toBe(true);

      activeRole = Role.GESTIONNAIRE;
      expect(store.canReach('administrative-document')).toBe(true);
    });

    it('is false for an unsubscribed annexe even when the role clears', () => {
      const store = build();
      nextCatalog = [annex('billing', false, Role.MEMBER)];
      activeCommunityId.set('org-a');
      store.ensureLoaded().subscribe();

      activeRole = Role.ADMIN;
      expect(store.canReach('billing')).toBe(false);
    });

    it('is false for an unknown feature and while the catalog is still empty', () => {
      const store = build();
      expect(store.canReach('billing')).toBe(false);
      expect(store.canReach('not-a-feature')).toBe(false);
    });
  });
});
