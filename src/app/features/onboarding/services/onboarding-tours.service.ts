import { HttpClient } from '@angular/common/http';
import { inject, Injectable, isDevMode } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GuidedToursService } from '../../guided_tours/services/guided-tours.service';
import { TourManifest, TourManifestEntry } from '../../guided_tours/tour-catalog';
import { ONBOARDING_TOUR_KEYS, ONBOARDING_TOURS, OnboardingTourKey } from '../onboarding-tours';
import { stepCountFor, TourFile, tourFileFor, tourVersionOf } from '../onboarding-tour-files';

/** What an offer needs to know about the tour it proposes. */
export interface OnboardingTourInfo {
  key: OnboardingTourKey;
  /** The Steppy tour id. */
  tourId: string;
  /** The steps the player will show on this screen; null leaves the number out of the text. */
  steps: number | null;
  /** The tour's content hash, stored with the answer. */
  version: string | null;
}

/**
 * Which onboarding tours ship in this build, read from the manifest Steppy
 * plays from. A tour that does not ship is simply never offered; in dev mode a
 * warning says which one, once.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingToursService {
  private readonly http = inject(HttpClient);
  private readonly guidedTours = inject(GuidedToursService);

  private warned = false;

  /** The onboarding tours the manifest lists. Empty when it cannot be loaded. */
  async available(): Promise<Set<OnboardingTourKey>> {
    const manifest = await this.guidedTours.loadManifest();
    const shipped = new Set(manifest?.tours.map((t) => t.id) ?? []);
    const available = new Set(
      ONBOARDING_TOUR_KEYS.filter((key) => shipped.has(ONBOARDING_TOURS[key])),
    );
    if (manifest && !this.warned && isDevMode()) {
      const missing = ONBOARDING_TOUR_KEYS.filter((key) => !available.has(key));
      if (missing.length) {
        this.warned = true;
        console.warn(
          'Onboarding: no Steppy tour for',
          missing.map((key) => `${key} (${ONBOARDING_TOURS[key]})`).join(', '),
          '- these tours are not offered.',
        );
      }
    }
    return available;
  }

  /** The tour behind `key` as it will play in `lang` on this screen, or null if it does not ship. */
  async describe(key: OnboardingTourKey, lang: string): Promise<OnboardingTourInfo | null> {
    const manifest = await this.guidedTours.loadManifest();
    const tourId = ONBOARDING_TOURS[key];
    const entry = manifest?.tours.find((t) => t.id === tourId);
    if (!manifest || !entry) return null;
    return {
      key,
      tourId,
      steps: await this.stepCount(entry, manifest, lang),
      version: tourVersionOf(entry, manifest),
    };
  }

  private async stepCount(
    entry: TourManifestEntry,
    manifest: TourManifest,
    lang: string,
  ): Promise<number | null> {
    const file = tourFileFor(entry, lang, manifest.defaultLocale);
    if (!file) return null;
    try {
      const tour = await firstValueFrom(this.http.get<TourFile>(`tours/${file}`));
      return stepCountFor(tour, manifest.layouts ?? {}, (query) => matchMedia(query).matches);
    } catch {
      return null;
    }
  }
}
