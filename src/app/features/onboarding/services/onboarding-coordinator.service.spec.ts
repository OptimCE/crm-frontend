import { Component, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { SteppyTours, SteppyTourEvent } from '@steppy/angular';
import Keycloak from 'keycloak-js';
import { of, Subject, throwError } from 'rxjs';

import {
  environments,
  RuntimeConfig,
  setRuntimeConfig,
} from '../../../../environments/environments';
import { Role } from '../../../core/dtos/role';
import { UserContextService } from '../../../core/services/authorization/authorization.service';
import { LocaleService } from '../../../core/services/language/locale.service';
import { SnackbarNotification } from '../../../shared/services-ui/snackbar.notifcation.service';
import { CommunityService } from '../../../shared/services/community.service';
import { MeService } from '../../../shared/services/me.service';
import { MemberStatus } from '../../../shared/types/member.types';
import {
  ONBOARDING_TOUR_KEYS,
  ONBOARDING_TOURS,
  OnboardingStateDTO,
  OnboardingTourKey,
} from '../onboarding-tours';
import { OnboardingApiService } from './onboarding-api.service';
import { OnboardingCoordinator } from './onboarding-coordinator.service';
import { OnboardingToursService } from './onboarding-tours.service';

@Component({ template: '' })
class Blank {}

interface Org {
  orgId: string;
  orgPath: string;
  name: string;
  roles: Role[];
}

const SOLEIL: Org = { orgId: 'org-1', orgPath: '/Soleil', name: 'Soleil', roles: [Role.ADMIN] };

describe('OnboardingCoordinator', () => {
  let communitiesById: ReturnType<typeof signal<Record<string, Org>>>;
  let activeCommunityId: ReturnType<typeof signal<string | null>>;
  let states: OnboardingStateDTO[];
  let getStates: ReturnType<typeof vi.fn>;
  let setState: ReturnType<typeof vi.fn>;
  let available: Set<OnboardingTourKey>;
  let tourEvents: Subject<SteppyTourEvent>;
  let tourActive: ReturnType<typeof signal<boolean>>;
  let start: ReturnType<typeof vi.fn>;
  let openSnackBar: ReturnType<typeof vi.fn>;
  let getMembers: ReturnType<typeof vi.fn>;

  function row(tour_key: string, outcome: OnboardingStateDTO['outcome']): OnboardingStateDTO {
    return { tour_key, outcome, tour_version: null, created_at: '', updated_at: '' };
  }

  beforeEach(() => {
    communitiesById = signal<Record<string, Org>>({});
    activeCommunityId = signal<string | null>(null);
    states = [];
    getStates = vi.fn(() => of(states));
    setState = vi.fn((key: string, body: { outcome: OnboardingStateDTO['outcome'] }) => {
      states = [...states.filter((s) => s.tour_key !== key), row(key, body.outcome)];
      return of(row(key, body.outcome));
    });
    available = new Set(ONBOARDING_TOUR_KEYS);
    tourEvents = new Subject<SteppyTourEvent>();
    tourActive = signal(false);
    start = vi.fn().mockResolvedValue(true);
    openSnackBar = vi.fn();
    getMembers = vi.fn(() => of({ data: [] }));

    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'home', component: Blank },
          { path: 'dashboard', component: Blank },
          { path: 'members', component: Blank },
        ]),
        { provide: Keycloak, useValue: { authenticated: true } },
        {
          provide: UserContextService,
          useValue: {
            communitiesById,
            activeCommunityId,
            activeCommunity: computed(() => {
              const id = activeCommunityId();
              return id ? (communitiesById()[id] ?? null) : null;
            }),
          },
        },
        { provide: OnboardingApiService, useValue: { getStates, setState } },
        {
          provide: OnboardingToursService,
          useValue: {
            available: () => Promise.resolve(new Set(available)),
            describe: (key: OnboardingTourKey) =>
              Promise.resolve(
                available.has(key)
                  ? { key, tourId: ONBOARDING_TOURS[key], steps: 9, version: `sha384-${key}` }
                  : null,
              ),
          },
        },
        { provide: SteppyTours, useValue: { active: tourActive, events: tourEvents, start } },
        { provide: LocaleService, useValue: { locale: signal('fr') } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: SnackbarNotification, useValue: { openSnackBar } },
        { provide: MeService, useValue: { getMembers } },
        {
          provide: CommunityService,
          useValue: {
            getMyCommunities: () => of({ data: [{ id: 7, auth_community_id: 'org-1' }] }),
          },
        },
      ],
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>)['__STEPPY_TOURS_DISABLED__'];
    setRuntimeConfig({});
    vi.restoreAllMocks();
  });

  async function settle(): Promise<void> {
    for (let i = 0; i < 5; i++) {
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  async function startAt(url: string): Promise<OnboardingCoordinator> {
    await TestBed.inject(Router).navigateByUrl(url);
    const coordinator = TestBed.inject(OnboardingCoordinator);
    coordinator.start();
    await settle();
    return coordinator;
  }

  function activate(org: Org): void {
    communitiesById.set({ ...communitiesById(), [org.orgId]: org });
    activeCommunityId.set(org.orgId);
  }

  function emit(
    type: SteppyTourEvent['type'],
    tourId: string,
    extra: Record<string, unknown> = {},
  ): void {
    tourEvents.next({
      type,
      detail: { tourId, buildId: 'b', locale: 'fr', ...extra },
    } as SteppyTourEvent);
  }

  describe('checkpoints', () => {
    it('should offer welcome on landing to a user with no community', async () => {
      const coordinator = await startAt('/home');
      expect(coordinator.offer()).toMatchObject({
        key: 'welcome',
        kind: 'welcome',
        path: '/home',
        community: null,
      });
      expect(coordinator.offer()?.tour.steps).toBe(9);
    });

    it('should offer welcome when the user navigates to the landing page later', async () => {
      // The checkpoint then runs from the NavigationEnd handler, where the router
      // still reports the ending navigation as current: it must not wait on it.
      const coordinator = await startAt('/members');
      expect(coordinator.offer()).toBeNull();
      await TestBed.inject(Router).navigateByUrl('/home');
      await settle();
      expect(coordinator.offer()?.key).toBe('welcome');
    });

    it('should offer on the page the initial navigation lands on, when started before it', async () => {
      // At start-up the shell starts the coordinator before the first navigation ends.
      activate(SOLEIL);
      states = [row('welcome', 'backfilled')];
      const coordinator = TestBed.inject(OnboardingCoordinator);
      coordinator.start();
      await TestBed.inject(Router).navigateByUrl('/dashboard');
      await settle();
      expect(coordinator.offer()).toMatchObject({ key: 'community_admin', path: '/dashboard' });
    });

    it('should not offer welcome to a user who already has a community', async () => {
      communitiesById.set({ [SOLEIL.orgId]: SOLEIL });
      const coordinator = await startAt('/home');
      expect(coordinator.offer()).toBeNull();
    });

    it('should not offer welcome on another page than the landing page', async () => {
      const coordinator = await startAt('/members');
      expect(coordinator.offer()).toBeNull();
    });

    it('should offer the role tour of the community restored at start-up', async () => {
      activate(SOLEIL);
      states = [row('welcome', 'backfilled')];
      const coordinator = await startAt('/dashboard');
      expect(coordinator.offer()).toMatchObject({
        key: 'community_admin',
        kind: 'role',
        community: 'Soleil',
        path: '/dashboard',
      });
    });

    it('should offer the role tour when a community becomes active later (created, joined, picked)', async () => {
      states = [row('welcome', 'dismissed')];
      const coordinator = await startAt('/members');
      expect(coordinator.offer()).toBeNull();

      activate({ ...SOLEIL, roles: [Role.MEMBER] });
      await settle();
      expect(coordinator.offer()?.key).toBe('community_member');
    });

    it('should offer the manager tour when the roles change in the active community (member made manager)', async () => {
      activate({ ...SOLEIL, roles: [Role.MEMBER] });
      states = [row('welcome', 'backfilled'), row('community_member', 'completed')];
      const coordinator = await startAt('/dashboard');
      expect(coordinator.offer()).toBeNull();

      activate({ ...SOLEIL, roles: [Role.GESTIONNAIRE] });
      await settle();
      expect(coordinator.offer()?.key).toBe('community_manager');
    });

    it('should offer the member tour to an admin with an active linked member, once the admin tour is seen', async () => {
      getMembers.mockReturnValue(
        of({ data: [{ id: 1, community: { id: 7 }, status: MemberStatus.ACTIVE }] }),
      );
      activate(SOLEIL);
      states = [row('welcome', 'backfilled'), row('community_admin', 'completed')];
      const coordinator = await startAt('/dashboard');
      expect(coordinator.offer()?.key).toBe('community_member');
    });

    it('should not count an inactive linked member', async () => {
      getMembers.mockReturnValue(
        of({ data: [{ id: 1, community: { id: 7 }, status: MemberStatus.INACTIVE }] }),
      );
      activate(SOLEIL);
      states = [row('welcome', 'backfilled'), row('community_admin', 'completed')];
      expect((await startAt('/dashboard')).offer()).toBeNull();
    });
  });

  describe('guards', () => {
    it('should offer nothing while the Steppy kill switch is set (every generated E2E test sets it)', async () => {
      (globalThis as Record<string, unknown>)['__STEPPY_TOURS_DISABLED__'] = true;
      expect((await startAt('/home')).offer()).toBeNull();
    });

    it('should offer nothing when onboarding is disabled in the runtime config', async () => {
      setRuntimeConfig({ onboarding: { enabled: false } } as Partial<RuntimeConfig>);
      expect(environments.onboarding.enabled).toBe(false);
      expect((await startAt('/home')).offer()).toBeNull();
    });

    it('should offer nothing while a tour is playing', async () => {
      tourActive.set(true);
      expect((await startAt('/home')).offer()).toBeNull();
    });

    it('should offer nothing when the recorded answers cannot be read', async () => {
      getStates.mockReturnValue(throwError(() => new Error('503')));
      expect((await startAt('/home')).offer()).toBeNull();
    });

    it('should not offer a tour that was already answered', async () => {
      states = [row('welcome', 'completed')];
      expect((await startAt('/home')).offer()).toBeNull();
    });

    it('should not offer a tour whose scenario does not ship', async () => {
      available = new Set(['community_admin']);
      expect((await startAt('/home')).offer()).toBeNull();
    });

    it('should show one offer at a time', async () => {
      const coordinator = await startAt('/home');
      expect(coordinator.offer()?.key).toBe('welcome');
      activate(SOLEIL);
      await settle();
      expect(coordinator.offer()?.key).toBe('welcome');
    });
  });

  describe('answers', () => {
    it('should record "Later" as dismissed, with the tour version, and close the offer', async () => {
      const coordinator = await startAt('/home');
      await coordinator.later();
      expect(setState).toHaveBeenCalledWith('welcome', {
        outcome: 'dismissed',
        tour_version: 'sha384-welcome',
      });
      expect(coordinator.offer()).toBeNull();
    });

    it('should not offer the banner again once it is answered or withdrawn', async () => {
      activate(SOLEIL);
      states = [row('welcome', 'backfilled')];
      getStates.mockImplementation(() => of([...states]));
      const coordinator = await startAt('/dashboard');
      await coordinator.later();
      await settle();
      expect(coordinator.offer()).toBeNull();
      expect(setState).toHaveBeenCalledTimes(1);
    });

    it('should start the role tour and close the banner on "Show me"', async () => {
      activate(SOLEIL);
      states = [row('welcome', 'backfilled')];
      const coordinator = await startAt('/dashboard');
      await coordinator.accept();
      expect(start).toHaveBeenCalledWith('onboarding-admin');
      expect(coordinator.offer()).toBeNull();
    });

    it('should keep the welcome backdrop until the tour shows its first step', async () => {
      const coordinator = await startAt('/home');
      await coordinator.accept();
      expect(coordinator.launching()).toBe(true);
      expect(coordinator.offer()?.key).toBe('welcome');

      emit('tour-step', 'onboarding-welcome', { stepId: 's1', index: 0, total: 11 });
      expect(coordinator.launching()).toBe(false);
      expect(coordinator.offer()).toBeNull();
    });

    it('should record dismissed and say so when the tour cannot start', async () => {
      start.mockResolvedValue(false);
      const coordinator = await startAt('/home');
      await coordinator.accept();
      expect(setState).toHaveBeenCalledWith('welcome', {
        outcome: 'dismissed',
        tour_version: 'sha384-welcome',
      });
      expect(openSnackBar).toHaveBeenCalled();
      expect(coordinator.offer()).toBeNull();
      expect(coordinator.launching()).toBe(false);
    });

    it('should record nothing when the user leaves the page without answering', async () => {
      activate(SOLEIL);
      states = [row('welcome', 'backfilled')];
      const coordinator = await startAt('/dashboard');
      expect(coordinator.offer()).not.toBeNull();

      await TestBed.inject(Router).navigateByUrl('/members');
      await settle();
      expect(coordinator.offer()).toBeNull();
      expect(setState).not.toHaveBeenCalled();
    });
  });

  describe('tour events', () => {
    it('should record started when an onboarding tour starts with no answer yet (also from the Help dialog)', async () => {
      states = [row('welcome', 'backfilled')];
      await startAt('/members');
      emit('tour-start', 'onboarding-manager', { total: 8 });
      await settle();
      expect(setState).toHaveBeenCalledWith('community_manager', {
        outcome: 'started',
        tour_version: 'sha384-community_manager',
      });
    });

    it('should leave an answered tour alone when it is replayed', async () => {
      states = [row('welcome', 'completed')];
      await startAt('/members');
      emit('tour-start', 'onboarding-welcome', { total: 11 });
      await settle();
      emit('tour-complete', 'onboarding-welcome', { total: 11 });
      await settle();
      expect(setState).not.toHaveBeenCalled();
    });

    it.each([
      ['tour-complete', {}, 'completed'],
      ['tour-dismiss', { via: 'close' }, 'abandoned'],
      ['tour-error', { fatal: true, reason: 'target-timeout' }, 'abandoned'],
    ] as const)('should map %s to %s for a started tour', async (type, extra, outcome) => {
      states = [row('welcome', 'backfilled'), row('community_member', 'started')];
      await startAt('/members');
      emit(type, 'onboarding-member', extra);
      await settle();
      expect(setState).toHaveBeenCalledWith(
        'community_member',
        expect.objectContaining({ outcome }),
      );
    });

    it('should ignore a non-fatal error and the other tours', async () => {
      states = [row('community_member', 'started')];
      await startAt('/members');
      emit('tour-error', 'onboarding-member', { fatal: false, reason: 'target-timeout' });
      emit('tour-complete', 'home-overview', {});
      await settle();
      expect(setState).not.toHaveBeenCalled();
    });
  });
});
