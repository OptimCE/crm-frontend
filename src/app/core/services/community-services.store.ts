import { effect, inject, Injectable, signal } from '@angular/core';
import { map, Observable, of, tap } from 'rxjs';

import { CommunityAnnex } from '../../shared/dtos/annexes_services.dtos';
import { AnnexesServicesService } from '../../shared/services/annexes_services.service';
import { UserContextService } from './authorization/authorization.service';
import { CacheService } from './cache/cache.service';

/**
 * Signal-backed cache of the active community's annex-services catalog
 * (`getCommunityServices`). Drives the navbar's per-community feature
 * visibility and the `activeFeatureGuard`.
 */
@Injectable({ providedIn: 'root' })
export class CommunityServicesStore {
  private readonly annexesService = inject(AnnexesServicesService);
  private readonly userContext = inject(UserContextService);
  private readonly cache = inject(CacheService);

  readonly services = signal<CommunityAnnex[]>([]);
  private lastCommunityId: string | null = null;
  private loaded = false;

  constructor() {
    // Reload whenever the active community changes. getCommunityServices' cache
    // key is community-agnostic, so invalidate it first to avoid serving the
    // previous community's subscription state.
    effect(() => {
      const id = this.userContext.activeCommunityId();
      if (id === this.lastCommunityId) return;
      this.lastCommunityId = id;
      this.loaded = false;
      if (!id) {
        this.services.set([]);
        return;
      }
      this.cache.invalidate('annexes-services');
      this.fetch().subscribe();
    });
  }

  /** Returns the loaded catalog, fetching on first access. */
  ensureLoaded(): Observable<CommunityAnnex[]> {
    if (this.loaded) {
      return of(this.services());
    }
    return this.fetch();
  }

  /**
   * Forces a fresh fetch after a subscription change, refreshing the navbar and
   * the `activeFeatureGuard`. Resetting `loaded` first means a concurrent
   * `ensureLoaded()` re-fetches rather than serving the stale signal; the
   * in-flight map in `ServiceBase.cachedGet` shares the single network request.
   */
  reload(): Observable<CommunityAnnex[]> {
    this.cache.invalidate('annexes-services');
    this.loaded = false;
    return this.fetch();
  }

  isActive(feature: string): boolean {
    return this.services().some((s) => s.feature === feature && s.subscribed);
  }

  private fetch(): Observable<CommunityAnnex[]> {
    return this.annexesService.getCommunityServices().pipe(
      map((response) => response.data ?? []),
      tap((services) => {
        this.services.set(services);
        this.loaded = true;
      }),
    );
  }
}
