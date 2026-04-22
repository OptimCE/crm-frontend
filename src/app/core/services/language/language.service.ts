import { inject, Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

const SUPPORTED_LANGUAGES = ['fr', 'en', 'nl', 'de'] as const;
const DEFAULT_LANGUAGE = 'fr';

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  private translate = inject(TranslateService);
  constructor() {
    this.init();
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
