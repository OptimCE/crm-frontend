import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Route,
  Router,
  RouterStateSnapshot,
  Routes,
} from '@angular/router';
import { firstValueFrom, isObservable, of } from 'rxjs';

import { Role } from '../../core/dtos/role';
import { routes } from '../../app.routes';
import { canActivateAuth, minRoleGuard } from '../../core/guards/can_activate';
import { CommunityServicesStore } from '../../core/services/community-services.store';
import {
  ROLE_HIERARCHY,
  UserContextService,
} from '../../core/services/authorization/authorization.service';
import realManifest from '../../../../public/tours/tours.manifest.json';
import { isOnboardingTourId, ONBOARDING_TOURS } from '../onboarding/onboarding-tours';
import {
  ENTRY_ROUTES,
  filterSelection,
  HIDDEN_TOURS,
  matchEntryRoute,
  PAGE_ONLY,
  personaMatches,
  routeAllows,
  selectTours,
  TOUR_AREAS,
  TourContext,
  TourManifest,
  TourManifestEntry,
  TourSelection,
} from './tour-catalog';

const ALL_FEATURES = new Set([
  'algorithm',
  'simulation',
  'news',
  'billing',
  'live-data',
  'administrative-document',
]);

function tour(id: string, role: string, route: string, titleFr = id): TourManifestEntry {
  return { id, role, entry: { route }, title: { fr: titleFr, en: `${titleFr} (en)` } };
}

function ctx(overrides: Partial<TourContext> = {}): TourContext {
  return { role: Role.GESTIONNAIRE, activeFeatures: new Set(), url: '/home', ...overrides };
}

function ids(selection: TourSelection): { here: string[]; elsewhere: string[] } {
  return {
    here: selection.onThisPage.map((t) => t.id),
    elsewhere: selection.byArea.flatMap((g) => g.tours.map((t) => t.id)),
  };
}

const FIXTURE: TourManifest = {
  defaultLocale: 'fr',
  tours: [
    tour('home-overview', 'member', '/home'),
    tour('dashboard-manager-tour', 'admin', '/home'),
    tour('key-create-wizard', 'admin', '/keys'),
    tour('news-create', 'admin', '/news'),
    tour('billing-member-view', 'member', '/billing'),
    tour('algorithm-generate', 'admin', '/annexes-services/algorithm'),
    tour('member-document-upload', 'admin', '/members/:memberId'),
    tour('meter-deactivate', 'admin', '/meters/:meterEan'),
    tour('meter-address-repair', 'admin', '/meters'),
    tour('meter-update', 'admin', '/meters'),
    tour('community-managers-view', 'member', '/communities/managers'),
    tour('unknown-route-tour', 'admin', '/nowhere'),
  ],
};

describe('personaMatches', () => {
  it('should give member tours to members only', () => {
    expect(personaMatches('member', Role.MEMBER)).toBe(true);
    expect(personaMatches('member', Role.GESTIONNAIRE)).toBe(false);
    expect(personaMatches('member', Role.ADMIN)).toBe(false);
  });

  it('should give admin tours to managers and admins', () => {
    expect(personaMatches('admin', Role.GESTIONNAIRE)).toBe(true);
    expect(personaMatches('admin', Role.ADMIN)).toBe(true);
    expect(personaMatches('admin', Role.MEMBER)).toBe(false);
  });

  it('should give nothing without an active community', () => {
    expect(personaMatches('member', null)).toBe(false);
    expect(personaMatches('admin', null)).toBe(false);
  });

  it('should refuse a persona it does not know', () => {
    expect(personaMatches('auditor', Role.ADMIN)).toBe(false);
  });
});

describe('routeAllows', () => {
  it('should compare the minimum role by hierarchy', () => {
    const rule = { area: 'keys' as const, minRole: Role.GESTIONNAIRE };
    expect(routeAllows(rule, ctx({ role: Role.MEMBER }))).toBe(false);
    expect(routeAllows(rule, ctx({ role: Role.GESTIONNAIRE }))).toBe(true);
    expect(routeAllows(rule, ctx({ role: Role.ADMIN }))).toBe(true);
    expect(routeAllows(rule, ctx({ role: null }))).toBe(false);
  });

  it('should require the feature subscription', () => {
    const rule = { area: 'news' as const, feature: 'news' };
    expect(routeAllows(rule, ctx())).toBe(false);
    expect(routeAllows(rule, ctx({ activeFeatures: new Set(['news']) }))).toBe(true);
  });

  it('should require both the role and the feature when the route has both', () => {
    const rule = ENTRY_ROUTES['/annexes-services/simulation'];
    expect(routeAllows(rule, ctx({ role: Role.MEMBER, activeFeatures: ALL_FEATURES }))).toBe(false);
    expect(routeAllows(rule, ctx({ role: Role.GESTIONNAIRE }))).toBe(false);
    expect(routeAllows(rule, ctx({ activeFeatures: new Set(['simulation']) }))).toBe(true);
  });
});

