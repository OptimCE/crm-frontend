import {
  afterNextRender,
  Component,
  computed,
  DOCUMENT,
  ElementRef,
  inject,
  OnDestroy,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { FocusTrap } from 'primeng/focustrap';

import { LocaleService } from '../../../../core/services/language/locale.service';
import { offerTexts } from '../../onboarding-offer-texts';
import { OnboardingCoordinator } from '../../services/onboarding-coordinator.service';

let nextId = 0;

/**
 * The first-login offer: a centred dialog over the dimmed app.
 *
 * Built by hand rather than with p-dialog because of what happens on "Show
 * me": the card fades out while the dimmed backdrop stays, until the tour
 * shows its first step (`OnboardingCoordinator.launching`). p-dialog cannot
 * keep its mask without its panel. The backdrop uses the overlay's own scrim
 * colour (`--app-tour-scrim`), so the hand-over is seamless.
 *
 * The close button and Escape mean "Later". A click on the backdrop does
 * nothing, so a stray click cannot dismiss it. Focus is trapped inside, and
 * given back to where it was when the dialog closes on "Later".
 */
@Component({
  selector: 'app-onboarding-welcome-dialog',
  imports: [Button, FocusTrap, TranslatePipe],
  templateUrl: './onboarding-welcome-dialog.html',
  styleUrl: './onboarding-welcome-dialog.css',
  host: { '(document:keydown.escape)': 'onEscape($event)' },
})
export class OnboardingWelcomeDialog implements OnDestroy {
  protected readonly coordinator = inject(OnboardingCoordinator);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LocaleService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);

  protected readonly titleId = `onboarding-welcome-title-${++nextId}`;
  protected readonly textId = `onboarding-welcome-text-${nextId}`;

  /** `prefers-reduced-motion`: no fade, no slide. */
  protected readonly reducedMotion =
    this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  protected readonly offer = computed(() => {
    const offer = this.coordinator.offer();
    return offer?.kind === 'welcome' ? offer : null;
  });

  protected readonly texts = computed(() => {
    const offer = this.offer();
    this.locale.locale(); // re-translate on a language switch
    return offer
      ? offerTexts(
          offer.key,
          offer.tour.steps,
          null,
          (key, params) => this.translate.instant(key, params) as string,
        )
      : null;
  });

  /** Where the focus was before the dialog took it. */
  private readonly previousFocus = this.document.activeElement as HTMLElement | null;
  private accepted = false;

  constructor() {
    afterNextRender(() => {
      this.host.nativeElement
        .querySelector<HTMLElement>('[data-testid="onboarding-welcome__btn--start"] button')
        ?.focus();
    });
  }

  protected onAccept(): void {
    this.accepted = true;
    void this.coordinator.accept();
  }

  protected onLater(): void {
    void this.coordinator.later();
  }

  protected onEscape(event: Event): void {
    if (!this.offer() || this.coordinator.launching()) return;
    event.preventDefault();
    this.onLater();
  }

  ngOnDestroy(): void {
    // On "Show me" the tour takes the focus; giving it back would pull it away.
    if (!this.accepted) this.previousFocus?.focus?.();
  }
}
