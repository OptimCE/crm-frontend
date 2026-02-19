import { Component, inject } from '@angular/core';
import { Button } from 'primeng/button';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageSelector } from '../../../../shared/components/language-selector/language-selector';
import { Card } from 'primeng/card';
import Keycloak from 'keycloak-js';

@Component({
  selector: 'app-auth-page',
  imports: [Button, TranslatePipe, LanguageSelector, Card],
  standalone: true,
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.css',
})
export class AuthPage {
  private readonly keycloak = inject(Keycloak);

  login() {
    this.keycloak.login({ redirectUri: window.location.origin + '/' });
  }
}
