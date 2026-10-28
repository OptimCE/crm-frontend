import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { GuidedToursService } from '../../guided_tours/services/guided-tours.service';
import { TourManifest } from '../../guided_tours/tour-catalog';
import { OnboardingToursService } from './onboarding-tours.service';

const LAYOUTS = { desktop: '(min-width: 1024px)', mobile: '(max-width: 1023.98px)' };

function manifestWith(...ids: string[]): TourManifest {
  return {
    defaultLocale: 'fr',
    layouts: LAYOUTS,
    tours: ids.map((id) => ({
      id,
      role: 'member',
      entry: { route: '/home' },
      title: { fr: id },
      files: { fr: `${id}.fr.json`, en: `${id}.en.json` },
      integrity: { fr: `sha384-${id}-fr`, en: `sha384-${id}-en` },
    })),
  };
}

describe('OnboardingToursService', () => {
  let http: HttpTestingController;
  let loadManifest: ReturnType<typeof vi.fn>;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    loadManifest = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: GuidedToursService, useValue: { loadManifest } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === LAYOUTS.desktop }));
  });

  afterEach(() => {
    http.verify();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should list only the onboarding tours the manifest ships', async () => {
    loadManifest.mockResolvedValue(
      manifestWith('onboarding-welcome', 'onboarding-admin', 'home-overview'),
    );
    const available = await TestBed.inject(OnboardingToursService).available();
    expect([...available].sort()).toEqual(['community_admin', 'welcome']);
  });

  it('should count welcome by the variant the user plays', async () => {
    loadManifest.mockResolvedValue(manifestWith('onboarding-welcome'));
    const service = TestBed.inject(OnboardingToursService);
    expect([...(await service.available(false))]).toEqual(['welcome']);
    expect([...(await service.available(true))]).toEqual([]);
  });

  it('should describe the community variant of welcome for a user with a community', async () => {
    loadManifest.mockResolvedValue(
      manifestWith('onboarding-welcome', 'onboarding-welcome-community'),
    );
    const pending = TestBed.inject(OnboardingToursService).describe('welcome', 'fr', true);
    await vi.waitFor(() =>
      http.expectOne('tours/onboarding-welcome-community.fr.json').flush({ steps: [{ id: 'a' }] }),
    );
    expect(await pending).toEqual({
      key: 'welcome',
      tourId: 'onboarding-welcome-community',
      steps: 1,
      version: 'sha384-onboarding-welcome-community-fr',
    });
  });

  it('should warn once, in dev mode, about the tours that do not ship', async () => {
    loadManifest.mockResolvedValue(manifestWith('onboarding-welcome'));
    const service = TestBed.inject(OnboardingToursService);
    await service.available();
    await service.available();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      'Onboarding: no Steppy tour for',
      expect.stringContaining('community_member (onboarding-member)'),
      expect.any(String),
    );
  });

  it('should offer nothing when the manifest cannot be loaded', async () => {
    loadManifest.mockResolvedValue(null);
    expect((await TestBed.inject(OnboardingToursService).available()).size).toBe(0);
  });

  it('should describe a tour with its step count on this screen and its fr hash', async () => {
    loadManifest.mockResolvedValue(manifestWith('onboarding-member'));
    const pending = TestBed.inject(OnboardingToursService).describe('community_member', 'en');
    await vi.waitFor(() =>
      http.expectOne('tours/onboarding-member.en.json').flush({
        steps: [{ id: 'a' }, { id: 'b', layouts: ['desktop'] }, { id: 'c', layouts: ['mobile'] }],
      }),
    );
    expect(await pending).toEqual({
      key: 'community_member',
      tourId: 'onboarding-member',
      steps: 2,
      version: 'sha384-onboarding-member-fr',
    });
  });

  it('should leave the step count out when the tour file cannot be read', async () => {
    loadManifest.mockResolvedValue(manifestWith('onboarding-member'));
    const pending = TestBed.inject(OnboardingToursService).describe('community_member', 'fr');
    await vi.waitFor(() =>
      http
        .expectOne('tours/onboarding-member.fr.json')
        .flush('gone', { status: 404, statusText: 'Not Found' }),
    );
    expect((await pending)?.steps).toBeNull();
  });

  it('should describe nothing for a tour that does not ship', async () => {
    loadManifest.mockResolvedValue(manifestWith('onboarding-welcome'));
    expect(
      await TestBed.inject(OnboardingToursService).describe('community_admin', 'fr'),
    ).toBeNull();
  });
});
