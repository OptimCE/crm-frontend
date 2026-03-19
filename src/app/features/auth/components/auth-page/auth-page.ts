import { Component, inject } from '@angular/core';
import { Button } from 'primeng/button';
import { Carousel } from 'primeng/carousel';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageSelector } from '../../../../shared/components/language-selector/language-selector';
import Keycloak from 'keycloak-js';

interface Slide {
  icon: string;
  titleKey: string;
  descKey: string;
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

  slides: Slide[] = [
    {
      icon: 'pi-users',
      titleKey: 'LOGIN.SLIDES.MEMBERS_TITLE',
      descKey: 'LOGIN.SLIDES.MEMBERS_DESC',
    },
    {
      icon: 'pi-bolt',
      titleKey: 'LOGIN.SLIDES.METERS_TITLE',
      descKey: 'LOGIN.SLIDES.METERS_DESC',
    },
    {
      icon: 'pi-share-alt',
      titleKey: 'LOGIN.SLIDES.SHARING_TITLE',
      descKey: 'LOGIN.SLIDES.SHARING_DESC',
    },
    {
      icon: 'pi-key',
      titleKey: 'LOGIN.SLIDES.KEYS_TITLE',
      descKey: 'LOGIN.SLIDES.KEYS_DESC',
    },
  ];

  login(): void {
    void this.keycloak.login({ redirectUri: window.location.origin + '/' });
  }
}
