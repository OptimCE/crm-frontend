/**
 * `href` builders for one-click contact links.
 *
 * Pure functions so the decisions are testable without a TestBed. Angular's URL
 * sanitizer allows both `mailto:` and `tel:`, so the results bind straight to
 * `[href]`.
 */

/**
 * `tel:` link for a number as people type it (`+32 470 12 34 56`,
 * `04/123.45.67`): only the digits survive, plus a leading `+`. Phones and
 * softphones dial a bare digit string reliably; separators are not guaranteed.
 */
export function telHref(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  return 'tel:' + (trimmed.startsWith('+') ? '+' : '') + digits;
}

/** `mailto:` link for an address; surrounding spaces are dropped. */
export function mailtoHref(email: string): string {
  return 'mailto:' + email.trim();
}
