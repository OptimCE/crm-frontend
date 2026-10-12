import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { vi } from 'vitest';

import de from '../../../../../assets/i18n/de.json';
import en from '../../../../../assets/i18n/en.json';
import fr from '../../../../../assets/i18n/fr.json';
import nl from '../../../../../assets/i18n/nl.json';
import { FeatureTour, TOUR_SLIDES } from './feature-tour';

const byTestId = (root: HTMLElement, id: string): HTMLElement =>
  root.querySelector(`[data-testid="${id}"]`) as HTMLElement;

describe('FeatureTour', () => {
  let fixture: ComponentFixture<FeatureTour>;
  let component: FeatureTour;
  let host: HTMLElement;

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [FeatureTour, TranslateModule.forRoot()],
    }).compileComponents();

    fixture = TestBed.createComponent(FeatureTour);
    component = fixture.componentInstance;
    host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const activeSlide = (): number =>
    [...host.querySelectorAll('.tour__slide')].findIndex((el) =>
      el.classList.contains('is-active'),
    );
  const tab = (i: number): HTMLButtonElement =>
    byTestId(host, `auth-page__tour-tab--${i}`) as HTMLButtonElement;

  describe('with motion allowed', () => {
    beforeEach(async () => {
      await create();
    });

    it('shows the five features in tour order, starting with the first', () => {
      expect(TOUR_SLIDES.map((s) => s.kind)).toEqual([
        'community',
        'sharing',
        'keys',
        'billing',
        'memberSpace',
      ]);
      expect(host.querySelectorAll('.tour__slide')).toHaveLength(5);
      expect(activeSlide()).toBe(0);
      expect(tab(0).getAttribute('aria-selected')).toBe('true');
      expect(tab(1).getAttribute('aria-selected')).toBe('false');
    });

    it('draws every illustration as decoration, so the title is read once', () => {
      TOUR_SLIDES.forEach((_, i) => {
        const art = byTestId(host, `auth-page__slide-image--${i}`);
        expect(art.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
      });
      expect(host.querySelector('img')).toBeNull();
    });

    it('plays only the active slide build', () => {
      expect(byTestId(host, 'auth-page__slide-image--0').classList).toContain('is-playing');
      expect(byTestId(host, 'auth-page__slide-image--1').classList).not.toContain('is-playing');
    });

    it('draws the 96 quarter-hours of a day on the sharing slide', () => {
      expect(
        byTestId(host, 'auth-page__slide-image--1').querySelectorAll('rect.a-cell'),
      ).toHaveLength(96);
    });

    it('opens the slide whose tab is clicked', async () => {
      tab(3).click();
      await render();

      expect(activeSlide()).toBe(3);
      expect(tab(3).getAttribute('aria-selected')).toBe('true');
      expect(tab(3).tabIndex).toBe(0);
      expect(tab(0).tabIndex).toBe(-1);
      expect(byTestId(host, 'auth-page__slide-image--3').classList).toContain('is-playing');
    });

    it('moves between tabs with the arrow keys, Home and End, wrapping around', async () => {
      const press = async (key: string): Promise<void> => {
        tab(component.active()).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        await render();
      };

      await press('ArrowLeft');
      expect(component.active()).toBe(4);
      expect(document.activeElement).toBe(tab(4));

      await press('ArrowRight');
      expect(component.active()).toBe(0);

      await press('End');
      expect(component.active()).toBe(4);

      await press('Home');
      expect(component.active()).toBe(0);
      expect(document.activeElement).toBe(tab(0));
    });

    it('advances when the active progress bar finishes, and loops after the last slide', async () => {
      const finishBar = async (): Promise<void> => {
        host
          .querySelector('.tour__fill.is-running')
          ?.dispatchEvent(new Event('animationend', { bubbles: true }));
        await render();
      };

      await finishBar();
      expect(activeSlide()).toBe(1);

      component.select(4);
      await render();
      await finishBar();
      expect(activeSlide()).toBe(0);
    });

    it('ignores an animationend that bubbled up from inside the bar', () => {
      const fill = host.querySelector('.tour__fill.is-running') as HTMLElement;
      component.onProgressEnd({
        target: document.createElement('span'),
        currentTarget: fill,
      } as unknown as AnimationEvent);
      expect(component.active()).toBe(0);
    });

    it('marks the slides already seen', async () => {
      component.select(2);
      await render();

      expect(tab(0).classList).toContain('is-done');
      expect(tab(1).classList).toContain('is-done');
      expect(tab(2).classList).not.toContain('is-done');
    });

    it('pauses and resumes with the toggle, announcing slides only while paused', async () => {
      const toggle = byTestId(host, 'auth-page__tour-toggle');
      const live = host.querySelector('.tour__slides') as HTMLElement;
      expect(toggle.getAttribute('aria-label')).toBe('LOGIN.TOUR.PAUSE');
      expect(live.getAttribute('aria-live')).toBe('off');

      toggle.click();
      await render();
      expect(host.querySelector('.tour')?.classList).toContain('is-paused');
      expect(toggle.getAttribute('aria-label')).toBe('LOGIN.TOUR.PLAY');
      expect(live.getAttribute('aria-live')).toBe('polite');

      toggle.click();
      await render();
      expect(host.querySelector('.tour')?.classList).not.toContain('is-paused');
      expect(live.getAttribute('aria-live')).toBe('off');
    });
  });

  describe('with reduced motion', () => {
    let original: typeof window.matchMedia;

    beforeEach(async () => {
      original = window.matchMedia;
      window.matchMedia = vi
        .fn()
        .mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
      await create();
    });

    afterEach(() => {
      window.matchMedia = original;
    });

    it('does not rotate, so it offers no pause button and announces slide changes', () => {
      expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
      expect(byTestId(host, 'auth-page__tour-toggle')).toBeNull();
      expect(host.querySelector('.tour__slides')?.getAttribute('aria-live')).toBe('polite');
    });
  });

  it('has every text it shows in all four languages', () => {
    const keys = [
      'LOGIN.TOUR.LABEL',
      'LOGIN.TOUR.PAUSE',
      'LOGIN.TOUR.PLAY',
      ...TOUR_SLIDES.flatMap((s) => [s.titleKey, s.descKey]),
    ];
    const lookup = (dict: object, key: string): unknown =>
      key
        .split('.')
        .reduce<unknown>(
          (node, part) => (node as Record<string, unknown> | undefined)?.[part],
          dict,
        );

    for (const [lang, dict] of Object.entries({ fr, en, nl, de })) {
      for (const key of keys) {
        expect(typeof lookup(dict, key), `${lang}: ${key}`).toBe('string');
      }
    }
  });
});
