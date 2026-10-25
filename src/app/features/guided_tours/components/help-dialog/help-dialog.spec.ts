import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { DynamicDialogRef } from 'primeng/dynamicdialog';

import { Role } from '../../../../core/dtos/role';
import { GuidedToursService, GuidedToursState } from '../../services/guided-tours.service';
import { TourManifest } from '../../tour-catalog';
import { HelpDialog, USER_GUIDE_URL } from './help-dialog';
import { OnboardingCoordinator } from '../../../onboarding/services/onboarding-coordinator.service';
import { OnboardingToursService } from '../../../onboarding/services/onboarding-tours.service';
import {
  ONBOARDING_TOUR_KEYS,
  OnboardingTourKey,
  RoleTourKey,
} from '../../../onboarding/onboarding-tours';

const MANIFEST: TourManifest = {
  defaultLocale: 'fr',
  tours: [
    {
      id: 'key-create-wizard',
      role: 'admin',
      entry: { route: '/keys' },
      title: { fr: 'Modifier une clé' },
    },
    {
      id: 'key-create-gridform',
      role: 'admin',
      entry: { route: '/keys' },
      title: { fr: 'Supprimer une clé' },
    },
    {
      id: 'meter-update',
      role: 'admin',
      entry: { route: '/meters' },
      title: { fr: 'Modifier un compteur' },
    },
    {
      id: 'meter-deactivate',
      role: 'admin',
      entry: { route: '/meters/:meterEan' },
      title: { fr: 'Désactiver un compteur' },
    },
    {
      id: 'home-overview',
      role: 'member',
      entry: { route: '/home' },
      title: { fr: 'Votre accueil' },
    },
    {
      id: 'onboarding-welcome',
      role: 'newcomer',
      entry: { route: '/home' },
      title: { fr: 'Bienvenue sur OptimCE' },
    },
    {
      id: 'onboarding-manager',
      role: 'manager',
      entry: { route: '/home' },
      title: { fr: 'Vous êtes gestionnaire' },
    },
    {
      id: 'onboarding-member',
      role: 'member',
      entry: { route: '/home' },
      title: { fr: 'Vous êtes membre' },
    },
  ],
};

/** What the onboarding services report: which tours ship, and the roles in the active community. */
let onboarding: {
  available: Set<OnboardingTourKey>;
  roles: Set<RoleTourKey>;
};

function state(
  overrides: Partial<GuidedToursState['context']> = {},
  manifest: TourManifest | null = MANIFEST,
) {
  return {
    manifest,
    context: {
      role: Role.GESTIONNAIRE,
      activeFeatures: new Set<string>(),
      url: '/home',
      ...overrides,
    },
  } satisfies GuidedToursState;
}

