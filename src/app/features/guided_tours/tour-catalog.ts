import { Role } from '../../core/dtos/role';
import { ROLE_HIERARCHY } from '../../core/services/authorization/authorization.service';

/**
 * Which in-app tours the current user can actually start.
 *
 * The tours are compiled by Steppy from the e2e guide scenarios and shipped in
 * `public/tours/` (never edited here: the manifest pins every file by hash).
 * A tour started from the wrong place does not degrade gracefully, it fails:
 * an entry route whose guard refuses fails with `entry-params`, a step that
 * points at another role's UI times out on its target. So the launcher offers
 * a tour only when all of these hold:
 *
 * - the tour's persona matches the active community's role;
 * - the guard of its entry route would let this user in (`ENTRY_ROUTES`);
 * - its entry route's `:params` come from the current URL (those tours are
 *   offered only on their own page);
 * - its page condition holds (`PAGE_ONLY`).
 *
 * Pure: everything it needs comes in through `TourContext`.
 */

/** The part of `tours.manifest.json` the launcher reads. */
export interface TourManifestEntry {
  id: string;
  /** The Steppy persona the tour was written for: `member` or `admin`. */
  role: string;
  entry: { route: string };
  /** One title per locale. */
  title: Record<string, string>;
}

export interface TourManifest {
  defaultLocale: string;
  tours: TourManifestEntry[];
}

export type TourArea =
  | 'home'
  | 'profile'
  | 'communities'
  | 'community'
  | 'annexes_services'
  | 'news'
  | 'billing'
  | 'live_data'
  | 'administrative_document'
  | 'keys'
  | 'members'
  | 'meters'
  | 'sharing_operations'
  | 'audit_log';

/** Areas in sidebar order, with the sidebar's own label for each. */
export const TOUR_AREAS: readonly { area: TourArea; label: string }[] = [
  { area: 'home', label: 'NAVBAR.HOME' },
  { area: 'profile', label: 'NAVBAR.PROFILE' },
  { area: 'communities', label: 'NAVBAR.COMMUNITIES' },
  { area: 'community', label: 'NAVBAR.COMMUNITY' },
  { area: 'annexes_services', label: 'NAVBAR.ANNEXES_SERVICES' },
  { area: 'news', label: 'NAVBAR.NEWS' },
  { area: 'billing', label: 'NAVBAR.BILLING' },
  { area: 'live_data', label: 'NAVBAR.LIVE_DATA' },
  { area: 'administrative_document', label: 'NAVBAR.ADMINISTRATIVE_DOCUMENT' },
  { area: 'keys', label: 'NAVBAR.HANDLE_KEY' },
  { area: 'members', label: 'NAVBAR.HANDLE_MEMBRE' },
  { area: 'meters', label: 'NAVBAR.HANDLE_METER' },
  { area: 'sharing_operations', label: 'NAVBAR.HANDLE_SHARING_OP' },
  { area: 'audit_log', label: 'NAVBAR.AUDIT_LOG' },
];

export interface EntryRouteRule {
  area: TourArea;
  /** `minRoleGuard`'s `data.minRole` along the route. */
  minRole?: Role;
  /** `activeFeatureGuard`'s feature key along the route. */
  feature?: string;
}

/**
 * Every tour entry route, with what its guards require. Mirrors app.routes.ts
 * and the lazy route files (tour-catalog.spec.ts runs the real guards against
 * this table). `canActivateAuth` is left out: the launcher is only reachable
 * signed in. An entry route missing here hides its tours: fail closed.
 *
 * The params are the manifest's names, not the app's (`:id`); only the
 * segment count matters.
 */