describe('matchEntryRoute', () => {
  it('should read the params of a matching path', () => {
    expect(matchEntryRoute('/members/:memberId', '/members/42')).toEqual({ memberId: '42' });
  });

  it('should match a static route with no params', () => {
    expect(matchEntryRoute('/keys', '/keys')).toEqual({});
  });

  it('should ignore the query, the fragment and a trailing slash', () => {
    expect(
      matchEntryRoute('/meters/:meterEan', '/meters/541448820000000001/?tab=future#x'),
    ).toEqual({
      meterEan: '541448820000000001',
    });
  });

  it('should decode an encoded segment', () => {
    expect(matchEntryRoute('/members/:memberId', '/members/a%20b')).toEqual({ memberId: 'a b' });
  });

  it('should refuse a different segment count or literal', () => {
    expect(matchEntryRoute('/members/:memberId', '/members')).toBeNull();
    expect(matchEntryRoute('/annexes-services', '/annexes-services/algorithm')).toBeNull();
    expect(matchEntryRoute('/communities/info', '/communities/users')).toBeNull();
  });

  it('should refuse a malformed escape instead of throwing', () => {
    expect(matchEntryRoute('/members/:memberId', '/members/%E0%A4%A')).toBeNull();
  });
});

describe('selectTours', () => {
  it('should offer a manager the admin tours their guards allow', () => {
    const { here, elsewhere } = ids(selectTours(FIXTURE, ctx({ url: '/home' }), 'fr'));
    expect(here).toEqual(['dashboard-manager-tour']);
    expect(elsewhere).toEqual(['key-create-wizard', 'meter-update']);
  });

  it('should offer a member the member tours only', () => {
    const selection = selectTours(
      FIXTURE,
      ctx({ role: Role.MEMBER, activeFeatures: ALL_FEATURES, url: '/users' }),
      'fr',
    );
    expect(ids(selection)).toEqual({
      here: [],
      elsewhere: ['home-overview', 'community-managers-view', 'billing-member-view'],
    });
  });

  it('should offer nothing without an active community', () => {
    expect(
      ids(selectTours(FIXTURE, ctx({ role: null, activeFeatures: ALL_FEATURES }), 'fr')),
    ).toEqual({
      here: [],
      elsewhere: [],
    });
  });

  it('should hide a tour whose annex the community is not subscribed to', () => {
    const without = ids(selectTours(FIXTURE, ctx(), 'fr')).elsewhere;
    const withNews = ids(
      selectTours(FIXTURE, ctx({ activeFeatures: new Set(['news']) }), 'fr'),
    ).elsewhere;
    expect(without).not.toContain('news-create');
    expect(withNews).toContain('news-create');
    expect(withNews).not.toContain('algorithm-generate');
  });

  it('should offer a param tour only on its own page, with the params from the URL', () => {
    expect(ids(selectTours(FIXTURE, ctx({ url: '/members' }), 'fr')).elsewhere).not.toContain(
      'member-document-upload',
    );

    const selection = selectTours(FIXTURE, ctx({ url: '/members/17' }), 'fr');
    expect(selection.onThisPage).toEqual([
      {
        id: 'member-document-upload',
        title: 'member-document-upload',
        area: 'members',
        params: { memberId: '17' },
      },
    ]);
    expect(ids(selection).elsewhere).not.toContain('member-document-upload');
  });

  it('should offer meter-address-repair on the map view only', () => {
    const list = ids(selectTours(FIXTURE, ctx({ url: '/meters' }), 'fr'));
    expect(list.here).toEqual(['meter-update']);
    expect(list.elsewhere).not.toContain('meter-address-repair');

    const map = ids(selectTours(FIXTURE, ctx({ url: '/meters?view=map' }), 'fr'));
    expect(map.here).toEqual(['meter-address-repair', 'meter-update']);
  });

  it('should list a tour of the current page only under "on this page"', () => {
    const { here, elsewhere } = ids(selectTours(FIXTURE, ctx({ url: '/keys' }), 'fr'));
    expect(here).toEqual(['key-create-wizard']);
    expect(elsewhere).not.toContain('key-create-wizard');
  });

  it('should hide a listed broken tour while its entry is still the broken one', () => {
    const hidden = { 'key-create-wizard': { entry: '/keys', reason: 'test' } };
    const all = ctx({ role: Role.ADMIN, activeFeatures: ALL_FEATURES, url: '/keys' });
    const hiddenNow = ids(selectTours(FIXTURE, all, 'fr', hidden));
    expect([...hiddenNow.here, ...hiddenNow.elsewhere]).not.toContain('key-create-wizard');

    const regenerated = { 'key-create-wizard': { entry: '/keys/:keyId', reason: 'test' } };
    expect(ids(selectTours(FIXTURE, all, 'fr', regenerated)).here).toContain('key-create-wizard');
  });

  it('should hide a tour whose entry route is not in the table', () => {
    const { here, elsewhere } = ids(
      selectTours(FIXTURE, ctx({ role: Role.ADMIN, activeFeatures: ALL_FEATURES }), 'fr'),
    );
    expect([...here, ...elsewhere]).not.toContain('unknown-route-tour');
  });

  it('should title tours in the language asked, else the default locale', () => {
    const entry = tour('key-create-wizard', 'admin', '/keys', 'Modifier une clé');
    const manifest: TourManifest = { defaultLocale: 'fr', tours: [entry] };
    expect(selectTours(manifest, ctx(), 'en').byArea[0].tours[0].title).toBe(
      'Modifier une clé (en)',
    );
    expect(selectTours(manifest, ctx(), 'de').byArea[0].tours[0].title).toBe('Modifier une clé');
  });

  it('should order the areas like the sidebar and the tours by title', () => {
    const manifest: TourManifest = {
      defaultLocale: 'fr',
      tours: [
        tour('b', 'admin', '/meters', 'Zèbre'),
        tour('a', 'admin', '/meters', 'Écrire'),
        tour('c', 'admin', '/keys', 'Clé'),
        tour('d', 'admin', '/users', 'Profil'),
      ],
    };
    const selection = selectTours(manifest, ctx(), 'fr');
    expect(selection.byArea.map((g) => g.area)).toEqual(['profile', 'keys', 'meters']);
    expect(selection.byArea[2].tours.map((t) => t.title)).toEqual(['Écrire', 'Zèbre']);
    expect(selection.byArea[1].label).toBe('NAVBAR.HANDLE_KEY');
  });
});

