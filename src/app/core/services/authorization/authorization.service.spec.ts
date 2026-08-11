import { TestBed } from '@angular/core/testing';
import Keycloak from 'keycloak-js';

import { Role } from '../../dtos/role';
import { CacheService } from '../cache/cache.service';
import { TokenOrg, UserContextService } from './authorization.service';

const STORAGE_KEY = 'activeCommunityId';

function org(orgId: string, name: string, roles: Role[]): TokenOrg {
  return { orgId, orgPath: `/${name}`, roles };
}

describe('UserContextService', () => {
  let orgs: TokenOrg[];

  function build(): UserContextService {
    TestBed.configureTestingModule({
      providers: [
        CacheService,
        {
          provide: Keycloak,
          useValue: {
            authenticated: true,
            get tokenParsed() {
              return { orgs };
            },
          },
        },
      ],
    });
    return TestBed.inject(UserContextService);
  }

  beforeEach(() => {
    sessionStorage.clear();
    orgs = [];
  });

  afterEach(() => {
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  describe('initializeDefaultCommunity', () => {
    it('auto-selects the only community when nothing is stored', () => {
      // The id lives in sessionStorage, so this is the state of every NEW TAB —
      // not just of a fresh login. Without the fallback every request 401s until
      // the user goes back to the picker.
      orgs = [org('org-a', 'Alpha', [Role.GESTIONNAIRE])];
      const service = build();
      service.refreshUserContext();

      expect(service.activeCommunityId()).toBe('org-a');
      expect(sessionStorage.getItem(STORAGE_KEY)).toBe('org-a');
      expect(service.activeCommunityRole()).toBe(Role.GESTIONNAIRE);
    });

    it('never guesses when the user belongs to more than one community', () => {
      orgs = [org('org-a', 'Alpha', [Role.GESTIONNAIRE]), org('org-b', 'Beta', [Role.MEMBER])];
      const service = build();
      service.refreshUserContext();

      expect(service.activeCommunityId()).toBeNull();
      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('restores a stored community rather than the sole-membership fallback', () => {
      sessionStorage.setItem(STORAGE_KEY, 'org-b');
      orgs = [org('org-a', 'Alpha', [Role.ADMIN]), org('org-b', 'Beta', [Role.MEMBER])];
      const service = build();
      service.refreshUserContext();

      expect(service.activeCommunityId()).toBe('org-b');
      expect(service.activeCommunityRole()).toBe(Role.MEMBER);
    });

    it('clears a stored community the user no longer belongs to', () => {
      sessionStorage.setItem(STORAGE_KEY, 'org-gone');
      orgs = [org('org-a', 'Alpha', [Role.MEMBER]), org('org-b', 'Beta', [Role.MEMBER])];
      const service = build();
      service.refreshUserContext();

      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(service.activeCommunityId()).toBeNull();
    });

    it('falls back to the survivor when a stored community disappears and one is left', () => {
      // The 2 → 1 case after leaveCommunity(): the stored id is stale AND there is
      // now exactly one membership.
      sessionStorage.setItem(STORAGE_KEY, 'org-gone');
      orgs = [org('org-a', 'Alpha', [Role.GESTIONNAIRE])];
      const service = build();
      service.refreshUserContext();

      expect(service.activeCommunityId()).toBe('org-a');
      expect(sessionStorage.getItem(STORAGE_KEY)).toBe('org-a');
    });

    it('is idempotent — it runs on every guarded navigation', () => {
      orgs = [org('org-a', 'Alpha', [Role.GESTIONNAIRE]), org('org-b', 'Beta', [Role.MEMBER])];
      const service = build();
      service.refreshUserContext();
      service.switchCommunity('org-b');

      service.refreshUserContext();
      service.refreshUserContext();

      expect(service.activeCommunityId()).toBe('org-b');
    });
  });

  describe('community-scoped cache invalidation', () => {
    it('drops sharing-operation entries on switch', () => {
      // `sharing-operations` (plural) matched no key: every service writes
      // `sharing-operation-list:`, `sharing-operation-keys:`, and so on.
      orgs = [
        org('org-a', 'Alpha', [Role.GESTIONNAIRE]),
        org('org-b', 'Beta', [Role.GESTIONNAIRE]),
      ];
      const service = build();
      const cache = TestBed.inject(CacheService);
      service.refreshUserContext();
      service.switchCommunity('org-a');

      cache.set('sharing-operation-list:{}', ['stale'], 60_000);
      cache.set('sharing-operation-keys:1', ['stale'], 60_000);
      cache.set('community-detail:1', ['stale'], 60_000);
      cache.set('audit-logs-list:{}', ['stale'], 60_000);
      cache.set('billing:invoices:{}', ['stale'], 60_000);
      cache.set('me:meters:{}', ['kept'], 60_000);

      service.switchCommunity('org-b');

      expect(cache.get('sharing-operation-list:{}')).toBeNull();
      expect(cache.get('sharing-operation-keys:1')).toBeNull();
      expect(cache.get('community-detail:1')).toBeNull();
      expect(cache.get('audit-logs-list:{}')).toBeNull();
      expect(cache.get('billing:invoices:{}')).toBeNull();
      // Cross-community by design — dropping it would only cost a refetch.
      expect(cache.get('me:meters:{}')).toEqual(['kept']);
    });

    it('does not invalidate when the community does not actually change', () => {
      orgs = [org('org-a', 'Alpha', [Role.GESTIONNAIRE])];
      const service = build();
      const cache = TestBed.inject(CacheService);
      service.refreshUserContext();

      cache.set('members-list:{}', ['kept'], 60_000);
      service.switchCommunity('org-a');

      expect(cache.get('members-list:{}')).toEqual(['kept']);
    });
  });
});
