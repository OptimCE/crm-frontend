import { Injectable, inject, signal, computed } from '@angular/core';
import Keycloak, { KeycloakTokenParsed } from 'keycloak-js';
import { Role } from '../../dtos/role';
import { CacheService } from '../cache/cache.service';

// The structure for our parsed data
interface CommunityContext {
  orgId: string;
  orgPath: string;
  name: string;
  roles: Role[];
}
export interface TokenOrg {
  orgId: string;
  orgPath: string;
  roles: Role[];
}
interface KeycloakTokenParsedExtends extends KeycloakTokenParsed {
  orgs: TokenOrg[];
  preferred_username: string;
  email: string;
}
export interface UserInterface {
  username: string;
  email: string;
  communitiesById: Record<string, CommunityContext>;
  activeCommunity: CommunityContext | null;
  activeRole: Role | null;
}
const ACTIVE_COMMUNITY_STORAGE_KEY = 'activeCommunityId';

/**
 * Cache key prefixes holding data scoped to ONE community. All of them must be
 * dropped when the active community changes, or a page renders the previous
 * community's rows under the new community's name for up to the entry's TTL.
 *
 * `CacheService.invalidate` is a plain `startsWith`, so each entry must match the
 * literal key a service builds — `'sharing-operations'` (plural) matched nothing,
 * because every key is `sharing-operation-list:`, `sharing-operation-keys:`, etc.
 *
 * Deliberately absent: `me:*`, `own-*`, `users`, `regulators` and
 * `municipalities-search`. The first two are user-scoped and cross-community by
 * design; the rest are global reference data. Dropping them would only cost a
 * refetch. `annexes-services` is owned by `CommunityServicesStore`, which
 * invalidates and refetches it from its own effect.
 */
const COMMUNITY_SCOPED_CACHE_PREFIXES = [
  'communities',
  'community-',
  'members',
  'managers-invitation',
  'meters',
  'keys',
  'sharing-operation',
  'documents',
  'audit-logs-list',
  'dashboard',
  // Annexe services. Their catalogs are per-community too, and only
  // `administrative-document` keys its entries by community id today.
  'billing',
  'news',
  'administrative-document',
  'generation',
  'simulation',
] as const;

function highestRole(roles: Role[]): Role | null {
  if (!roles?.length) return null;
  return [...roles].sort((a, b) => (ROLE_HIERARCHY[b] ?? 0) - (ROLE_HIERARCHY[a] ?? 0))[0] ?? null;
}

function orgNameFromPath(path: string): string {
  return (path || '').replace(/^\/+/, '').split('/')[0] || path;
}

export const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.MEMBER]: 0,
  [Role.GESTIONNAIRE]: 1,
  [Role.ADMIN]: 2,
};

@Injectable({ providedIn: 'root' })
export class UserContextService {
  private readonly keycloak = inject(Keycloak);
  protected cache = inject(CacheService);

  readonly communitiesById = signal<Record<string, CommunityContext>>({});

  readonly activeCommunityId = signal<string | null>(null);

  readonly activeCommunity = computed(() => {
    const id = this.activeCommunityId();
    const all = this.communitiesById();
    return id ? (all[id] ?? null) : null;
  });

  readonly activeCommunityRole = computed(() => {
    const comm = this.activeCommunity();
    return comm ? highestRole(comm.roles) : null;
  });

  refreshUserContext(): void {
    const token = this.keycloak.tokenParsed as KeycloakTokenParsedExtends | undefined;

    // New source: orgs claim
    const rawOrgs: TokenOrg[] = token?.orgs ?? [];
    const parsed: Record<string, CommunityContext> = {};

    for (const o of rawOrgs) {
      if (!o?.orgId || !o?.orgPath) continue;

      // Keep only roles that match your Role enum
      const roles = (o.roles ?? []).filter((r): r is Role => Object.values(Role).includes(r));

      parsed[o.orgId] = {
        orgId: o.orgId,
        orgPath: o.orgPath,
        name: orgNameFromPath(o.orgPath),
        roles,
      };
    }

    this.communitiesById.set(parsed);
    this.initializeDefaultCommunity();
  }

