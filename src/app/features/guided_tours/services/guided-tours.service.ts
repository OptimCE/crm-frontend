import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, of } from 'rxjs';

import { CommunityServicesStore } from '../../../core/services/community-services.store';
import { UserContextService } from '../../../core/services/authorization/authorization.service';
import { TourContext, TourManifest } from '../tour-catalog';

/** The same file `provideSteppyTours({ fallbackManifest })` loads. */
export const TOUR_MANIFEST_URL = 'tours/tours.manifest.json';

export interface GuidedToursState {
  /** null when the manifest could not be loaded. */
  manifest: TourManifest | null;
  context: TourContext;
}

/** What the launcher needs to decide which tours to offer, read when it opens. */
@Injectable({ providedIn: 'root' })
export class GuidedToursService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly userContext = inject(UserContextService);
  private readonly communityServices = inject(CommunityServicesStore);

  /** Kept once loaded; a failed load is retried on the next open. */
  private manifest: TourManifest | null = null;

  async load(): Promise<GuidedToursState> {
    const [manifest, services] = await Promise.all([
      this.loadManifest(),
      // What `activeFeatureGuard` reads; a load error refuses there, so nothing is active here.
      firstValueFrom(this.communityServices.ensureLoaded().pipe(catchError(() => of([])))),
    ]);
    return {
      manifest,
      context: {
        role: this.userContext.activeCommunityRole(),
        activeFeatures: new Set(services.filter((s) => s.subscribed).map((s) => s.feature)),
        url: this.router.url,
      },
    };
  }

  /** The shipped manifest, or null when it could not be loaded. Also read by the onboarding offers. */
  async loadManifest(): Promise<TourManifest | null> {
    if (this.manifest) return this.manifest;
    try {
      this.manifest = await firstValueFrom(this.http.get<TourManifest>(TOUR_MANIFEST_URL));
    } catch (error) {
      console.error('Guided tours: manifest unavailable', error);
    }
    return this.manifest;
  }
}
