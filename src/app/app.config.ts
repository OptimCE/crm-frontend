import {
  APP_INITIALIZER,
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { provideTranslateService } from '@ngx-translate/core';
import { provideKeycloakAngular } from './core/guards/keycloack.config';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { includeBearerTokenInterceptor } from 'keycloak-angular';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { LanguageService } from './core/services/language/language.service';
import { communityContextInterceptor } from './core/interceptors/community.context.inteceptor';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';

// Register all Community features
ModuleRegistry.registerModules([AllCommunityModule]);
export function initializeLanguage(_languageService: LanguageService) {
  return (): Promise<void> => {
    // If your logic is in the constructor, just returning a resolved promise is enough.
    // If you have an init() method, call it here: return languageService.init();
    return Promise.resolve();
  };
}
export const appConfig: ApplicationConfig = {
  providers: [
    provideKeycloakAngular(),
    provideHttpClient(
      withInterceptors([includeBearerTokenInterceptor, communityContextInterceptor]),
    ),
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'enabled',
        anchorScrolling: 'enabled',
      }),
      withComponentInputBinding(),
    ),
    provideTranslateService({
      loader: provideTranslateHttpLoader({
        prefix: './assets/i18n/',
        suffix: '.json',
      }),
    }),
    provideZoneChangeDetection({ eventCoalescing: true }),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          darkMode: false,
          darkModeSelector: 'none',
        },
      },
    }),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeLanguage,
      deps: [LanguageService],
      multi: true,
    },
    // {
    //   provide: APP_INITIALIZER,
    //   useFactory: initUserContextAfterKeycloak,
    //   deps: [UserContextService, Keycloak],
    //   multi: true,
    // },
    // {
    //   provide: APP_INITIALIZER,
    //   useFactory: registerKeycloakHooks,
    //   deps: [UserContextService, Keycloak],
    //   multi: true,
    // }
  ],
};