describe('HelpDialog', () => {
  let fixture: ComponentFixture<HelpDialog>;
  let refSpy: { close: ReturnType<typeof vi.fn> };
  let load: ReturnType<typeof vi.fn>;

  const el = () => fixture.nativeElement as HTMLElement;
  const query = <T extends HTMLElement>(testId: string, inner = '') => {
    const found = el().querySelector<T>(`[data-testid="${testId}"] ${inner}`.trim());
    if (!found) throw new Error(`${testId} ${inner} not rendered`);
    return found;
  };
  const type = (text: string) => {
    const input = query<HTMLInputElement>('help-dialog__input--search');
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const testIds = (prefix: string) =>
    Array.from(el().querySelectorAll(`[data-testid^="${prefix}"]`)).map((e) =>
      e.getAttribute('data-testid'),
    );

  async function render(result: GuidedToursState | Promise<GuidedToursState>): Promise<void> {
    load = vi.fn().mockReturnValue(Promise.resolve(result));
    refSpy = { close: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [HelpDialog, TranslateModule.forRoot()],
      providers: [
        { provide: GuidedToursService, useValue: { load } },
        { provide: DynamicDialogRef, useValue: refSpy },
        {
          provide: OnboardingToursService,
          useValue: { available: () => Promise.resolve(onboarding.available) },
        },
        {
          provide: OnboardingCoordinator,
          useValue: { activeRoleTours: () => Promise.resolve(onboarding.roles) },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HelpDialog);
    fixture.detectChanges();
    await fixture.whenStable();
    // The first-steps lookup chains two promises of its own.
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  beforeEach(() => {
    // No onboarding tour by default: the catalogue tests count rows, and
    // welcome would otherwise always add one.
    onboarding = { available: new Set(), roles: new Set() };
  });

  afterEach(() => TestBed.resetTestingModule());

  describe('first steps (onboarding tours)', () => {
    beforeEach(() => {
      onboarding.available = new Set(ONBOARDING_TOUR_KEYS);
    });

    it('should list the welcome tour for a user without a community, catalogue apart', async () => {
      await render(state({ role: null }));
      expect(query('help-dialog__first-steps').textContent).toContain('Bienvenue sur OptimCE');
      expect(el().querySelector('[data-testid="help-dialog__no-community"]')).toBeTruthy();
    });

    it("should list welcome, then the active community's role tours, and never in the catalogue", async () => {
      onboarding.roles = new Set(['community_manager', 'community_member']);
      await render(state());
      const rows = Array.from(
        query('help-dialog__first-steps').querySelectorAll('[data-testid^="help-dialog__row--"]'),
      ).map((e) => e.getAttribute('data-testid'));
      expect(rows).toEqual([
        'help-dialog__row--onboarding-welcome',
        'help-dialog__row--onboarding-manager',
        'help-dialog__row--onboarding-member',
      ]);
      expect(query('help-dialog__tours').textContent).not.toContain('Vous êtes');
    });

    it('should start a replay like any other tour', async () => {
      onboarding.roles = new Set(['community_manager']);
      await render(state());
      query('help-dialog__btn--start--onboarding-manager', 'button').click();
      expect(refSpy.close).toHaveBeenCalledWith({ tourId: 'onboarding-manager' });
    });

    it('should not show the section when no onboarding tour applies or ships', async () => {
      onboarding.available = new Set(['community_admin']);
      onboarding.roles = new Set(['community_admin']); // onboarding-admin is not in MANIFEST
      await render(state());
      expect(el().querySelector('[data-testid="help-dialog__first-steps"]')).toBeNull();
    });
  });

  it('should link to the online guide in a new tab', async () => {
    await render(state());
    const link = el().querySelector<HTMLAnchorElement>('[data-testid="help-dialog__link--guide"]');
    expect(link?.getAttribute('href')).toBe(USER_GUIDE_URL);
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toContain('noopener');
  });

  it('should show placeholders until the tours are known', async () => {
    await render(new Promise<GuidedToursState>(() => undefined));
    expect(el().querySelector('[data-testid="help-dialog__loading"]')).toBeTruthy();
    expect(testIds('help-dialog__row--')).toEqual([]);
  });

  it('should list "on this page" first, then the areas, with a start button per tour', async () => {
    await render(state({ url: '/meters/541448820000000001' }));

    expect(testIds('help-dialog__section--')).toEqual([
      'help-dialog__section--on-this-page',
      'help-dialog__section--keys',
      'help-dialog__section--meters',
    ]);
    expect(testIds('help-dialog__row--')).toEqual([
      'help-dialog__row--meter-deactivate',
      'help-dialog__row--key-create-wizard',
      'help-dialog__row--key-create-gridform',
      'help-dialog__row--meter-update',
    ]);
    expect(
      el().querySelector('[data-testid="help-dialog__btn--start--key-create-wizard"]'),
    ).toBeTruthy();
    expect(el().textContent).not.toContain('Votre accueil');
  });

  it('should filter the tours by title as the user types', async () => {
    await render(state());
    type('supprimer');
    expect(testIds('help-dialog__row--')).toEqual(['help-dialog__row--key-create-gridform']);

    type('zzz');
    expect(el().querySelector('[data-testid="help-dialog__no-match"]')).toBeTruthy();
  });

  it('should close with the tour and the params read from the URL', async () => {
    await render(state({ url: '/meters/541448820000000001' }));
    query<HTMLButtonElement>('help-dialog__btn--start--meter-deactivate', 'button').click();

    expect(refSpy.close).toHaveBeenCalledWith({
      tourId: 'meter-deactivate',
      params: { meterEan: '541448820000000001' },
    });
  });

  it('should close with the tour alone when it has no params', async () => {
    await render(state());
    query<HTMLButtonElement>('help-dialog__btn--start--key-create-wizard', 'button').click();

    expect(refSpy.close).toHaveBeenCalledWith({ tourId: 'key-create-wizard' });
  });

  it('should ask for a community when none is active', async () => {
    await render(state({ role: null }));
    expect(el().querySelector('[data-testid="help-dialog__no-community"]')).toBeTruthy();
    expect(el().querySelector('[data-testid="help-dialog__input--search"]')).toBeNull();
  });

  it('should say when no tour fits the role', async () => {
    await render(
      state({ role: Role.MEMBER }, { defaultLocale: 'fr', tours: MANIFEST.tours.slice(0, 2) }),
    );
    expect(el().querySelector('[data-testid="help-dialog__empty"]')).toBeTruthy();
  });

  it('should say when the tours could not be loaded', async () => {
    await render(state({}, null));
    expect(el().querySelector('[data-testid="help-dialog__error"]')).toBeTruthy();
  });
});
