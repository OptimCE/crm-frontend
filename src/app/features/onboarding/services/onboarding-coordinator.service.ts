import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationEnd, NavigationError, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { SteppyTours, SteppyTourEvent } from '@steppy/angular';
import Keycloak from 'keycloak-js';
import { filter, firstValueFrom } from 'rxjs';

import { environments } from '../../../../environments/environments';
import { ERROR_TYPE } from '../../../core/dtos/notification';
import { Role } from '../../../core/dtos/role';
import { UserContextService } from '../../../core/services/authorization/authorization.service';
import { LocaleService } from '../../../core/services/language/locale.service';
import { SnackbarNotification } from '../../../shared/services-ui/snackbar.notifcation.service';
import { CommunityService } from '../../../shared/services/community.service';
import { MeService } from '../../../shared/services/me.service';
import { MemberStatus } from '../../../shared/types/member.types';
import { OnboardingCheckpoint, pickOnboardingTour, roleToursFor } from '../onboarding-eligibility';
import { OnboardingOutcome, OnboardingTourKey, RoleTourKey, tourKeyOf } from '../onboarding-tours';
import { OnboardingApiService } from './onboarding-api.service';
import { OnboardingTourInfo, OnboardingToursService } from './onboarding-tours.service';

/** The offer on screen: the welcome dialog, or the role banner. */
export interface OnboardingOffer {
  key: OnboardingTourKey;
  kind: 'welcome' | 'role';
  tour: OnboardingTourInfo;
  /** The activated community's name; null for welcome. */
  community: string | null;
  /** The page it was offered on. Leaving it withdraws the offer, with nothing recorded. */
  path: string;
}

/**
 * The global the generated E2E tests set in every browser context so that an
 * app cannot start a tour on its own over the elements a test clicks
 * (`TOURS_KILL_SWITCH_GLOBAL` in @steppy/player). Offering a tour that cannot
 * start would be pointless, so it also silences every offer.
 */
const STEPPY_KILL_SWITCH = '__STEPPY_TOURS_DISABLED__';

type AnswerOutcome = Exclude<OnboardingOutcome, 'backfilled'>;
interface EventTransition {
  to: AnswerOutcome;
  from: (OnboardingOutcome | null)[];
}

/** The recorded outcome a Steppy event moves an onboarding tour to, and from which one. */
const EVENT_OUTCOMES: Partial<Record<SteppyTourEvent['type'], EventTransition>> = {
  // A tour started from the offer or from the Help dialog: either way it was seen.
  'tour-start': { to: 'started', from: [null] },
  'tour-complete': { to: 'completed', from: ['started'] },
  'tour-dismiss': { to: 'abandoned', from: ['started'] },
};