  switchCommunity(orgId: string): void {
    const all = this.communitiesById();
    if (all[orgId]) this.selectCommunity(orgId);
  }

  private invalidateCommunityScopedCache(): void {
    for (const prefix of COMMUNITY_SCOPED_CACHE_PREFIXES) {
      this.cache.invalidate(prefix);
    }
  }

  logout(): void {
    this.deleteStoreCommunityId();
  }

  // If you still want switching by name/path (UI dropdown using name)
  switchCommunityByPath(orgPath: string): void {
    const all = this.communitiesById();
    const found = Object.values(all).find((c) => c.orgPath === orgPath);
    // Delegates so this path cannot drift from switchCommunity's cache
    // invalidation, which it used to skip entirely.
    if (found) this.switchCommunity(found.orgId);
  }

  getUserInfo(): UserInterface | null {
    if (!this.keycloak.authenticated) return null;
    const token = this.keycloak.tokenParsed as KeycloakTokenParsedExtends;

    return {
      username: token?.preferred_username,
      email: token?.email,
      communitiesById: this.communitiesById(),
      activeCommunity: this.activeCommunity(),
      activeRole: this.activeCommunityRole(),
    };
  }

  /**
   * Restores the active community, or picks the only one there is.
   *
   * Runs on every `refreshUserContext()`, i.e. on every guarded navigation, so
   * it must be idempotent and must never widen an existing selection.
   *
   * The stored id lives in **sessionStorage**, so it is per TAB, not per login:
   * without the single-community fallback a user with one community re-enters
   * the no-active-community state in every new tab, and every request 401s until
   * they go back to the picker. With two or more we never guess — `Object.keys()`
   * order is not a user preference, and picking wrong silently shows one
   * community's data under another's name.
   */
  private initializeDefaultCommunity(): void {
    const all = this.communitiesById();
    const stored = this.loadStoredCommunityId();

    if (stored) {
      if (all[stored]) {
        this.selectCommunity(stored);
        return;
      }
      // stored org no longer available -> clear it
      this.storeCommunityId(null);
    }

    const ids = Object.keys(all);
    if (ids.length === 1) this.selectCommunity(ids[0]);
  }

  /** Sets the active community, invalidating caches only on a real change. */
  private selectCommunity(orgId: string): void {
    if (this.activeCommunityId() === orgId) return;
    this.activeCommunityId.set(orgId);
    this.storeCommunityId(orgId);
    this.invalidateCommunityScopedCache();
  }

  compareWithActiveRole(role: Role): boolean {
    const current = this.activeCommunityRole();
    if (!current) return false;
    const currentHierarchy = ROLE_HIERARCHY[current];
    const targetHierarchy = ROLE_HIERARCHY[role];
    return currentHierarchy >= targetHierarchy;
  }

  isActiveRole(role: Role): boolean {
    const current = this.activeCommunityRole();
    if (!current) return false;
    const currentHierarchy = ROLE_HIERARCHY[current];
    const targetHierarchy = ROLE_HIERARCHY[role];
    return currentHierarchy === targetHierarchy;
  }

  private loadStoredCommunityId(): string | null {
    return sessionStorage.getItem(ACTIVE_COMMUNITY_STORAGE_KEY);
  }

  private storeCommunityId(id: string | null) {
    if (!id) sessionStorage.removeItem(ACTIVE_COMMUNITY_STORAGE_KEY);
    else sessionStorage.setItem(ACTIVE_COMMUNITY_STORAGE_KEY, id);
  }
  private deleteStoreCommunityId(): void {
    sessionStorage.removeItem(ACTIVE_COMMUNITY_STORAGE_KEY);
  }
}
