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
