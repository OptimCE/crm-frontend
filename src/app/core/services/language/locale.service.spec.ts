import { formatDate, formatNumber } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';

import { LocaleService, toAppLocale } from './locale.service';

/** French groups thousands with a narrow no-break space (U+202F). */
const NNBSP = String.fromCharCode(0x202f);

describe('toAppLocale', () => {
  it('keeps every language the app offers', () => {
    expect(['fr', 'en', 'nl', 'de'].map(toAppLocale)).toEqual(['fr', 'en', 'nl', 'de']);
  });

  it('drops the region: a Belgian Dutch reader is a Dutch reader', () => {
    expect(toAppLocale('nl-BE')).toBe('nl');
    expect(toAppLocale('en_GB')).toBe('en');
    expect(toAppLocale('DE')).toBe('de');
  });

  it('falls back to French for a language the app has no data for, or none', () => {
    // Anything else would reach Angular's formatNumber, which THROWS on a
    // locale it has no data for, taking the rest of the template with it.
    expect(toAppLocale('es')).toBe('fr');
    expect(toAppLocale('')).toBe('fr');
    expect(toAppLocale(undefined)).toBe('fr');
    expect(toAppLocale(null)).toBe('fr');
  });
});

describe('LocaleService', () => {
  function build(lang?: string): { service: LocaleService; translate: TranslateService } {
    TestBed.configureTestingModule({
      providers: [provideTranslateService(lang ? { lang } : {})],
    });
    return { service: TestBed.inject(LocaleService), translate: TestBed.inject(TranslateService) };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('is French before any language has been chosen, like the app itself', () => {
    expect(build().service.locale()).toBe('fr');
  });

  it('starts in the language already in use', () => {
    expect(build('nl').service.locale()).toBe('nl');
  });

  it('follows a switch of language, without a reload', () => {
    // The point of a signal over LOCALE_ID, which is read once at bootstrap.
    const { service, translate } = build('fr');

    translate.use('de');

    expect(service.locale()).toBe('de');
  });

  it('brings the locale data of every language, so no pipe throws NG0701', () => {
    build();
    const day = new Date(2026, 8, 29);

    expect(formatNumber(1234.5, 'fr', '1.1-1')).toBe(`1${NNBSP}234,5`);
    expect(formatNumber(1234.5, 'nl', '1.1-1')).toBe('1.234,5');
    expect(formatNumber(1234.5, 'de', '1.1-1')).toBe('1.234,5');
    expect(formatNumber(1234.5, 'en', '1.1-1')).toBe('1,234.5');
    expect(formatDate(day, 'mediumDate', 'fr')).toBe('29 sept. 2026');
    expect(formatDate(day, 'mediumDate', 'nl')).toBe('29 sep 2026');
    expect(formatDate(day, 'mediumDate', 'de')).toBe('29.09.2026');
  });
});
