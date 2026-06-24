/** Locale-aware relative/absolute time helpers for the news feed. */

function safeLocale(locale: string | null | undefined): string {
  return locale && locale.trim() ? locale : 'fr';
}

/** "il y a 2 jours" for recent items; falls back to an absolute date for old ones. */
export function timeAgo(iso: string, locale: string | null | undefined): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const loc = safeLocale(locale);
  const sec = Math.round((Date.now() - then) / 1000);
  const rtf = new Intl.RelativeTimeFormat(loc, { numeric: 'auto' });
  if (Math.abs(sec) < 60) return rtf.format(-sec, 'second');
  const min = Math.round(sec / 60);
  if (Math.abs(min) < 60) return rtf.format(-min, 'minute');
  const hr = Math.round(min / 60);
  if (Math.abs(hr) < 24) return rtf.format(-hr, 'hour');
  const day = Math.round(hr / 24);
  if (Math.abs(day) < 30) return rtf.format(-day, 'day');
  return new Intl.DateTimeFormat(loc, { dateStyle: 'medium' }).format(new Date(then));
}

/** "dans 3 jours" for a future deadline. Empty string once it has passed. */
export function timeUntil(iso: string, locale: string | null | undefined): string {
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return '';
  const diffMs = target - Date.now();
  if (diffMs <= 0) return '';
  const loc = safeLocale(locale);
  const rtf = new Intl.RelativeTimeFormat(loc, { numeric: 'auto' });
  const min = Math.round(diffMs / 60000);
  if (min < 60) return rtf.format(min, 'minute');
  const hr = Math.round(min / 60);
  if (hr < 24) return rtf.format(hr, 'hour');
  const day = Math.round(hr / 24);
  return rtf.format(day, 'day');
}
