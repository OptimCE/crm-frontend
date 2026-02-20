import { Injectable, inject, signal, computed } from '@angular/core';
import Keycloak, {KeycloakTokenParsed} from 'keycloak-js';
import { Role } from '../../dtos/role';

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
interface KeycloakTokenParsedExtends extends KeycloakTokenParsed{
  orgs: TokenOrg[];
  preferred_username: string;
  email: string;
}
export interface UserInterface{
  username: string;
  email: string;
  communitiesById: Record<string, CommunityContext>;
  activeCommunity: CommunityContext|null;
  activeRole: Role|null;
}
const ACTIVE_COMMUNITY_STORAGE_KEY = 'activeCommunityId';

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
    const token  = this.keycloak.tokenParsed as KeycloakTokenParsedExtends|undefined;

    // New source: orgs claim
    const rawOrgs: TokenOrg[] = token?.orgs ?? [];
    const parsed: Record<string, CommunityContext> = {};

    for (const o of rawOrgs) {
      if (!o?.orgId || !o?.orgPath) continue;

      // Keep only roles that match your Role enum
      const roles = (o.roles ?? []).filter((r): r is Role =>
        Object.values(Role).includes(r),
      );

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
    if (all[orgId]) {
      this.activeCommunityId.set(orgId);
      this.storeCommunityId(orgId);
    }
  }

  logout(): void{
    this.deleteStoreCommunityId();
  }

  // If you still want switching by name/path (UI dropdown using name)
  switchCommunityByPath(orgPath: string): void {
    const all = this.communitiesById();
    const found = Object.values(all).find((c) => c.orgPath === orgPath);
    if (found) {
      this.activeCommunityId.set(found.orgId);
      this.storeCommunityId(found.orgId);
    }
  }

  getUserInfo(): UserInterface|null {
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

  private initializeDefaultCommunity(): void {
    const stored = this.loadStoredCommunityId();
    if (!stored) return;

    const all = this.communitiesById();
    if (all[stored]) {
      this.activeCommunityId.set(stored);
    } else {
      // stored org no longer available -> clear it
      this.storeCommunityId(null);
    }
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
  private deleteStoreCommunityId(): void{
    sessionStorage.removeItem(ACTIVE_COMMUNITY_STORAGE_KEY);
  }
}
