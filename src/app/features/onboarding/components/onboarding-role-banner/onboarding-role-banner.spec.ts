import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import {
  OnboardingCoordinator,
  OnboardingOffer,
} from '../../services/onboarding-coordinator.service';
import { OnboardingRoleBanner } from './onboarding-role-banner';

function roleOffer(steps: number | null = 8): OnboardingOffer {
  return {
    key: 'community_manager',
    kind: 'role',
    tour: { key: 'community_manager', tourId: 'onboarding-manager', steps, version: null },
    community: 'Soleil',
    path: '/dashboard',
  };
}

describe('OnboardingRoleBanner', () => {
  let coordinator: {
    offer: ReturnType<typeof signal<OnboardingOffer | null>>;
    accept: ReturnType<typeof vi.fn>;
    later: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    coordinator = {
      offer: signal<OnboardingOffer | null>(roleOffer()),
      accept: vi.fn().mockResolvedValue(undefined),
      later: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      imports: [OnboardingRoleBanner, TranslateModule.forRoot()],
      providers: [{ provide: OnboardingCoordinator, useValue: coordinator }],
    });
  });

  function render(): ComponentFixture<OnboardingRoleBanner> {
    const fixture = TestBed.createComponent(OnboardingRoleBanner);
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

  it('should sit in a polite live region that exists before the banner does', () => {
    coordinator.offer.set(null);
    const fixture = render();
    expect(el(fixture, 'onboarding-banner__live').getAttribute('aria-live')).toBe('polite');
    expect(q(fixture, 'onboarding-banner')).toBeNull();

    coordinator.offer.set(roleOffer());
    fixture.detectChanges();
    expect(el(fixture, 'onboarding-banner__live').contains(q(fixture, 'onboarding-banner'))).toBe(
      true,
    );
  });

  it('should offer the tour with keyboard-reachable actions', () => {
    const fixture = render();
    const banner = el(fixture, 'onboarding-banner');
    expect(banner.textContent).toContain('ONBOARDING.COMMUNITY_MANAGER.TITLE');
    const buttons = banner.querySelectorAll('button');
    expect(buttons).toHaveLength(2);

    button(fixture, 'onboarding-banner__btn--start').click();
    expect(coordinator.accept).toHaveBeenCalledTimes(1);
    button(fixture, 'onboarding-banner__btn--later').click();
    expect(coordinator.later).toHaveBeenCalledTimes(1);
  });

  it('should mention the step count only when it is known', () => {
    coordinator.offer.set(roleOffer(null));
    expect(el(render(), 'onboarding-banner').textContent).toContain(
      'ONBOARDING.COMMUNITY_MANAGER.TEXT_NO_COUNT',
    );
  });

  it('should disappear without an answer when the offer is withdrawn (the user left the page)', () => {
    const fixture = render();
    coordinator.offer.set(null);
    fixture.detectChanges();
    expect(q(fixture, 'onboarding-banner')).toBeNull();
    expect(coordinator.accept).not.toHaveBeenCalled();
    expect(coordinator.later).not.toHaveBeenCalled();
  });

  it('should render nothing for the welcome offer', () => {
    coordinator.offer.set({ ...roleOffer(), key: 'welcome', kind: 'welcome', community: null });
    expect(q(render(), 'onboarding-banner')).toBeNull();
  });
});
