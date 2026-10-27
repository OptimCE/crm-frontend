import { Component, computed, inject } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';

import { LocaleService } from '../../../../core/services/language/locale.service';
import { offerTexts } from '../../onboarding-offer-texts';
import { OnboardingCoordinator } from '../../services/onboarding-coordinator.service';

/**
 * The role tours' offer: a banner at the top of the page, in the page's flow,
 * so it covers neither the navigation nor the page's own actions. The user has
 * just acted (created, joined), so nothing blocks them.
 *
 * Always mounted: the polite live region must exist before its content does,
 * or screen readers do not announce the banner when it appears. It stays until
 * answered; leaving the page withdraws it with nothing recorded (the
 * coordinator does that on navigation).
 */
@Component({
  selector: 'app-onboarding-role-banner',
  imports: [Button, TranslatePipe],
  templateUrl: './onboarding-role-banner.html',
})
export class OnboardingRoleBanner {
  protected readonly coordinator = inject(OnboardingCoordinator);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LocaleService);

  protected readonly texts = computed(() => {
    const offer = this.coordinator.offer();
    this.locale.locale(); // re-translate on a language switch
    if (offer?.kind !== 'role') return null;
    return offerTexts(
      offer.key,
      offer.tour.steps,
      offer.community,
      (key, params) => this.translate.instant(key, params) as string,
    );
  });

  protected onAccept(): void {
    void this.coordinator.accept();
  }

  protected onLater(): void {
    void this.coordinator.later();
  }
}