export const ENTRY_ROUTES: Readonly<Record<string, EntryRouteRule>> = {
  '/home': { area: 'home' },
  '/users': { area: 'profile' },
  '/users/communities': { area: 'communities' },
  '/communities/public': { area: 'communities' },
  '/communities/info': { area: 'community', minRole: Role.MEMBER },
  '/communities/managers': { area: 'community' },
  '/communities/users': { area: 'community', minRole: Role.GESTIONNAIRE },
  '/annexes-services': { area: 'annexes_services', minRole: Role.MEMBER },
  '/annexes-services/algorithm': {
    area: 'annexes_services',
    minRole: Role.GESTIONNAIRE,
    feature: 'algorithm',
  },
  '/annexes-services/simulation': {
    area: 'annexes_services',
    minRole: Role.GESTIONNAIRE,
    feature: 'simulation',
  },
  '/news': { area: 'news', feature: 'news' },
  '/billing': { area: 'billing', feature: 'billing' },
  '/live-data': { area: 'live_data', feature: 'live-data' },
  '/administrative-document': {
    area: 'administrative_document',
    feature: 'administrative-document',
  },
  '/keys': { area: 'keys', minRole: Role.GESTIONNAIRE },
  '/keys/:keyId': { area: 'keys', minRole: Role.GESTIONNAIRE },
  '/members': { area: 'members', minRole: Role.GESTIONNAIRE },
  '/members/:memberId': { area: 'members', minRole: Role.GESTIONNAIRE },
  '/meters': { area: 'meters', minRole: Role.GESTIONNAIRE },
  '/meters/:meterEan': { area: 'meters', minRole: Role.GESTIONNAIRE },
  '/sharing_operations': { area: 'sharing_operations', minRole: Role.GESTIONNAIRE },
  '/sharing_operations/:operationId': { area: 'sharing_operations', minRole: Role.GESTIONNAIRE },
  '/audit-logs': { area: 'audit_log', minRole: Role.GESTIONNAIRE },
};

/**
 * Tours whose first step exists only in one state of their entry page, which
 * an entry route cannot express (it carries no query). They are offered on
 * that page only, in that state.
 */
export const PAGE_ONLY: Readonly<Record<string, { query: Record<string, string> }>> = {
  // Starts on `meters-map__button--repair`, which only the map view renders.
  'meter-address-repair': { query: { view: 'map' } },
};

export interface HiddenTour {
  /** The entry route the tour is broken with. */
  entry: string;
  reason: string;
}

/**
 * Tours that cannot work as compiled, hidden until Steppy regenerates them.
 * A tour is hidden only while its manifest entry is still the one recorded
 * here, and tour-catalog.spec.ts fails once it differs: a regenerated tour
 * shows up again, and its line has to go.
 */
export const HIDDEN_TOURS: Readonly<Record<string, HiddenTour>> = {};

export interface TourContext {
  /** The highest role in the active community; null when none is active. */
  role: Role | null;
  /** The annexes the active community is subscribed to. */
  activeFeatures: ReadonlySet<string>;
  /** The router URL, query included. */
  url: string;
}

export interface OfferedTour {
  id: string;
  title: string;
  area: TourArea;
  /** The entry route's params, read from the current URL. */
  params?: Record<string, string>;
}

export interface TourGroup {
  area: TourArea;
  label: string;
  tours: OfferedTour[];
}

export interface TourSelection {
  /** Tours that start on the current page; the only place param tours appear. */
  onThisPage: OfferedTour[];
  /** Every other offered tour, by area in sidebar order. */
  byArea: TourGroup[];
}

/** The tour's persona against the active community's role. */
export function personaMatches(persona: string, role: Role | null): boolean {
  if (persona === 'member') return role === Role.MEMBER;
  if (persona === 'admin') return role === Role.GESTIONNAIRE || role === Role.ADMIN;
  return false;
}

/** Whether the entry route's guards would let this user in. */
export function routeAllows(rule: EntryRouteRule, ctx: TourContext): boolean {
  if (rule.minRole) {
    if (!ctx.role || ROLE_HIERARCHY[ctx.role] < ROLE_HIERARCHY[rule.minRole]) return false;
  }
  if (rule.feature && !ctx.activeFeatures.has(rule.feature)) return false;
  return true;
}

