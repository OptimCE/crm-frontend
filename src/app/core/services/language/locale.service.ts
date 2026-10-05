import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import localeEn from '@angular/common/locales/en';
import localeFr from '@angular/common/locales/fr';
import localeNl from '@angular/common/locales/nl';
import { inject, Injectable, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';

import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, SupportedLanguage } from './language.service';

/**
 * Angular's CLDR data for each language the app offers.
 *
 * A Record over SupportedLanguage, so adding a language without its data fails
 * to compile here - instead of every `localeNumber` throwing NG0701 ("Missing
 * locale data") on the first page a reader of that language opens.
 */
const LOCALE_DATA: Record<SupportedLanguage, unknown> = {
  fr: localeFr,
  en: localeEn,
  nl: localeNl,
  de: localeDe,
};

/**
 * The supported language a tag stands for: `nl-BE` is `nl`, and a language the
 * app has no data for is the app's default rather than an error.
 */
export function toAppLocale(lang: string | null | undefined): SupportedLanguage {
  const base = (lang ?? '').toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LANGUAGES.find((supported) => supported === base) ?? DEFAULT_LANGUAGE;
}

/**
 * The locale every figure and date is written in: the language the reader
 * chose in the app - not the browser's, and not Angular's LOCALE_ID.
 *
 * LOCALE_ID is resolved once, at bootstrap, while the language here changes at
 * runtime (`translate.use()`, no reload). So this is a signal: read in a
 * template, a pipe or a `computed`, it rewrites the figure when the reader
 * switches. It follows `onLangChange`, which fires once the new bundle has
 * loaded, so the numbers change language together with the words around them.
 */
@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly translate = inject(TranslateService);

  readonly locale: Signal<SupportedLanguage> = toSignal(
    this.translate.onLangChange.pipe(map((event) => toAppLocale(event.lang))),
    { initialValue: toAppLocale(this.translate.getCurrentLang()) },
  );

  constructor() {
    // Here rather than at bootstrap: everything that formats goes through this
    // service, so the data is in place before the first figure - specs included.
    for (const [id, data] of Object.entries(LOCALE_DATA)) {
      registerLocaleData(data, id);
    }
  }
}
