import { Component, inject, input } from '@angular/core';
import { Button } from 'primeng/button';
import { Carousel } from 'primeng/carousel';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageSelector } from '../../../../shared/components/language-selector/language-selector';
import Keycloak from 'keycloak-js';
import { LanguageService } from '../../../../core/services/language/language.service';
import { safeReturnUrl } from '../../../../core/guards/active-community.guard';

interface Slide {
  icon: string;
  titleKey: string;
  descKey: string;
  images: string;
  index: number;
}

@Component({
  selector: 'app-auth-page',
  imports: [Button, Carousel, TranslatePipe, LanguageSelector],
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

  slides: Slide[] = [
    {
      icon: 'pi-users',
      titleKey: 'LOGIN.SLIDES.MEMBERS_TITLE',
      descKey: 'LOGIN.SLIDES.MEMBERS_DESC',
      images: 'assets/images/sliders/members',
      index: 0,
    },
    {
      icon: 'pi-bolt',
      titleKey: 'LOGIN.SLIDES.METERS_TITLE',
      descKey: 'LOGIN.SLIDES.METERS_DESC',
      images: 'assets/images/sliders/chart',
      index: 1,
    },
    {
      icon: 'pi-share-alt',
      titleKey: 'LOGIN.SLIDES.SHARING_TITLE',
      descKey: 'LOGIN.SLIDES.SHARING_DESC',
      images: 'assets/images/sliders/sharing',
      index: 2,
    },
    {
      icon: 'pi-key',
      titleKey: 'LOGIN.SLIDES.KEYS_TITLE',
      descKey: 'LOGIN.SLIDES.KEYS_DESC',
      images: 'assets/images/sliders/sun',
      index: 3,
    },
  ];

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
