/**
 * Format a `Date` as a `YYYY-MM-DD` calendar-date string using the host's local
 * timezone. The PrimeNG datepicker returns a Date at local midnight for the
 * picked day, so reading local components preserves the user's intent without
 * any UTC conversion (which would shift to the previous day for users west
 * of UTC at certain times of year — and to the next day east of UTC).
 */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * The inverse of `toLocalDateString`: a `YYYY-MM-DD` calendar date as a `Date` at
 * local midnight (what the datepicker shows), or null for a blank or malformed one.
 */
export function fromLocalDateString(value: string | null | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/**
 * Format a UTC ISO timestamp as Brussels wall-clock time (dd/MM/yyyy HH:mm:ss).
 * Consumption data is stored as timestamptz but represents Belgian local slots.
 */
export function formatBrusselsWallClockDateTime(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';

  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}:${get('second')}`;
}
