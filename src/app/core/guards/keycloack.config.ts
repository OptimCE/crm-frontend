import {
  provideKeycloak,
  createInterceptorCondition,
  withAutoRefreshToken,
  AutoRefreshTokenService,
  UserActivityService,
  INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
  IncludeBearerTokenCondition,
} from 'keycloak-angular';
import { environments } from '../../../environments/environments';
import {EnvironmentProviders} from '@angular/core';

const localhostCondition = createInterceptorCondition<IncludeBearerTokenCondition>({
  urlPattern: environments.keycloak.urlPattern,
});

export const provideKeycloakAngular = (): EnvironmentProviders =>
  provideKeycloak({
    config: {
      realm: environments.keycloak.realm,
      url: environments.keycloak.url,
      clientId: environments.keycloak.clientId,
    },
    initOptions: {
      onLoad: 'check-sso',
      silentCheckSsoRedirectUri: window.location.origin + '/assets/silent-check-sso.html',
      redirectUri: window.location.origin + '/',
    },
    features: [
      withAutoRefreshToken({
        onInactivityTimeout: 'none', // ou enlève cette feature si pas utile
        sessionTimeout: 30 * 60 * 1000,
      })
    ],
    providers: [
      AutoRefreshTokenService,
      UserActivityService,
      {
        provide: INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
        useValue: [localhostCondition],
      },
    ],
  });
