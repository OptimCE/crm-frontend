import { inject, Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/** Largest-first unit ladder for `Intl.RelativeTimeFormat`. */
const UNITS: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
  { unit: 'year', seconds: 60 * 60 * 24 * 365 },
  { unit: 'month', seconds: 60 * 60 * 24 * 30 },
  { unit: 'week', seconds: 60 * 60 * 24 * 7 },
  { unit: 'day', seconds: 60 * 60 * 24 },
  { unit: 'hour', seconds: 60 * 60 },
  { unit: 'minute', seconds: 60 },
];

/** Below this many seconds we show a localized "just now" instead of "0 seconds ago". */
const JUST_NOW_THRESHOLD = 45;

/**
 * Renders an ISO timestamp (or Date) as a localized relative time, e.g.
 * "2 hours ago" / "il y a 2 heures". Unit words are localized by
 * `Intl.RelativeTimeFormat` using the active translate language; the sub-minute
 * "just now" string comes from i18n (`NOTIFICATIONS.JUST_NOW`).
 *
 * Pure pipe: it recomputes when the input reference changes (sufficient here —
 * notifications are refetched rather than ticking live).
 */
@Pipe({
  name: 'timeAgo',
})
export class TimeAgoPipe implements PipeTransform {
  private readonly translate = inject(TranslateService);

  transform(value: string | Date | null | undefined): string {
    if (!value) return '';
    const then = value instanceof Date ? value.getTime() : new Date(value).getTime();
    if (Number.isNaN(then)) return '';

    const diffSeconds = Math.round((then - Date.now()) / 1000);
    const absSeconds = Math.abs(diffSeconds);

    if (absSeconds < JUST_NOW_THRESHOLD) {
      return this.translate.instant('NOTIFICATIONS.JUST_NOW') as string;
    }

    const locale = this.translate.getCurrentLang() || 'fr';
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    for (const { unit, seconds } of UNITS) {
      if (absSeconds >= seconds) {
        return rtf.format(Math.round(diffSeconds / seconds), unit);
      }
    }
    // Between the just-now threshold and one minute.
    return rtf.format(Math.round(diffSeconds / 60), 'minute');
  }
}
