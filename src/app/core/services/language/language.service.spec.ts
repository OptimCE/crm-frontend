import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { PrimeNG } from 'primeng/config';
import { Observable, Subject, of } from 'rxjs';
import { vi } from 'vitest';

import de from '../../../../assets/i18n/de.json';
import en from '../../../../assets/i18n/en.json';
import fr from '../../../../assets/i18n/fr.json';
import nl from '../../../../assets/i18n/nl.json';
import { LanguageService } from './language.service';

/**
 * PrimeNG keeps a translation table of its own, separate from ngx-translate.
 * Nothing in the app reads it directly, so the only way it stays in the user's
 * language is LanguageService pushing it across on every change — which is what
 * these tests pin down.
 */
describe('LanguageService', () => {
  let langChange: Subject<unknown>;
  let translateSpy: {
    onLangChange: Observable<unknown>;
    setFallbackLang: ReturnType<typeof vi.fn>;
    use: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  };
  let primengSpy: { setTranslation: ReturnType<typeof vi.fn> };

  function build(bundle: unknown): LanguageService {
    langChange = new Subject<unknown>();
    translateSpy = {
      onLangChange: langChange.asObservable(),
      setFallbackLang: vi.fn(),
      use: vi.fn(),
      get: vi.fn().mockReturnValue(of(bundle)),
    };
    primengSpy = { setTranslation: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        LanguageService,
        { provide: TranslateService, useValue: translateSpy },
        { provide: PrimeNG, useValue: primengSpy },
      ],
    });
    return TestBed.inject(LanguageService);
  }

  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('pushes the PRIMENG bundle into PrimeNG when the language changes', () => {
    const bundle = { accept: 'Oui', reject: 'Non' };
    build(bundle);

    langChange.next({ lang: 'fr' });

    expect(translateSpy.get).toHaveBeenCalledWith('PRIMENG');
    expect(primengSpy.setTranslation).toHaveBeenCalledWith(bundle);
  });

  it('ignores a MISSING bundle rather than corrupting the table', () => {
    // ngx-translate echoes the key back when it cannot resolve it, and
    // setTranslation spreads whatever it is given — so a bare string would end
    // up as {0:'P',1:'R',…} inside PrimeNG's translations.
    build('PRIMENG');

    langChange.next({ lang: 'fr' });

    expect(primengSpy.setTranslation).not.toHaveBeenCalled();
  });

  it('ignores an array too, since spreading one is just as wrong', () => {
    build(['nope']);

    langChange.next({ lang: 'fr' });

    expect(primengSpy.setTranslation).not.toHaveBeenCalled();
  });

  it('subscribes before the first use(), so the initial load is covered', () => {
    // The constructor calls init() -> use(). If the subscription were set up
    // after that, the very first onLangChange would be missed and PrimeNG would
    // stay English until the user switched language by hand.
    const service = build({ accept: 'Oui' });

    expect(service).toBeTruthy();
    expect(translateSpy.use).toHaveBeenCalled();

    langChange.next({ lang: 'fr' });
    expect(primengSpy.setTranslation).toHaveBeenCalledTimes(1);
  });
});

describe('PRIMENG locale bundles', () => {
  const locales = { en, fr, nl, de } as Record<string, { PRIMENG: Record<string, unknown> }>;

  it('define the same keys in every language', () => {
    const reference = Object.keys(locales['en'].PRIMENG).sort();

    for (const [name, bundle] of Object.entries(locales)) {
      expect(Object.keys(bundle.PRIMENG).sort(), name).toEqual(reference);
    }
  });

  it('keep the day and month arrays the right length', () => {
    // A short monthNames array renders a blank month header rather than
    // throwing, so the mistake would ship quietly.
    const lengths: Record<string, number> = {
      dayNames: 7,
      dayNamesShort: 7,
      dayNamesMin: 7,
      monthNames: 12,
      monthNamesShort: 12,
    };

    for (const [name, bundle] of Object.entries(locales)) {
      for (const [key, expected] of Object.entries(lengths)) {
        expect(bundle.PRIMENG[key], `${name}.${key}`).toHaveLength(expected);
      }
    }
  });

  it('use Belgian date conventions in every language, English included', () => {
    for (const [name, bundle] of Object.entries(locales)) {
      expect(bundle.PRIMENG['dateFormat'], name).toBe('dd/mm/yy');
      // 1 = Monday. PrimeNG defaults to 0 (Sunday), which is wrong here and
      // was already being overridden by hand in ten templates.
      expect(bundle.PRIMENG['firstDayOfWeek'], name).toBe(1);
    }
  });

  it('mirror PrimeNG’s own translation table, key for key', () => {
    // The load-bearing test. setTranslation merges SHALLOWLY, so a partial
    // `aria` would replace PrimeNG's default object rather than merge into it,
    // dropping every key not listed. Completeness is what makes that safe.
    //
    // Reading the defaults off a real PrimeNG instance rather than hardcoding a
    // list means a PrimeNG upgrade that adds a key turns into a red test here,
    // instead of one more string quietly staying English.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [PrimeNG] });
    const defaults = TestBed.inject(PrimeNG).translation as Record<string, unknown>;
    const defaultAria = defaults['aria'] as Record<string, unknown>;

    for (const [name, bundle] of Object.entries(locales)) {
      expect(Object.keys(bundle.PRIMENG).sort(), name).toEqual(Object.keys(defaults).sort());
      expect(
        Object.keys(bundle.PRIMENG['aria'] as Record<string, unknown>).sort(),
        `${name}.aria`,
      ).toEqual(Object.keys(defaultAria).sort());
    }
  });

  it('leave no string blank, at either level', () => {
    for (const [name, bundle] of Object.entries(locales)) {
      for (const [key, value] of Object.entries(bundle.PRIMENG)) {
        if (typeof value === 'string') {
          expect(value.trim(), `${name}.${key}`).not.toBe('');
        }
      }
      for (const [key, value] of Object.entries(bundle.PRIMENG['aria'] as Record<string, string>)) {
        expect(value.trim(), `${name}.aria.${key}`).not.toBe('');
      }
    }
  });
});