describe('filterSelection', () => {
  const manifest: TourManifest = {
    defaultLocale: 'fr',
    tours: [
      tour('gen', 'admin', '/keys', 'Générer des clés'),
      tour('edit', 'admin', '/keys', 'Modifier une clé'),
      tour('meter', 'admin', '/meters', 'Créer un compteur'),
    ],
  };

  it('should match case- and accent-insensitively and drop emptied groups', () => {
    const filtered = filterSelection(selectTours(manifest, ctx(), 'fr'), '  GENER ');
    expect(ids(filtered)).toEqual({ here: [], elsewhere: ['gen'] });
    expect(filtered.byArea.map((g) => g.area)).toEqual(['keys']);
  });

  it('should keep everything for an empty query', () => {
    const selection = selectTours(manifest, ctx(), 'fr');
    expect(filterSelection(selection, '   ')).toBe(selection);
  });
});

// ── The real tour files ────────────────────────────────────────────

describe('the shipped tours.manifest.json', () => {
  const manifest = realManifest as TourManifest;
  // The onboarding tours are offered by features/onboarding, not by this catalogue.
  const catalogueTours = manifest.tours.filter((t) => !isOnboardingTourId(t.id));

  it('should ship the four onboarding tours', () => {
    const ids = new Set(manifest.tours.map((t) => t.id));
    expect(Object.values(ONBOARDING_TOURS).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('should never list an onboarding tour among the catalogue tours', () => {
    const selections = [Role.MEMBER, Role.GESTIONNAIRE, Role.ADMIN, null].flatMap((role) =>
      ['/home', '/dashboard'].map((url) =>
        selectTours(manifest, ctx({ role, activeFeatures: ALL_FEATURES, url }), 'fr'),
      ),
    );
    const offered = selections.flatMap((s) => [
      ...s.onThisPage,
      ...s.byArea.flatMap((g) => g.tours),
    ]);
    expect(offered.filter((t) => isOnboardingTourId(t.id))).toEqual([]);
  });

  it('should have every entry route in ENTRY_ROUTES (else its tours stay hidden)', () => {
    const missing = catalogueTours
      .filter((t) => !ENTRY_ROUTES[t.entry.route])
      .map((t) => `${t.id} ${t.entry.route}`);
    expect(missing).toEqual([]);
  });

  it('should only use the two personas the launcher knows', () => {
    const counts = catalogueTours.reduce<Record<string, number>>((acc, t) => {
      acc[t.role] = (acc[t.role] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({ member: 8, admin: 47 });
  });

  it('should list in HIDDEN_TOURS only tours still compiled with the broken entry (remove regenerated ones)', () => {
    const entries = new Map(manifest.tours.map((t) => [t.id, t.entry.route]));
    const stale = Object.entries(HIDDEN_TOURS)
      .filter(([id, hidden]) => entries.get(id) !== hidden.entry)
      .map(
        ([id, hidden]) =>
          `${id}: hidden for ${hidden.entry}, manifest has ${entries.get(id) ?? 'no such tour'}`,
      );
    expect(stale).toEqual([]);
  });

  it('should offer the record tours on any key or operation page, with its id, and not on the lists', () => {
    const offeredOn = (url: string) =>
      selectTours(manifest, ctx({ role: Role.GESTIONNAIRE, url }), 'fr').onThisPage.map((t) => [
        t.id,
        t.params,
      ]);

    expect(offeredOn('/keys/5').sort()).toEqual([
      ['community-join-inspect-key', { keyId: '5' }],
      ['key-delete', { keyId: '5' }],
      ['key-helper-tour', { keyId: '5' }],
      ['key-update', { keyId: '5' }],
    ]);
    expect(offeredOn('/sharing_operations/3').sort()).toEqual([
      ['sharing-op-inspect', { operationId: '3' }],
      ['sharing-op-update', { operationId: '3' }],
      ['sharing-operation-add-meter', { operationId: '3' }],
    ]);
    const onKeyList = selectTours(manifest, ctx({ url: '/keys' }), 'fr');
    const keyListIds = [...onKeyList.onThisPage, ...onKeyList.byArea.flatMap((g) => g.tours)].map(
      (t) => t.id,
    );
    expect(keyListIds).not.toContain('key-helper-tour');
  });

  it('should name only existing tours in PAGE_ONLY', () => {
    const known = new Set(manifest.tours.map((t) => t.id));
    expect(Object.keys(PAGE_ONLY).filter((id) => !known.has(id))).toEqual([]);
  });

  it('should have a title in each of the four languages for every tour', () => {
    const incomplete = manifest.tours.filter((t) =>
      ['fr', 'en', 'nl', 'de'].some((l) => !t.title[l]),
    );
    expect(incomplete.map((t) => t.id)).toEqual([]);
  });

  it('should offer a manager of a fully subscribed community every admin tour but the page-bound and hidden ones', () => {
    const selection = selectTours(
      manifest,
      ctx({ role: Role.ADMIN, activeFeatures: ALL_FEATURES, url: '/home' }),
      'fr',
    );
    const offered = [...selection.onThisPage, ...selection.byArea.flatMap((g) => g.tours)].map(
      (t) => t.id,
    );
    const pageBound = (t: TourManifestEntry) => t.entry.route.includes(':') || !!PAGE_ONLY[t.id];
    const hidden = (t: TourManifestEntry) => HIDDEN_TOURS[t.id]?.entry === t.entry.route;
    const expected = catalogueTours
      .filter((t) => t.role === 'admin' && !pageBound(t) && !hidden(t))
      .map((t) => t.id);
    expect([...offered].sort()).toEqual(expected.sort());
    expect(offered).not.toContain('member-document-upload');
    expect(offered).not.toContain('meter-deactivate');
    expect(offered).not.toContain('meter-address-repair');
  });

  it('should keep every hidden tour out of the list while it is compiled with its broken entry', () => {
    const selection = selectTours(
      manifest,
      ctx({ role: Role.ADMIN, activeFeatures: ALL_FEATURES, url: '/keys' }),
      'fr',
    );
    const offered = [...selection.onThisPage, ...selection.byArea.flatMap((g) => g.tours)].map(
      (t) => t.id,
    );
    const stillBroken = manifest.tours.filter((t) => HIDDEN_TOURS[t.id]?.entry === t.entry.route);
    expect(offered.filter((id) => stillBroken.some((t) => t.id === id))).toEqual([]);
  });

  it('should offer a member of a fully subscribed community all eight member tours', () => {
    const selection = selectTours(
      manifest,
      ctx({ role: Role.MEMBER, activeFeatures: ALL_FEATURES, url: '/home' }),
      'fr',
    );
    const offered = [...selection.onThisPage, ...selection.byArea.flatMap((g) => g.tours)];
    expect(offered).toHaveLength(8);
  });

  it('should keep every area label pointing at a sidebar key', () => {
    expect(TOUR_AREAS.every((a) => a.label.startsWith('NAVBAR.'))).toBe(true);
  });
});

// ── ENTRY_ROUTES against the real route config and guards ──────────

/**
 * The routes an entry pattern goes through, parent first. Lazy children are
 * loaded only when segments remain: the empty-path leaves of the lazy files
 * carry no guards today, and loading every feature for that would import the
 * whole app.
 */
async function routeChain(config: Routes, pattern: string): Promise<Route[]> {
  const segments = pattern.split('/').filter(Boolean);
  const chain: Route[] = [];
  let level = config;
  let index = 0;

  for (;;) {
    const candidates = level.filter((route) => {
      const parts = (route.path ?? '').split('/').filter(Boolean);
      if (route.redirectTo !== undefined || parts.length === 0) return false;
      if (index + parts.length > segments.length) return false;
      return parts.every((part, j) => part.startsWith(':') || part === segments[index + j]);
    });
    // A literal path wins over a param, as in the router (`add` before `:id`).
    const route = candidates.find((r) => !r.path?.includes(':')) ?? candidates[0];
    if (!route) throw new Error(`No route for ${pattern} at /${segments.slice(index).join('/')}`);
    chain.push(route);
    index += (route.path ?? '').split('/').filter(Boolean).length;

    if (index === segments.length) {
      const leaf = route.children?.find((r) => !r.path && r.redirectTo === undefined);
      if (leaf) chain.push(leaf);
      return chain;
    }
    if (route.children) {
      level = route.children;
    } else if (route.loadChildren) {
      level = (await (route.loadChildren as () => Promise<Routes>)()) ?? [];
    } else {
      throw new Error(`${pattern}: /${route.path} has no children`);
    }
  }
}

describe('ENTRY_ROUTES against app.routes.ts', () => {
  const REFUSED = { refused: true };

  /** Runs `guard` as the router would, with `subscribed` as the community's annexes. */
  async function runGuard(guard: CanActivateFn, subscribed: string[]): Promise<unknown> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: CommunityServicesStore,
          useValue: {
            ensureLoaded: () => of(subscribed.map((feature) => ({ feature, subscribed: true }))),
          },
        },
        { provide: Router, useValue: { createUrlTree: () => REFUSED } },
        { provide: UserContextService, useValue: { activeCommunityId: () => 'org-1' } },
      ],
    });
    const result = TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, { url: '/' } as RouterStateSnapshot),
    );
    return isObservable(result) ? firstValueFrom(result) : result;
  }

  afterEach(() => TestBed.resetTestingModule());

  for (const [pattern, rule] of Object.entries(ENTRY_ROUTES)) {
    it(`${pattern} should require ${rule.minRole ?? 'no role'} and ${rule.feature ?? 'no annex'}`, async () => {
      const chain = await routeChain(routes, pattern);
      const guards = chain.flatMap((route) => (route.canActivate ?? []) as CanActivateFn[]);

      // Nested minRoleGuards all have to pass, so the highest one is the requirement.
      const minRole = chain
        .filter((route) => (route.canActivate ?? []).includes(minRoleGuard))
        .map((route) => route.data?.['minRole'] as Role)
        .reduce<Role | undefined>(
          (highest, role) =>
            highest && ROLE_HIERARCHY[highest] >= ROLE_HIERARCHY[role] ? highest : role,
          undefined,
        );
      expect(minRole).toBe(rule.minRole);

      // Whatever is left is a feature guard: run it with and without the annex.
      const others = guards.filter((guard) => guard !== canActivateAuth && guard !== minRoleGuard);
      expect(others.length).toBe(rule.feature ? 1 : 0);
      const feature = rule.feature;
      if (feature) {
        expect(await runGuard(others[0], [feature])).toBe(true);
        expect(
          await runGuard(
            others[0],
            [...ALL_FEATURES].filter((f) => f !== feature),
          ),
        ).toBe(REFUSED);
      }
    });
  }
});
