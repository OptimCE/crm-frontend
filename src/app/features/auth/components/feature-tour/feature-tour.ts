import { Component, computed, ElementRef, signal, viewChildren } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { TourIllustration, TourIllustrationKind } from './tour-illustration/tour-illustration';

export interface TourSlide {
  kind: TourIllustrationKind;
  titleKey: string;
  descKey: string;
}

export const TOUR_SLIDES: readonly TourSlide[] = [
  {
    kind: 'community',
    titleKey: 'LOGIN.SLIDES.COMMUNITY_TITLE',
    descKey: 'LOGIN.SLIDES.COMMUNITY_DESC',
  },
  { kind: 'sharing', titleKey: 'LOGIN.SLIDES.SHARING_TITLE', descKey: 'LOGIN.SLIDES.SHARING_DESC' },
  { kind: 'keys', titleKey: 'LOGIN.SLIDES.KEYS_TITLE', descKey: 'LOGIN.SLIDES.KEYS_DESC' },
  { kind: 'billing', titleKey: 'LOGIN.SLIDES.BILLING_TITLE', descKey: 'LOGIN.SLIDES.BILLING_DESC' },
  {
    kind: 'memberSpace',
    titleKey: 'LOGIN.SLIDES.MEMBER_SPACE_TITLE',
    descKey: 'LOGIN.SLIDES.MEMBER_SPACE_DESC',
  },
];

/**
 * The login page's tour of the product: one slide per feature, rotating on its own.
 *
 * There is no timer. The active tab's progress bar is a CSS animation, and its
 * `animationend` moves to the next slide, so the bar and the rotation can't drift
 * apart. Pausing is CSS too: the pause button, a hovering pointer and keyboard
 * focus inside the tour all freeze that animation. Under reduced motion the bar
 * never animates, so the tour only moves when the visitor picks a slide.
 */
@Component({
  selector: 'app-feature-tour',
  standalone: true,
  imports: [TranslatePipe, TourIllustration],
  templateUrl: './feature-tour.html',
  styleUrl: './feature-tour.css',
})
export class FeatureTour {
  readonly slides = TOUR_SLIDES;
  readonly active = signal(0);
  readonly paused = signal(false);
  readonly reducedMotion = prefersReducedMotion();

  /** Rotating slides stay quiet for screen readers; once still, a change is announced. */
  readonly rotating = computed(() => !this.paused() && !this.reducedMotion);

  private readonly tabs = viewChildren<ElementRef<HTMLButtonElement>>('tab');

  select(index: number): void {
    const count = this.slides.length;
    this.active.set((index + count) % count);
  }

  togglePause(): void {
    this.paused.update((paused) => !paused);
  }

  onProgressEnd(event: AnimationEvent): void {
    // Only the bar's own animation counts, not one bubbling up from inside it.
    if (event.target !== event.currentTarget) return;
    this.select(this.active() + 1);
  }

  /** Arrow keys, Home and End move between tabs (WAI-ARIA tabs pattern). */
  onTabKeydown(event: KeyboardEvent): void {
    const last = this.slides.length - 1;
    const targets: Record<string, number> = {
      ArrowRight: this.active() + 1,
      ArrowLeft: this.active() - 1,
      Home: 0,
      End: last,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    this.select(target);
    this.tabs()[this.active()]?.nativeElement.focus();
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
