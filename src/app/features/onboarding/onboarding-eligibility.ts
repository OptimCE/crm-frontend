import { Role } from '../../core/dtos/role';
import { OnboardingTourKey, ROLE_TOUR_PRIORITY, RoleTourKey } from './onboarding-tours';

/**
 * Which onboarding tour to offer, if any. Pure: the coordinator gathers the
 * inputs, this decides. The single source of truth for "what to offer".
 *
 * Two checkpoints:
 * - `landing`: the post-login landing page (/home). The only candidate is
 *   `welcome`, and only for a user who belongs to no community yet: the tour is
 *   written for that empty state (its first step is the empty community picker).
 * - `activation`: a community just became the active one (picked, created,
 *   joined, or restored at start-up), or the user's roles in it changed. The
 *   candidates are the role tours of THAT community, in ROLE_TOUR_PRIORITY.
 *
 * A candidate is offered when the user has no recorded answer for it ("first
 * time" is per user, across communities) and the tour actually ships. One tour
 * at a time: when `welcome` was handled on the current screen, the role tours
 * wait for the next activation.
 */
export type OnboardingCheckpoint =
  | { kind: 'landing'; hasCommunity: boolean }
  | { kind: 'activation'; roles: ReadonlySet<RoleTourKey> };

export interface EligibilityInput {
  checkpoint: OnboardingCheckpoint;
  /** The tour keys with a recorded answer, whatever the outcome. */
  recorded: ReadonlySet<string>;
  /** The tour keys whose Steppy tour ships in this build. */
  available: ReadonlySet<OnboardingTourKey>;
  /** `welcome` was offered (and answered) on the current screen. */
  welcomeHandledOnScreen?: boolean;
}

export function pickOnboardingTour(input: EligibilityInput): OnboardingTourKey | null {
  const { checkpoint, recorded, available } = input;
  const candidates: OnboardingTourKey[] =
    checkpoint.kind === 'landing'
      ? checkpoint.hasCommunity
        ? []
        : ['welcome']
      : input.welcomeHandledOnScreen
        ? []
        : ROLE_TOUR_PRIORITY.filter((key) => checkpoint.roles.has(key));
  return candidates.find((key) => !recorded.has(key) && available.has(key)) ?? null;
}

/**
 * The role tours a user is eligible to in one community.
 *
 * - admin and manager come from the token's role for that community;
 * - member means the MEMBER role there, OR at least one ACTIVE member record
 *   linked to the user in that community (an admin can also be a member).
 */
export function roleToursFor(
  roles: readonly Role[],
  hasActiveLinkedMember: boolean,
): Set<RoleTourKey> {
  const tours = new Set<RoleTourKey>();
  if (roles.includes(Role.ADMIN)) tours.add('community_admin');
  if (roles.includes(Role.GESTIONNAIRE)) tours.add('community_manager');
  if (roles.includes(Role.MEMBER) || hasActiveLinkedMember) tours.add('community_member');
  return tours;
}

/**
 * The onboarding tours the Help dialog lists for a replay, whatever was
 * recorded: `welcome` while the user has no community (the only state its
 * steps exist in), then the role tours of the active community.
 */
export function replayableTours(
  hasCommunity: boolean,
  roles: ReadonlySet<RoleTourKey>,
  available: ReadonlySet<OnboardingTourKey>,
): OnboardingTourKey[] {
  const keys: OnboardingTourKey[] = [
    ...(hasCommunity ? [] : (['welcome'] as const)),
    ...ROLE_TOUR_PRIORITY.filter((key) => roles.has(key)),
  ];
  return keys.filter((key) => available.has(key));
}
