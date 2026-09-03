import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { Translation } from 'primeng/api';
import { PrimeNG } from 'primeng/config';

const SUPPORTED_LANGUAGES = ['fr', 'en', 'nl', 'de'] as const;
const DEFAULT_LANGUAGE = 'fr';

/** Where the PrimeNG strings live in each locale file. */
const PRIMENG_BUNDLE_KEY = 'PRIMENG';

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  private translate = inject(TranslateService);
  private primeng = inject(PrimeNG);
  private destroyRef = inject(DestroyRef);

  constructor() {
    // PrimeNG keeps its own translation table, entirely separate from
    // ngx-translate: every component that renders text without an explicit
    // input — an empty message, a calendar's month names, a confirm dialog's
    // Yes/No — reads `PrimeNG.translation`, whose defaults are hardcoded
    // English. Switching the app language does not touch it, so it has to be
    // pushed across on every change.
    //
    // onLangChange rather than `use()`: it fires once the bundle is actually
    // loaded, so the `get` below resolves against real data instead of racing
    // the HTTP loader.
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.applyPrimeNgTranslation();
    });
    this.init();
  }

  /**
   * Copy this language's PrimeNG strings into PrimeNG's own table.
   *
   * The bundle mirrors PrimeNG's default translation exactly — all 72 keys,
   * including the nested 55-key `aria` object — and a test asserts that, which
   * matters because `setTranslation` merges SHALLOWLY. A partial `aria` would
   * not merge into the default one; it would REPLACE it and silently drop every
   * key it failed to list. Completeness is what makes the shallow merge safe.
   */
  private applyPrimeNgTranslation(): void {
    this.translate
      .get(PRIMENG_BUNDLE_KEY)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((bundle: unknown) => {
        // A missing key makes ngx-translate echo the key back as the string
        // 'PRIMENG'. setTranslation spreads its argument, and spreading a
        // string yields {0:'P',1:'R',…} — so an absent bundle would quietly
        // litter PrimeNG's translation table with numeric keys rather than
        // failing where anyone would notice.
        if (bundle && typeof bundle === 'object' && !Array.isArray(bundle)) {
          this.primeng.setTranslation(bundle as Translation);
        }
      });
  }

  setTranslate(lang: string): void {
    this.translate.setFallbackLang(lang);
    this.translate.use(lang);
  }

  init(): void {
    this.setlanguage();
  }

  getCurrentLanguage(): string | null {
    return localStorage.getItem('language');
  }

  setlanguage(): void {
    const savedLang = localStorage.getItem('language');
    if (savedLang && this.isSupported(savedLang)) {
      this.setTranslate(savedLang);
      return;
    }
    const detected = this.normalize(this.getUsersLocale());
    this.changeLanguage(detected ?? DEFAULT_LANGUAGE);
  }

  getUsersLocale(): string | undefined {
    if (typeof window === 'undefined' || typeof window.navigator === 'undefined') {
      return undefined;
    }
    const wn = window.navigator as Navigator & {
      browserLanguage?: string;
      userLanguage?: string;
      languages?: readonly string[];
    };
    return (
      (wn.languages && wn.languages[0]) || wn.language || wn.browserLanguage || wn.userLanguage
    );
  }

  changeLanguage(lang: string): void {
    const normalized = this.normalize(lang) ?? DEFAULT_LANGUAGE;
    localStorage.setItem('language', normalized);
    this.setTranslate(normalized);
  }

  private isSupported(lang: string): lang is (typeof SUPPORTED_LANGUAGES)[number] {
    return (SUPPORTED_LANGUAGES as readonly string[]).includes(lang);
  }

  private normalize(lang: string | undefined | null): string | undefined {
    if (!lang) return undefined;
    const base = lang.toLowerCase().split(/[-_]/)[0];
    return this.isSupported(base) ? base : undefined;
  }
}
