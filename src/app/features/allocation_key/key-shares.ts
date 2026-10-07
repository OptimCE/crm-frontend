/**
 * Pure helpers for allocation-key shares.
 *
 * A share is a fraction (0.7) of what the grid shows as a percentage (70 %). Typed percentages are
 * divided by 100 and then summed in floating point, so 70 % + 20 % + 10 % adds up to
 * 0.9999999999999999 and 7 % displays as 7.000000000000001 % unless both places allow for it.
 */

/**
 * Whether a sum of shares counts as 100 %.
 *
 * Mirrors the backend's AreIterationsSumOneConstraint / AreConsumersSumOneConstraint
 * (crm-backend `src/modules/keys/shared/validator.dtos.ts`) exactly, so the form refuses no key the
 * API would accept, and lets through none it would refuse.
 */
export function sumsToOne(sum: number): boolean {
  return sum >= 0.999 && sum <= 1.001;
}

/**
 * A share as the grid's percent text: 0.07 → `7%`, 1/7 → `14.2857%`.
 *
 * Rounds to four decimals to drop the binary noise of `share * 100`. Keeps a dot decimal and no
 * locale formatting, because the cell editor parses this text back with `^\d+(\.\d+)*$`. Only the
 * display is rounded; the share itself is submitted unchanged.
 */
export function formatShare(share: number): string {
  return `${Number((share * 100).toFixed(4))}%`;
}
