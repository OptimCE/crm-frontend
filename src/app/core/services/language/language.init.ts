import {
  ENVIRONMENT_INITIALIZER,
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import { LanguageService } from './language.service';

export function provideLanguageInitForRoute(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        // runs when the route's environment injector is created
        const lang = inject(LanguageService);
        lang.init();
      },
    },
  ]);
}