/**
 * When to offer an onboarding tour, and what to record of the answer.
 *
 * Checkpoints: landing on /home (candidate `welcome`), and every activation of
 * a community — picked, created, joined, restored at start-up, or the user's
 * roles in it changed (candidates: the role tours of that community).
 * `pickOnboardingTour` decides; this service gathers its inputs, shows at most
 * one offer, and writes the answer through `/me/onboarding`.
 *
 * Never offers while a tour is playing, while the Steppy kill switch is set
 * (every generated E2E test sets it), or when `onboarding.enabled` is false in
 * the runtime config.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingCoordinator {
  private readonly router = inject(Router);
  private readonly keycloak = inject(Keycloak);
  private readonly userContext = inject(UserContextService);
  private readonly api = inject(OnboardingApiService);
  private readonly tours = inject(OnboardingToursService);
  private readonly steppy = inject(SteppyTours);
  private readonly locale = inject(LocaleService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly meService = inject(MeService);
  private readonly communityService = inject(CommunityService);
  private readonly destroyRef = inject(DestroyRef);

  /** The offer on screen, if any. */
  readonly offer = signal<OnboardingOffer | null>(null);

  /**
   * The welcome tour was accepted and is starting. The dialog keeps its dimmed
   * backdrop until the tour shows its first step, so the screen never flashes
   * undimmed between the two.
   */
  readonly launching = signal(false);

  /** The active community and the user's roles in it: a change of either is an activation. */
  private readonly activationKey = computed(() => {
    const community = this.userContext.activeCommunity();
    return community ? `${community.orgId}|${[...community.roles].sort().join(',')}` : null;
  });

  private readonly started = signal(false);
  /** Per checkpoint kind, only the latest evaluation may show an offer. */
  private readonly sequence: Record<OnboardingCheckpoint['kind'], number> = {
    landing: 0,
    activation: 0,
  };
  /** The page `welcome` was answered on: no role offer follows it on that same page. */
  private welcomeHandledPath: string | null = null;
  private launchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Also runs once when start() flips `started`: that run is the checkpoint of
    // the community restored at start-up (the shell refreshes the context first).
    effect(() => {
      if (!this.started() || !this.activationKey()) return;
      // Untracked: the checkpoint reads `offer` and the tour state, and closing
      // an offer must not count as an activation (it would offer it again).
      untracked(() => void this.checkpoint('activation'));
    });
  }

  /** Wires the checkpoints. Called once by the app shell, signed in. */
  start(): void {
    if (this.started()) return;
    this.started.set(true);

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => this.onNavigated(pathOf(event.urlAfterRedirects)));

    this.steppy.events
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.onTourEvent(event));

    if (pathOf(this.router.url) === '/home') void this.checkpoint('landing');
  }

  /** "Show me": starts the tour. Its `started` row comes from the tour's own start event. */
  async accept(): Promise<void> {
    const offer = this.offer();
    if (!offer || this.launching()) return;
    if (offer.kind === 'welcome') {
      this.welcomeHandledPath = offer.path;
      this.launching.set(true);
      // Safety net: never leave the backdrop up if the tour never shows a step.
      this.launchTimer = setTimeout(() => this.endLaunch(), 12_000);
    } else {
      this.offer.set(null);
    }
    const started = await this.steppy.start(offer.tour.tourId);
    if (!started) {
      this.endLaunch();
      this.offer.set(null);
      // Offered and answered, even though the tour could not play: not offered again.
      await this.record(offer.key, 'dismissed', offer.tour.version);
      this.snackbar.openSnackBar(
        this.translate.instant('HELP.TOURS.START_FAILED') as string,
        ERROR_TYPE,
      );
    }
  }

  /** "Later", the close button or Escape: the tour is never offered again. */
  async later(): Promise<void> {
    const offer = this.offer();
    if (!offer || this.launching()) return;
    if (offer.kind === 'welcome') this.welcomeHandledPath = offer.path;
    this.offer.set(null);
    await this.record(offer.key, 'dismissed', offer.tour.version);
  }

  private onNavigated(path: string): void {
    const offer = this.offer();
    // Left the page without answering: withdrawn, nothing recorded, offered
    // again at the next activation.
    if (offer && offer.path !== path && !this.launching()) this.offer.set(null);
    if (this.welcomeHandledPath !== path) this.welcomeHandledPath = null;
    if (path === '/home') void this.checkpoint('landing');
  }

  private canOffer(): boolean {
    return (
      environments.onboarding.enabled &&
      !killSwitchSet() &&
      !!this.keycloak.authenticated &&
      !this.steppy.active() &&
      !this.launching() &&
      this.offer() === null
    );
  }

  private async checkpoint(kind: OnboardingCheckpoint['kind']): Promise<void> {
    if (!this.canOffer()) return;
    const sequence = ++this.sequence[kind];
    await this.navigationSettled();
    const path = pathOf(this.router.url);
    const orgId = this.userContext.activeCommunityId();

    const [states, available] = await Promise.all([
      firstValueFrom(this.api.getStates()).catch(() => null),
      this.tours.available(),
    ]);
    // Without the recorded answers, offering could repeat one: offer nothing.
    if (!states) return;
    const recorded = new Set(states.map((s) => s.tour_key));

    let checkpoint: OnboardingCheckpoint;
    let community: string | null = null;
    if (kind === 'landing') {
      if (path !== '/home') return;
      checkpoint = {
        kind,
        hasCommunity: Object.keys(this.userContext.communitiesById()).length > 0,
      };
    } else {
      const active = this.userContext.activeCommunity();
      if (!active || active.orgId !== orgId) return;
      community = active.name;
      // The member record lookup costs two requests: only when it can change the answer.
      const memberUnknown =
        !active.roles.includes(Role.MEMBER) &&
        !recorded.has('community_member') &&
        available.has('community_member');
      const linked = memberUnknown ? await this.hasActiveLinkedMember(active.orgId) : false;
      checkpoint = { kind, roles: roleToursFor(active.roles, linked) };
    }

    const key = pickOnboardingTour({
      checkpoint,
      recorded,
      available,
      welcomeHandledOnScreen: this.welcomeHandledPath === path,
    });
    if (!key) return;
    const tour = await this.tours.describe(key, this.locale.locale());
    if (!tour) return;

    // Anything may have moved while we were waiting on the network.
    if (sequence !== this.sequence[kind] || !this.canOffer()) return;
    if (pathOf(this.router.url) !== path || this.userContext.activeCommunityId() !== orgId) return;
    this.offer.set({ key, kind: key === 'welcome' ? 'welcome' : 'role', tour, community, path });
  }

  /** The role tours of the active community (empty without one), for the Help dialog's replay list. */
  async activeRoleTours(): Promise<Set<RoleTourKey>> {
    const active = this.userContext.activeCommunity();
    if (!active) return new Set();
    const linked = active.roles.includes(Role.MEMBER)
      ? false
      : await this.hasActiveLinkedMember(active.orgId);
    return roleToursFor(active.roles, linked);
  }

  /** An ACTIVE member record linked to the user in this community (an admin can be a member too). */
  private async hasActiveLinkedMember(orgId: string): Promise<boolean> {
    try {
      const [communities, members] = await Promise.all([
        firstValueFrom(this.communityService.getMyCommunities({ page: 1, limit: 100 })),
        firstValueFrom(this.meService.getMembers({ page: 1, limit: 100 })),
      ]);
      const id = (Array.isArray(communities.data) ? communities.data : []).find(
        (c) => c.auth_community_id === orgId,
      )?.id;
      const records = Array.isArray(members.data) ? members.data : [];
      return records.some((m) => m.community?.id === id && m.status === MemberStatus.ACTIVE);
    } catch {
      return false;
    }
  }

  private onTourEvent(event: SteppyTourEvent): void {
    const key = tourKeyOf(event.detail.tourId ?? '');
    if (!key) return;
    if (event.type === 'tour-step' || event.type === 'tour-dismiss') this.endLaunch();
    if (event.type === 'tour-error' && event.detail.fatal) {
      this.endLaunch();
      void this.recordFromEvent(key, { to: 'abandoned', from: ['started'] });
      return;
    }
    const transition = EVENT_OUTCOMES[event.type];
    if (transition) void this.recordFromEvent(key, transition);
  }

  /**
   * Writes what the tour reported, only when the API would accept it: a tour
   * replayed from the Help dialog after it was answered leaves the row alone.
   */
  private async recordFromEvent(
    key: OnboardingTourKey,
    transition: EventTransition,
  ): Promise<void> {
    try {
      const states = await firstValueFrom(this.api.getStates());
      const current = states.find((s) => s.tour_key === key)?.outcome ?? null;
      if (!transition.from.includes(current)) return;
      const info = await this.tours.describe(key, this.locale.locale());
      await this.record(key, transition.to, info?.version ?? null);
    } catch (error) {
      console.error('Onboarding: could not record the tour outcome', error);
    }
  }

  private async record(
    key: OnboardingTourKey,
    outcome: AnswerOutcome,
    version: string | null,
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.api.setState(key, version ? { outcome, tour_version: version } : { outcome }),
      );
    } catch (error) {
      console.error('Onboarding: could not record the answer', error);
    }
  }

  private endLaunch(): void {
    if (this.launchTimer) clearTimeout(this.launchTimer);
    this.launchTimer = null;
    if (!this.launching()) return;
    this.launching.set(false);
    this.offer.set(null);
  }

  private async navigationSettled(): Promise<void> {
    if (!this.router.getCurrentNavigation()) return;
    await firstValueFrom(
      this.router.events.pipe(
        filter(
          (e) =>
            e instanceof NavigationEnd ||
            e instanceof NavigationCancel ||
            e instanceof NavigationError,
        ),
      ),
    );
  }
}

function pathOf(url: string): string {
  return url.split(/[?#]/)[0] || '/';
}

function killSwitchSet(): boolean {
  return (globalThis as Record<string, unknown>)[STEPPY_KILL_SWITCH] === true;
}
