// eslint-disable-next-line no-restricted-imports -- the one place allowed to wrap them
import { DATE_PIPE_DEFAULT_OPTIONS, DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { inject, Pipe, PipeTransform } from '@angular/core';

import { LocaleService } from '../../../core/services/language/locale.service';

/*
 * `| number`, `| date` and `| percent`, written in the reader's language.
 *
 * Angular's own pipes format with LOCALE_ID, which is fixed at bootstrap - and
 * was never set here, so every figure came out en-US whatever the language.
 * These delegate to those same pipes (same arguments, same null handling, same
 * errors) but pass LocaleService.locale explicitly. A lint rule keeps Angular's
 * versions out of the app.
 *
 * IMPURE on purpose. A pure pipe re-runs only when its arguments change, so a
 * figure already on screen would keep the old language after a switch. Reading
 * the locale signal inside `transform` also marks an OnPush view for refresh.
 */

/** Angular's pipes take a constructor locale; every call here passes its own. */
const UNUSED_LOCALE = 'en';

/**
 * The last result, formatted again only when an input or the locale changed.
 *
 * Change detection calls an impure pipe on every pass, so an unchanged binding
 * should cost a comparison, not a re-format. Inputs compare by identity, as a
 * pure pipe's do: a Date mutated in place is not seen by either.
 */
class LastCall {
  private inputs: readonly unknown[] | null = null;
  private result: string | null = null;

  get(inputs: readonly unknown[], format: () => string | null): string | null {
    const last = this.inputs;
    if (last?.length === inputs.length && last.every((input, i) => Object.is(input, inputs[i]))) {
      return this.result;
    }
    this.result = format();
    this.inputs = inputs;
    return this.result;
  }
}

/** `| number: digitsInfo`, in the reader's language. */
@Pipe({ name: 'localeNumber', pure: false })
export class LocaleNumberPipe implements PipeTransform {
  private readonly locale = inject(LocaleService).locale;
  private readonly pipe = new DecimalPipe(UNUSED_LOCALE);
  private readonly last = new LastCall();

  transform(value: number | string | null | undefined, digitsInfo?: string): string | null {
    const locale = this.locale();
    return this.last.get([value, digitsInfo, locale], () =>
      this.pipe.transform(value, digitsInfo, locale),
    );
  }
}

/** `| percent: digitsInfo`, in the reader's language: 0.125 is "12,5 %" in French. */
@Pipe({ name: 'localePercent', pure: false })
export class LocalePercentPipe implements PipeTransform {
  private readonly locale = inject(LocaleService).locale;
  private readonly pipe = new PercentPipe(UNUSED_LOCALE);
  private readonly last = new LastCall();

  transform(value: number | string | null | undefined, digitsInfo?: string): string | null {
    const locale = this.locale();
    return this.last.get([value, digitsInfo, locale], () =>
      this.pipe.transform(value, digitsInfo, locale),
    );
  }
}

/**
 * `| date: format : timezone`, in the reader's language.
 *
 * A fixed pattern such as 'dd/MM/yyyy' comes out the same in every language (the
 * Belgian order the date pickers use too); the named ones - 'short', 'medium',
 * 'shortTime' - and month names follow the reader.
 */
@Pipe({ name: 'localeDate', pure: false })
export class LocaleDatePipe implements PipeTransform {
  private readonly locale = inject(LocaleService).locale;
  private readonly pipe = new DatePipe(
    UNUSED_LOCALE,
    null,
    inject(DATE_PIPE_DEFAULT_OPTIONS, { optional: true }),
  );
  private readonly last = new LastCall();

  transform(
    value: Date | string | number | null | undefined,
    format?: string,
    timezone?: string,
  ): string | null {
    const locale = this.locale();
    return this.last.get([value, format, timezone, locale], () =>
      this.pipe.transform(value, format, timezone, locale),
    );
  }
}
