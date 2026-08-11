import { effect, inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, tap } from 'rxjs';

import { CommunityAnnex } from '../../shared/dtos/annexes_services.dtos';
import { AnnexesServicesService } from '../../shared/services/annexes_services.service';
import { UserContextService } from './authorization/authorization.service';
import { CacheService } from './cache/cache.service';

/**
 * Signal-backed cache of the active community's annex-services catalog
 * (`getCommunityServices`). Drives the navbar's per-community feature
 * visibility, the `activeFeatureGuard`, and every cross-module link that
 * crosses into an annexe.
 */
@Injectable({ providedIn: 'root' })
export class CommunityServicesStore {
  private readonly annexesService = inject(AnnexesServicesService);
  private readonly userContext = inject(UserContextService);
  private readonly cache = inject(CacheService);

  readonly services = signal<CommunityAnnex[]>([]);

  /**
   * The community `services()` currently describes.
   *
   * Derived from the community id rather than from a boolean flipped inside the
   * effect below: an effect runs at change detection, NOT at `.set()` time, so a
   * caller reaching `ensureLoaded()` synchronously after `switchCommunity()`
   * would otherwise be served the PREVIOUS community's catalog.
   */
  private loadedFor: string | null = null;

  /**
   * Catalogs of communities OTHER than the active one, keyed by org id.
   *
   * Populated only by `catalogFor()` (the user dashboard's fan-out) and never
   * read by the active-community path above, so the two cannot interfere.
   */
  private readonly catalogs = new Map<string, CommunityAnnex[]>();

  constructor() {
    // Prefetch on every community change so the navbar repaints without waiting
    // for a consumer. getCommunityServices' cache key is community-agnostic, so
    // invalidate it first to avoid serving the previous community's state.
    effect(() => {
      const id = this.userContext.activeCommunityId();
      if (id === this.loadedFor) return;
      if (!id) {
        this.loadedFor = null;
        this.services.set([]);
        return;
      }
      this.cache.invalidate('annexes-services');
      this.fetch(id).subscribe();
    });
  }

  /** Returns the active community's catalog, fetching on first access. */
  ensureLoaded(): Observable<CommunityAnnex[]> {
    const id = this.userContext.activeCommunityId();
    if (!id) return of([]);
    if (this.loadedFor === id) return of(this.services());
    return this.fetch(id);
  }

  /**
   * Forces a fresh fetch after a subscription change, refreshing the navbar and
   * the `activeFeatureGuard`. Clearing `loadedFor` first means a concurrent
   * `ensureLoaded()` re-fetches rather than serving the stale signal; the
   * in-flight map in `ServiceBase.cachedGet` shares the single network request.
   */
  reload(): Observable<CommunityAnnex[]> {
    const id = this.userContext.activeCommunityId();
    // Covers both key families: the community-agnostic `annexes-services:list`
    // and the per-community `annexes-services:community:<id>` keys `catalogFor`
    // writes. A subscription change in the active community also changes what
    // the user dashboard should show for it.
    this.cache.invalidate('annexes-services');
    this.catalogs.clear();
    this.loadedFor = null;
    if (!id) {
      this.services.set([]);
      return of([]);
    }
    return this.fetch(id);
  }

  /** True when the feature is subscribed in the active community. */
  isActive(feature: string): boolean {
    return this.services().some((s) => s.feature === feature && s.subscribed);
  }

  /**
   * True when the annexe is subscribed AND the active role clears the minRole
   * the catalog itself declares for it.
   *
   * This is the gate for any link that crosses into an annexe: `minRoleGuard`
   * and `activeFeatureGuard` both redirect to `/` (then `/users`) on failure, so
   * an unconditioned link silently teleports the user away — worse than no link.
   * Reading `minRole` off the catalog rather than hardcoding it keeps the gate in
   * step with `crm-backend/config/annexes-services.json`.
   *
   * Returns false while the catalog is still empty, which is the right failure
   * direction: hide, never render a link that bounces.
   */
  canReach(feature: string): boolean {
    const entry = this.services().find((s) => s.feature === feature);
    if (!entry?.subscribed) return false;
    return this.userContext.compareWithActiveRole(entry.minRole);
  }

  /**
   * The catalog of an ARBITRARY community, for the user dashboard's fan-out.
   *
   * Deliberately parallel to `services()`/`loadedFor` rather than a widening of
   * them: the navbar, `activeFeatureGuard` and every cross-module link read the
   * active-community path, and it has just been fixed (see `loadedFor` above).
   * A per-community map bolted onto that state would put the fix back at risk
   * for no gain — nothing here needs to be a signal, because the fan-out reads
   * it once per load.
   *
   * Resolves to `[]` on failure rather than erroring: a community whose catalog
   * cannot be read must render no annexe rows, which is the same outcome as
   * "subscribed to nothing" and the safe direction.
   */
  catalogFor(communityId: string): Observable<CommunityAnnex[]> {
    const cached = this.catalogs.get(communityId);
    if (cached) return of(cached);

    return this.annexesService.getServicesForCommunity(communityId).pipe(
      map((response) => response.data ?? []),
      tap((services) => this.catalogs.set(communityId, services)),
      catchError(() => of<CommunityAnnex[]>([])),
    );
  }

  /**
   * True when `feature` is subscribed in `communityId` AND the user's role
   * there clears the catalog's own `minRole`.
   *
   * The per-community mirror of `canReach`, for the fan-out. It reads the
   * catalog the SERVER returned for that community — which is already filtered
   * by the caller's role there — so a stale `activeCommunityRole()` can never
   * leak one community's permissions into another's row.
   */
  canReachIn(communityId: string, feature: string): boolean {
    const entry = this.catalogs.get(communityId)?.find((s) => s.feature === feature);
    return !!entry?.subscribed;
  }

  private fetch(id: string): Observable<CommunityAnnex[]> {
    return this.annexesService.getCommunityServices().pipe(
      map((response) => response.data ?? []),
      map((services) => {
        if (this.userContext.activeCommunityId() !== id) {
          // The community changed while this request was in flight, so the
          // payload describes the wrong one. `ServiceBase.cachedGet` keys its
          // in-flight map by URL and this endpoint takes no community
          // parameter, so the new community would otherwise be handed the old
          // community's catalog. Drop it and leave the store unloaded: the
          // cache is cleared, so the next `ensureLoaded()` issues a real
          // request for whichever community is active by then.
          this.cache.invalidate('annexes-services');
          this.loadedFor = null;
          this.services.set([]);
          return [];
        }
        this.services.set(services);
        this.loadedFor = id;
        return services;
      }),
    );
  }
}