function splitUrl(url: string): { segments: string[]; query: URLSearchParams } {
  const [beforeHash] = url.split('#');
  const [path, query = ''] = beforeHash.split('?');
  return { segments: path.split('/').filter(Boolean), query: new URLSearchParams(query) };
}

/**
 * The params of `pattern` (`/members/:memberId`) in `url`, or null when the
 * path does not match. The query and the fragment are ignored.
 */
export function matchEntryRoute(pattern: string, url: string): Record<string, string> | null {
  const expected = pattern.split('/').filter(Boolean);
  const { segments } = splitUrl(url);
  if (expected.length !== segments.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < expected.length; i++) {
    const want = expected[i];
    if (want.startsWith(':')) {
      try {
        params[want.slice(1)] = decodeURIComponent(segments[i]);
      } catch {
        return null;
      }
    } else if (want !== segments[i]) {
      return null;
    }
  }
  return params;
}

function hasParams(pattern: string): boolean {
  return pattern.split('/').some((segment) => segment.startsWith(':'));
}

function queryMatches(expected: Record<string, string>, url: string): boolean {
  const { query } = splitUrl(url);
  return Object.entries(expected).every(([key, value]) => query.get(key) === value);
}

/** The title in `lang`, else in the manifest's default locale, else the id. */
export function tourTitle(entry: TourManifestEntry, lang: string, defaultLocale: string): string {
  return entry.title[lang] ?? entry.title[defaultLocale] ?? entry.id;
}

/** The tours this user can start, split into "on this page" and the rest by area. */
export function selectTours(
  manifest: TourManifest,
  ctx: TourContext,
  lang: string,
  hidden: Readonly<Record<string, HiddenTour>> = HIDDEN_TOURS,
): TourSelection {
  const onThisPage: OfferedTour[] = [];
  const elsewhere: OfferedTour[] = [];

  for (const entry of manifest.tours) {
    if (hidden[entry.id]?.entry === entry.entry.route) continue;
    const rule = ENTRY_ROUTES[entry.entry.route];
    if (!rule) continue;
    if (!personaMatches(entry.role, ctx.role)) continue;
    if (!routeAllows(rule, ctx)) continue;

    const offered: OfferedTour = {
      id: entry.id,
      title: tourTitle(entry, lang, manifest.defaultLocale),
      area: rule.area,
    };
    const params = matchEntryRoute(entry.entry.route, ctx.url);
    const pageOnly = PAGE_ONLY[entry.id];
    const here = params !== null && (!pageOnly || queryMatches(pageOnly.query, ctx.url));

    if (here) {
      onThisPage.push(hasParams(entry.entry.route) ? { ...offered, params } : offered);
    } else if (!hasParams(entry.entry.route) && !pageOnly) {
      elsewhere.push(offered);
    }
  }

  const byTitle = (a: OfferedTour, b: OfferedTour) => a.title.localeCompare(b.title, lang);
  onThisPage.sort(byTitle);
  const byArea = TOUR_AREAS.map(({ area, label }) => ({
    area,
    label,
    tours: elsewhere.filter((tour) => tour.area === area).sort(byTitle),
  })).filter((group) => group.tours.length > 0);

  return { onThisPage, byArea };
}

/** Lower-cased, accents stripped: "Générer" matches "gener". */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** The selection narrowed to the tours whose title contains `query`. */
export function filterSelection(selection: TourSelection, query: string): TourSelection {
  const needle = normalizeForSearch(query);
  if (!needle) return selection;
  const keep = (tour: OfferedTour) => normalizeForSearch(tour.title).includes(needle);
  return {
    onThisPage: selection.onThisPage.filter(keep),
    byArea: selection.byArea
      .map((group) => ({ ...group, tours: group.tours.filter(keep) }))
      .filter((group) => group.tours.length > 0),
  };
}
