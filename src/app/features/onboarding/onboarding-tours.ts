/**
 * The onboarding tours and the order they are offered in. The single place to
 * change when a tour is renamed, added or reordered.
 *
 * The app decides WHEN to offer a tour and stores the answer through
 * `/me/onboarding`; Steppy only plays it. The keys mirror crm-backend's
 * `ONBOARDING_TOUR_KEYS`, which refuses any other.
 */

export type OnboardingTourKey =
  | 'welcome'
  | 'community_member'
  | 'community_manager'
  | 'community_admin';
export type RoleTourKey = Exclude<OnboardingTourKey, 'welcome'>;

/**
 * `tour_key` -> Steppy tour id. The ids are the e2e scenario file names
 * (`scenarios/onboarding-*.md`), which is what Steppy names a compiled tour.
 */
export const ONBOARDING_TOURS: Readonly<Record<OnboardingTourKey, string>> = {
  welcome: 'onboarding-welcome',
  community_member: 'onboarding-member',
  community_manager: 'onboarding-manager',
  community_admin: 'onboarding-admin',
};

/**
 * When the user holds several roles in the activated community, the one offered
 * first. One tour per activation; the next one waits for the next activation.
 */
export const ROLE_TOUR_PRIORITY: readonly RoleTourKey[] = [
  'community_admin',
  'community_manager',
  'community_member',
];

export const ONBOARDING_TOUR_KEYS: readonly OnboardingTourKey[] = [
  'welcome',
  ...ROLE_TOUR_PRIORITY,
];

/** Whether a Steppy tour id is one of the onboarding tours. */
export function isOnboardingTourId(tourId: string): boolean {
  return Object.values(ONBOARDING_TOURS).includes(tourId);
}

/** The onboarding tour a Steppy tour id plays, or null. */
export function tourKeyOf(tourId: string): OnboardingTourKey | null {
  return ONBOARDING_TOUR_KEYS.find((key) => ONBOARDING_TOURS[key] === tourId) ?? null;
}

export type OnboardingOutcome = 'dismissed' | 'started' | 'completed' | 'abandoned' | 'backfilled';

/** One row of `GET /me/onboarding`. No row = never offered; any row = already offered. */
export interface OnboardingStateDTO {
  tour_key: string;
  outcome: OnboardingOutcome;
  tour_version: string | null;
  created_at: string;
  updated_at: string;
}

/** Body of `PUT /me/onboarding/:tour_key`. */
export interface UpdateOnboardingStateDTO {
  outcome: Exclude<OnboardingOutcome, 'backfilled'>;
  tour_version?: string;
}
