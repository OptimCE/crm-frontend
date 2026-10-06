import { computed, inject, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { merge } from 'rxjs';

/**
 * Select options declared with an i18n KEY as `label`, handed back with the label
 * TRANSLATED - and translated again whenever the language or its bundle changes.
 *
 * Translating only in the `item` / `selectedItem` templates is not enough: PrimeNG
 * copies the raw `optionLabel` into `aria-label` (on the select's combobox and on
 * every option `<li>`) and filters on it, so a screen reader announced
 * "MEMBER.LIST.NAME_LABEL" and `[filter]` matched keys instead of words. Feed the
 * result to `[options]` and render `option.label` as is.
 *
 * Every other field (`value`, `icon`, `severity`...) is copied unchanged, so a
 * select bound through `optionValue` keeps its selection across a switch.
 *
 * Call it in an injection context (a field initializer).
 */
export function translatedOptions<T extends { label: string }>(options: readonly T[]): Signal<T[]> {
  const translate = inject(TranslateService);
  const changed = translationChanges();
  return computed(() => {
    changed();
    return options.map((option) => ({
      ...option,
      label: translate.instant(option.label) as string,
    }));
  });
}

/**
 * A signal that changes whenever the language or its bundle does. Read it in a
 * `computed` that calls `instant()` itself - options built from an input, or a
 * label with interpolation params - so the result is translated again, the way
 * the translate pipe would be. `instant()` alone is read once and never again.
 *
 * Call it in an injection context (a field initializer).
 */
export function translationChanges(): Signal<unknown> {
  const translate = inject(TranslateService);
  // The EVENT, not the language code: on start-up `use('fr')` sets the current
  // language before its bundle arrives and only then emits 'fr' again - a
  // signal of the code would not change, and the labels would stay keys.
  // The three streams are the ones the translate pipe itself follows.
  return toSignal(
    merge(translate.onLangChange, translate.onTranslationChange, translate.onFallbackLangChange),
  );
}
