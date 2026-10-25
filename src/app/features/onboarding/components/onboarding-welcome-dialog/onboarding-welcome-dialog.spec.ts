import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import {
  OnboardingCoordinator,
  OnboardingOffer,
} from '../../services/onboarding-coordinator.service';
import { OnboardingWelcomeDialog } from './onboarding-welcome-dialog';

function welcomeOffer(steps: number | null = 11): OnboardingOffer {
  return {
    key: 'welcome',
    kind: 'welcome',
    tour: { key: 'welcome', tourId: 'onboarding-welcome', steps, version: null },
    community: null,
    path: '/home',
  };
}

describe('OnboardingWelcomeDialog', () => {
  let coordinator: {
    offer: ReturnType<typeof signal<OnboardingOffer | null>>;
    launching: ReturnType<typeof signal<boolean>>;
    accept: ReturnType<typeof vi.fn>;
    later: ReturnType<typeof vi.fn>;
  };
  let reducedMotion: boolean;

  beforeEach(() => {
    reducedMotion = false;
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion') && reducedMotion,
    }));
    coordinator = {
      offer: signal<OnboardingOffer | null>(welcomeOffer()),
      launching: signal(false),
      accept: vi.fn().mockResolvedValue(undefined),
      later: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      imports: [OnboardingWelcomeDialog, TranslateModule.forRoot()],
      providers: [{ provide: OnboardingCoordinator, useValue: coordinator }],
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  function render(): ComponentFixture<OnboardingWelcomeDialog> {
    const fixture = TestBed.createComponent(OnboardingWelcomeDialog);
    fixture.detectChanges();
    return fixture;
  }

  const q = (fixture: ComponentFixture<unknown>, testId: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-testid="${testId}"]`);

  /** Like q(), for an element the test expects to be there. */
  function el(fixture: ComponentFixture<unknown>, testId: string): HTMLElement {
    const found = q(fixture, testId);
    if (!found) throw new Error(`no [data-testid="${testId}"]`);
    return found;
  }

  function button(fixture: ComponentFixture<unknown>, testId: string): HTMLButtonElement {
    const found = el(fixture, testId).querySelector('button');
    if (!found) throw new Error(`no button in [data-testid="${testId}"]`);
    return found;
  }

  const text = (fixture: ComponentFixture<unknown>) =>
    (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('should be a modal dialog named by its title', () => {
    const fixture = render();
    const dialog = el(fixture, 'onboarding-welcome__dialog');
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const title = dialog.querySelector(`#${dialog.getAttribute('aria-labelledby')}`);
    expect(title?.tagName).toBe('H2');
    expect(title?.textContent).toContain('ONBOARDING.WELCOME.TITLE');
  });

  it('should treat the close button as "Later"', () => {
    const fixture = render();
    el(fixture, 'onboarding-welcome__btn--close').click();
    expect(coordinator.later).toHaveBeenCalledTimes(1);
    expect(coordinator.accept).not.toHaveBeenCalled();
  });

  it('should treat Escape as "Later"', () => {
    render();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(coordinator.later).toHaveBeenCalledTimes(1);
  });

  it('should ignore Escape while the tour is starting', () => {
    coordinator.launching.set(true);
    render();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(coordinator.later).not.toHaveBeenCalled();
  });

  it('should do nothing on a click on the backdrop', () => {
    const fixture = render();
    el(fixture, 'onboarding-welcome__mask').click();
    expect(coordinator.later).not.toHaveBeenCalled();
    expect(coordinator.accept).not.toHaveBeenCalled();
    expect(q(fixture, 'onboarding-welcome__dialog')).not.toBeNull();
  });

  it('should start the tour from the main action', () => {
    const fixture = render();
    button(fixture, 'onboarding-welcome__btn--start').click();
    expect(coordinator.accept).toHaveBeenCalledTimes(1);
  });

  it('should mention the step count only when it is known', () => {
    const withCount = render();
    expect(text(withCount)).toContain('ONBOARDING.WELCOME.TEXT');
    expect(text(withCount)).not.toContain('TEXT_NO_COUNT');

    coordinator.offer.set(welcomeOffer(null));
    withCount.detectChanges();
    expect(text(withCount)).toContain('ONBOARDING.WELCOME.TEXT_NO_COUNT');
  });

  it('should fade the card out but keep the backdrop while the tour starts', () => {
    const fixture = render();
    coordinator.launching.set(true);
    fixture.detectChanges();
    expect(el(fixture, 'onboarding-welcome__dialog').classList).toContain(
      'onboarding-welcome__dialog--leaving',
    );
    expect(q(fixture, 'onboarding-welcome__mask')).not.toBeNull();
  });

  it('should animate by default and not with prefers-reduced-motion', () => {
    expect(el(render(), 'onboarding-welcome__mask').classList).not.toContain(
      'onboarding-welcome--reduced-motion',
    );
    reducedMotion = true;
    expect(el(render(), 'onboarding-welcome__mask').classList).toContain(
      'onboarding-welcome--reduced-motion',
    );
  });

  it('should give the focus back where it was when closed with "Later"', () => {
    const before = document.createElement('button');
    document.body.appendChild(before);
    before.focus();
    const fixture = render();
    fixture.destroy();
    expect(document.activeElement).toBe(before);
    before.remove();
  });

  it('should leave the focus to the tour after "Show me"', () => {
    const before = document.createElement('button');
    document.body.appendChild(before);
    before.focus();
    const fixture = render();
    button(fixture, 'onboarding-welcome__btn--start').click();
    (document.activeElement as HTMLElement | null)?.blur();
    fixture.destroy();
    expect(document.activeElement).not.toBe(before);
    before.remove();
  });

  it('should render nothing for a role offer', () => {
    coordinator.offer.set({ ...welcomeOffer(), key: 'community_admin', kind: 'role' });
    expect(q(render(), 'onboarding-welcome__dialog')).toBeNull();
  });
});
