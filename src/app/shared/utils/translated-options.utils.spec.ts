import { computed, Injector, runInInjectionContext, Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateLoader, TranslateModule, TranslateService } from '@ngx-translate/core';
import { Observable, Subject } from 'rxjs';

import { translatedOptions, translationChanges } from './translated-options.utils';

const FR = { FIELD: { NAME: 'Nom', EAN: 'EAN du compteur' } };
const EN = { FIELD: { NAME: 'Name', EAN: 'Meter EAN' } };

const OPTIONS = [
  { label: 'FIELD.NAME', value: 'name', icon: 'pi pi-user' },
  { label: 'FIELD.EAN', value: 'EAN', icon: 'pi pi-bolt' },
] as const;

describe('translatedOptions', () => {
  let translate: TranslateService;

  function build(): Signal<(typeof OPTIONS)[number][]> {
    return runInInjectionContext(TestBed.inject(Injector), () => translatedOptions(OPTIONS));
  }

  describe('with the bundles already present', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [TranslateModule.forRoot()] });
      translate = TestBed.inject(TranslateService);
      translate.setTranslation('fr', FR);
      translate.setTranslation('en', EN);
      translate.use('fr');
    });

    it('should replace each key with its translation', () => {
      expect(build()().map((option) => option.label)).toEqual(['Nom', 'EAN du compteur']);
    });

    it('should keep every other field, in order', () => {
      expect(build()().map(({ value, icon }) => ({ value, icon }))).toEqual([
        { value: 'name', icon: 'pi pi-user' },
        { value: 'EAN', icon: 'pi pi-bolt' },
      ]);
    });

    it('should not touch the options it was given', () => {
      build()();
      expect(OPTIONS[0].label).toBe('FIELD.NAME');
    });

    it('should translate again when the language changes', () => {
      const options = build();
      expect(options()[0].label).toBe('Nom');

      translate.use('en');

      expect(options().map((option) => option.label)).toEqual(['Name', 'Meter EAN']);
    });

    it('should follow a change to the current bundle', () => {
      const options = build();
      expect(options()[0].label).toBe('Nom');

      translate.setTranslation('fr', { FIELD: { NAME: 'Nom complet' } }, true);

      expect(options()[0].label).toBe('Nom complet');
    });

    it('should fall back to the key for a missing translation', () => {
      const options = runInInjectionContext(TestBed.inject(Injector), () =>
        translatedOptions([{ label: 'FIELD.UNKNOWN', value: 1 }]),
      );
      expect(options()[0].label).toBe('FIELD.UNKNOWN');
    });

    it('should return an empty list for no options', () => {
      const options = runInInjectionContext(TestBed.inject(Injector), () =>
        translatedOptions<{ label: string }>([]),
      );
      expect(options()).toEqual([]);
    });
  });

  // The start-up race: the first `use()` sets the current language at once but
  // emits it only after the bundle arrives - the same 'fr' both times.
  describe('when the bundle is still loading', () => {
    let bundle: Subject<Record<string, unknown>>;

    beforeEach(() => {
      bundle = new Subject();
      TestBed.configureTestingModule({
        imports: [
          TranslateModule.forRoot({
            loader: {
              provide: TranslateLoader,
              useValue: { getTranslation: (): Observable<Record<string, unknown>> => bundle },
            },
          }),
        ],
      });
      translate = TestBed.inject(TranslateService);
      translate.use('fr');
    });

    it('should translate once the bundle for the same language arrives', () => {
      const options = build();
      expect(translate.getCurrentLang()).toBe('fr');
      expect(options()[0].label).toBe('FIELD.NAME');

      bundle.next(FR);
      bundle.complete();

      expect(options().map((option) => option.label)).toEqual(['Nom', 'EAN du compteur']);
    });
  });
});

describe('translationChanges', () => {
  it('should make a computed with interpolation follow the language', () => {
    TestBed.configureTestingModule({ imports: [TranslateModule.forRoot()] });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('fr', { RUN: 'Itération {{number}}' });
    translate.setTranslation('en', { RUN: 'Iteration {{number}}' });
    translate.use('fr');

    const label = runInInjectionContext(TestBed.inject(Injector), () => {
      const changed = translationChanges();
      return computed(() => {
        changed();
        return translate.instant('RUN', { number: 2 }) as string;
      });
    });
    expect(label()).toBe('Itération 2');

    translate.use('en');
    expect(label()).toBe('Iteration 2');
  });
});
