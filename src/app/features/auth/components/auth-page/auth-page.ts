import { Component, inject, input } from '@angular/core';
import { Button } from 'primeng/button';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageSelector } from '../../../../shared/components/language-selector/language-selector';
import Keycloak from 'keycloak-js';
import { LanguageService } from '../../../../core/services/language/language.service';
import { safeReturnUrl } from '../../../../core/guards/active-community.guard';
import { FeatureTour } from '../feature-tour/feature-tour';

@Component({
  selector: 'app-auth-page',
  imports: [Button, TranslatePipe, LanguageSelector, FeatureTour],
  standalone: true,
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.css',
})
export class AuthPage {
  private readonly keycloak = inject(Keycloak);
  private readonly languageService = inject(LanguageService);

  /**
   * Where `canActivateAuth` was sending the visitor before bouncing them here.
   * Bound from `?returnUrl=` by `withComponentInputBinding()` (app.config.ts).
   */
  readonly returnUrl = input<string | undefined>();

  /**
   * `locale` is forwarded by keycloak-js as the OIDC `ui_locales` parameter.
   *
   * Keycloak needs it: it renders the login theme server-side and bakes the
   * resolved messages into the page, so a language the server doesn't know
   * about can no longer be corrected in the browser. It also stores the choice
   * in the KEYCLOAK_LOCALE cookie, which keeps the rest of the flow
   * (registration, password reset) in the same language.
   *
   * `redirectUri` resumes the page the visitor asked for — registration keeps it
   * too — so the public website can link straight to a page inside the app.
   * `safeReturnUrl` keeps it a same-origin path, and Keycloak only accepts
   * `<origin>/*` for this client anyway.
   */
  login(): void {
    void this.keycloak.login({
      redirectUri: window.location.origin + (safeReturnUrl(this.returnUrl()) ?? '/'),
      locale: this.languageService.getCurrentLanguage() ?? undefined,
    });
  }
}
