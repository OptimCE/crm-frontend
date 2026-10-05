import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { config, Observable, of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ApiResponse } from '../dtos/api.response';
import { Role } from '../dtos/role';
import { communityContextInterceptor } from '../interceptors/community.context.inteceptor';
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
  /** When set, the fake backend answers with this instead of `nextCatalog`. */
  let nextResponse: Observable<ApiResponse<CommunityAnnex[]>> | null;
  let calls: number;

  function build(): CommunityServicesStore {
    activeCommunityId = signal<string | null>(null);
    activeRole = Role.GESTIONNAIRE;
    nextCatalog = [];
    nextResponse = null;
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
              return nextResponse ?? of(new ApiResponse<CommunityAnnex[]>(nextCatalog, 0));
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

  describe('when the fetch fails', () => {
    // What `service.base.ts` emits once its two retries on a 5xx are spent.
    const outage = (): Observable<never> =>
      throwError(() => new HttpErrorResponse({ status: 503 }));

    function loadOrgA(store: CommunityServicesStore): void {
      nextCatalog = [annex('billing', true, Role.MEMBER)];
      activeCommunityId.set('org-a');
      store.ensureLoaded().subscribe();
      expect(store.isActive('billing')).toBe(true);
    }

    it("drops the previous community's catalog when the fetch after a switch fails", () => {
      const store = build();
      loadOrgA(store);

      nextResponse = outage();
      activeCommunityId.set('org-b');
      let failure: unknown = null;
      store.ensureLoaded().subscribe({ error: (e: unknown) => (failure = e) });

      // The regression: org-a's catalog stayed in the signal, so the navbar,
      // dashboards and cross-links kept offering org-a's billing inside org-b.
      expect(store.services()).toEqual([]);
      expect(store.isActive('billing')).toBe(false);
      expect(store.canReach('billing')).toBe(false);
      // Still an error to the caller: activeFeatureGuard redirects on it and the
      // annexes page raises its toast.
      expect(failure).toBeInstanceOf(HttpErrorResponse);
    });

    it('drops it on the background prefetch too, without an unhandled error', async () => {
      const unhandled = vi.fn();
      config.onUnhandledError = unhandled;
      try {
        const store = build();
        loadOrgA(store);
        TestBed.tick(); // the effect sees org-a already loaded: no request

        nextResponse = outage();
        activeCommunityId.set('org-b');
        TestBed.tick(); // the effect's prefetch for org-b, with nobody else asking
        // rxjs reports an unhandled error from a timer: let it fire.
        await new Promise((resolve) => setTimeout(resolve));

        expect(calls).toBe(2);
        expect(store.services()).toEqual([]);
        expect(store.isActive('billing')).toBe(false);
        expect(unhandled).not.toHaveBeenCalled();
      } finally {
        config.onUnhandledError = null;
      }
    });

    it('fetches again on the next ensureLoaded() and recovers', () => {
      const store = build();
      loadOrgA(store);
      nextResponse = outage();
      activeCommunityId.set('org-b');
      store.ensureLoaded().subscribe({ error: () => undefined });

      // The failure must not mark org-b loaded, or the empty catalog would stick.
      nextResponse = null;
      nextCatalog = [annex('news', true, Role.MEMBER)];
      store.ensureLoaded().subscribe();

      expect(calls).toBe(3);
      expect(store.isActive('news')).toBe(true);
      expect(store.isActive('billing')).toBe(false);
    });

    it('leaves the newly active community alone when a request for the old one fails late', () => {
      const store = build();
      const orgARequest = new Subject<ApiResponse<CommunityAnnex[]>>();
      nextResponse = orgARequest;
      activeCommunityId.set('org-a');
      store.ensureLoaded().subscribe({ error: () => undefined });

      nextResponse = null;
      nextCatalog = [annex('billing', true, Role.MEMBER)];
      activeCommunityId.set('org-b');
      store.ensureLoaded().subscribe();
      expect(store.isActive('billing')).toBe(true);

      orgARequest.error(new HttpErrorResponse({ status: 503 }));

      expect(store.isActive('billing')).toBe(true);
      store.ensureLoaded().subscribe();
      expect(calls).toBe(2); // org-b is still loaded
    });

    it('leaves no catalog behind when reload() fails either', () => {
      // reload() runs after a subscription change, so the catalog it would have
      // replaced is known to be out of date: keeping it would advertise the
      // module just switched off.
      const store = build();
      loadOrgA(store);

      nextResponse = outage();
      let failed = false;
      store.reload().subscribe({ error: () => (failed = true) });

      expect(failed).toBe(true);
      expect(store.services()).toEqual([]);
      expect(store.isActive('billing')).toBe(false);
    });
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

  describe('switching while a catalogue request is in flight', () => {
    // The REAL AnnexesServicesService and interceptor, deliberately: the race
    // lives in `ServiceBase.cachedGet`'s in-flight map and in when the
    // interceptor stamps X-Community-ID, both of which the fake above skips.
    let store: CommunityServicesStore;
    let http: HttpTestingController;

    beforeEach(() => {
      activeCommunityId = signal<string | null>(null);
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(withInterceptors([communityContextInterceptor])),
          provideHttpClientTesting(),
          {
            provide: UserContextService,
            useValue: { activeCommunityId, compareWithActiveRole: () => true },
          },
        ],
      });
      store = TestBed.inject(CommunityServicesStore);
      http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
      http.verify();
    });

    /** Takes every pending catalogue request; each test answers all it takes. */
    function catalogRequests(): TestRequest[] {
      return http.match((r) => r.method === 'GET' && r.url.endsWith('/annexes-services'));
    }

    /** The community the backend resolves a request for: the header it receives. */
    function communityOf(request: TestRequest): string | null {
      return request.request.headers.get('X-Community-ID');
    }

    function answer(request: TestRequest, catalog: CommunityAnnex[]): void {
      request.flush(new ApiResponse<CommunityAnnex[]>(catalog, 0));
    }

    it("does not hand the newly active community the previous one's catalogue", () => {
      activeCommunityId.set('org-a');
      store.ensureLoaded().subscribe();
      activeCommunityId.set('org-b');
      let served: CommunityAnnex[] | null = null;
      store.ensureLoaded().subscribe((services) => (served = services));

      // The regression: org-b's fetch joined org-a's request (one request,
      // stamped org-a), took org-a's answer as its own and marked org-b loaded.
      const requests = catalogRequests();
      expect(requests.map(communityOf)).toEqual(['org-a', 'org-b']);
      const [orgA, orgB] = requests;

      answer(orgA, [annex('billing', true, Role.MEMBER)]);
      expect(store.isActive('billing')).toBe(false);
      expect(served).toBeNull(); // e.g. activeFeatureGuard: still waiting for org-b

      answer(orgB, [annex('news', true, Role.MEMBER)]);
      expect(served).toEqual([annex('news', true, Role.MEMBER)]);
      expect(store.isActive('news')).toBe(true);
      expect(store.isActive('billing')).toBe(false);

      // Loaded from its OWN answer, so no refetch is needed.
      store.ensureLoaded().subscribe();
      expect(catalogRequests()).toEqual([]);
    });

    it('holds for the background prefetch too (the app-boot path)', () => {
      activeCommunityId.set('org-a');
      TestBed.tick(); // the effect prefetches the default community
      activeCommunityId.set('org-b'); // picked on /home before that answered
      TestBed.tick();

      const requests = catalogRequests();
      expect(requests.map(communityOf)).toEqual(['org-a', 'org-b']);
      const [orgA, orgB] = requests;
      answer(orgA, [annex('billing', true, Role.MEMBER)]);
      answer(orgB, [annex('billing', false, Role.MEMBER)]);

      expect(store.isActive('billing')).toBe(false);
    });

    it('keeps the new community loaded when the previous one answers after it', () => {
      activeCommunityId.set('org-a');
      store.ensureLoaded().subscribe();
      activeCommunityId.set('org-b');
      store.ensureLoaded().subscribe();
      const requests = catalogRequests();
      expect(requests.map(communityOf)).toEqual(['org-a', 'org-b']);
      const [orgA, orgB] = requests;

      answer(orgB, [annex('news', true, Role.MEMBER)]);
      answer(orgA, [annex('billing', true, Role.MEMBER)]);

      // A late answer for a community no longer active must not touch the
      // store: emptying it here would blank the navbar with nothing to refill
      // it, since the effect only re-runs on the next switch.
      expect(store.isActive('news')).toBe(true);
      expect(store.isActive('billing')).toBe(false);
      store.ensureLoaded().subscribe();
      expect(catalogRequests()).toEqual([]);
    });

    it('re-sends a retried request for the community it was issued for', () => {
      vi.useFakeTimers();
      try {
        activeCommunityId.set('org-a');
        store.ensureLoaded().subscribe({ error: () => undefined });
        catalogRequests()[0].flush(null, { status: 503, statusText: 'Service Unavailable' });

        // The user switches while `cachedGet`'s retry waits out its back-off.
        activeCommunityId.set('org-b');
        vi.advanceTimersByTime(1_000);

        // The interceptor stamps the community active when a request is SENT,
        // and a retry is sent again: unpinned, it would ask for org-b and
        // cache the answer under org-a's key.
        const [retried] = catalogRequests();
        expect(communityOf(retried)).toBe('org-a');
        answer(retried, [annex('billing', true, Role.MEMBER)]);
        expect(store.isActive('billing')).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
