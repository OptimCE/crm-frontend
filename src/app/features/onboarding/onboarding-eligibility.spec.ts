import { Role } from '../../core/dtos/role';
import {
  EligibilityInput,
  pickOnboardingTour,
  replayableTours,
  roleToursFor,
} from './onboarding-eligibility';
import { ONBOARDING_TOUR_KEYS, OnboardingTourKey } from './onboarding-tours';

const ALL = new Set<OnboardingTourKey>(ONBOARDING_TOUR_KEYS);

function pick(overrides: Partial<EligibilityInput> & Pick<EligibilityInput, 'checkpoint'>) {
  return pickOnboardingTour({ recorded: new Set(), available: ALL, ...overrides });
}

function activation(roles: Role[], hasActiveLinkedMember = false) {
  return { kind: 'activation' as const, roles: roleToursFor(roles, hasActiveLinkedMember) };
}

describe('pickOnboardingTour', () => {
  describe('at the landing page', () => {
    it('should offer welcome to a new user who belongs to no community', () => {
      expect(pick({ checkpoint: { kind: 'landing', hasCommunity: false } })).toBe('welcome');
    });

    it('should not offer welcome to a user who already belongs to a community', () => {
      // The welcome tour is written for the empty state: its first step is the empty picker.
      expect(pick({ checkpoint: { kind: 'landing', hasCommunity: true } })).toBeNull();
    });

    it('should not offer welcome twice, nor a role tour in its place', () => {
      expect(
        pick({
          checkpoint: { kind: 'landing', hasCommunity: false },
          recorded: new Set(['welcome']),
        }),
      ).toBeNull();
    });
  });

  describe('when a community is activated', () => {
    it('should offer the member tour to a member only', () => {
      expect(pick({ checkpoint: activation([Role.MEMBER]) })).toBe('community_member');
    });

    it('should offer the admin tour, and not the member one, to an admin who is not a member', () => {
      const checkpoint = activation([Role.ADMIN]);
      expect(pick({ checkpoint })).toBe('community_admin');
      expect(pick({ checkpoint, recorded: new Set(['community_admin']) })).toBeNull();
    });

    it('should offer admin first, then member at the next activation, to an admin who is also a member', () => {
      const checkpoint = activation([Role.ADMIN], true);
      expect(pick({ checkpoint })).toBe('community_admin');
      expect(pick({ checkpoint, recorded: new Set(['community_admin']) })).toBe('community_member');
    });

    it('should offer the admin tour right after the user created a community', () => {
      // Creation makes the creator ADMIN with no member record; the new community is activated.
      expect(pick({ checkpoint: activation([Role.ADMIN]), recorded: new Set(['welcome']) })).toBe(
        'community_admin',
      );
    });

    it('should offer the member tour after a member invitation is accepted', () => {
      expect(
        pick({ checkpoint: activation([Role.MEMBER], true), recorded: new Set(['welcome']) }),
      ).toBe('community_member');
    });

    it('should offer the manager tour after a manager invitation is accepted', () => {
      expect(
        pick({ checkpoint: activation([Role.GESTIONNAIRE]), recorded: new Set(['welcome']) }),
      ).toBe('community_manager');
    });

    it('should offer the manager tour when a member made manager while away gets the community restored at start-up', () => {
      // Same checkpoint as any activation: the restore at start-up activates the stored community.
      const recorded = new Set(['welcome', 'community_member']);
      expect(pick({ checkpoint: activation([Role.GESTIONNAIRE], true), recorded })).toBe(
        'community_manager',
      );
    });

    it('should not offer anything once every tour was seen', () => {
      expect(
        pick({
          checkpoint: activation([Role.ADMIN], true),
          recorded: new Set(ONBOARDING_TOUR_KEYS),
        }),
      ).toBeNull();
    });

    it('should count any recorded outcome as seen, backfilled included', () => {
      // `recorded` holds keys whatever their outcome: dismissed, started, completed, abandoned or backfilled.
      expect(
        pick({ checkpoint: activation([Role.MEMBER]), recorded: new Set(['community_member']) }),
      ).toBeNull();
    });

    it('should not offer a tour whose scenario does not ship', () => {
      const available = new Set<OnboardingTourKey>(['welcome', 'community_member']);
      expect(pick({ checkpoint: activation([Role.GESTIONNAIRE]), available })).toBeNull();
    });

    it('should fall through to the next role when the first one has no tour', () => {
      const available = new Set<OnboardingTourKey>(['community_member']);
      expect(pick({ checkpoint: activation([Role.ADMIN], true), available })).toBe(
        'community_member',
      );
    });

    it('should offer nothing when welcome was handled on this screen', () => {
      expect(
        pick({ checkpoint: activation([Role.ADMIN]), welcomeHandledOnScreen: true }),
      ).toBeNull();
    });

    it('should offer nothing in a community where the user holds no role', () => {
      expect(pick({ checkpoint: activation([]) })).toBeNull();
    });
  });
});

describe('roleToursFor', () => {
  it('should map each token role to its tour', () => {
    expect([...roleToursFor([Role.ADMIN], false)]).toEqual(['community_admin']);
    expect([...roleToursFor([Role.GESTIONNAIRE], false)]).toEqual(['community_manager']);
    expect([...roleToursFor([Role.MEMBER], false)]).toEqual(['community_member']);
  });

  it('should add the member tour for an active linked member record, whatever the role', () => {
    expect([...roleToursFor([Role.GESTIONNAIRE], true)].sort()).toEqual([
      'community_manager',
      'community_member',
    ]);
  });
});

describe('replayableTours', () => {
  it('should list welcome for a user without a community', () => {
    expect(replayableTours(false, new Set(), ALL)).toEqual(['welcome']);
  });

  it('should list the role tours of the active community, highest role first', () => {
    expect(replayableTours(true, roleToursFor([Role.ADMIN], true), ALL)).toEqual([
      'community_admin',
      'community_member',
    ]);
  });

  it('should leave out the tours that do not ship', () => {
    expect(
      replayableTours(true, roleToursFor([Role.ADMIN], true), new Set(['community_member'])),
    ).toEqual(['community_member']);
  });
});
