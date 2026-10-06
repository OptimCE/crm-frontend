import { effect, inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, tap, throwError } from 'rxjs';

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
    // for a consumer. Invalidating first keeps a switch a fresh read, as it has
    // always been; it no longer guards against the previous community's state,
    // which the per-community request in `fetch` rules out on its own.
    effect(() => {
      const id = this.userContext.activeCommunityId();
      if (id === this.loadedFor) return;
      if (!id) {
        this.loadedFor = null;
        this.services.set([]);
        return;
      }
      this.cache.invalidate('annexes-services');
      // A failure is already reflected in the store (`fetch` empties it), and the
      // consumers that must report it — `activeFeatureGuard`, the annexes page —
      // get it from their own `ensureLoaded()`/`reload()`. Without a handler this
      // background prefetch would also surface it as an unhandled error.
      this.fetch(id).subscribe({ error: () => undefined });
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
    // Covers both key families: this store's `annexes-services:list:<id>` and
    // the `annexes-services:community:<id>` keys `catalogFor` writes. A
    // subscription change in the active community also changes what the user
    // dashboard should show for it.
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
    // Asks for `id` explicitly — keyed and pinned to it, see
    // `getCommunityServices` — so this pipe only ever sees `id`'s catalog. With
    // the old community-agnostic request, a switch mid-fetch let the new
    // community's `fetch` join the old one's request and pass the check below.
    return this.annexesService.getCommunityServices(id).pipe(
      map((response) => response.data ?? []),
      map((services) => {
        if (this.userContext.activeCommunityId() !== id) {
          // A late answer for a community the user has since left. Drop it and
          // leave the store alone, as the error path below does: the newly
          // active community has its own request and may already be loaded
          // from it. Emptying the store here would blank a correct navbar with
          // nothing to refill it, since the effect only re-runs on a switch.
          return [];
        }
        this.services.set(services);
        this.loadedFor = id;
        return services;
      }),
      catchError((error: unknown) => {
        // Leave nothing behind on failure. After a community switch the signal
        // still holds the PREVIOUS community's catalog, and after `reload()` one
        // known to be out of date: the navbar, dashboards and cross-links would
        // keep offering those annexes, each click bouncing off
        // `activeFeatureGuard` to `/`. Empty is the safe direction `catalogFor`
        // takes too. Only while `id` is still active: once the user has switched
        // away, the new community's own fetch owns the signal and may already
        // have filled it.
        if (this.userContext.activeCommunityId() === id) {
          this.loadedFor = null;
          this.services.set([]);
        }
        return throwError(() => error);
      }),
    );
  }
}
