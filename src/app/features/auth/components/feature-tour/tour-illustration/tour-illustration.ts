import { Component, input } from '@angular/core';

export type TourIllustrationKind = 'community' | 'sharing' | 'keys' | 'billing' | 'memberSpace';

/** One settlement slot of the sharing slide's day: 24 hours × 4 quarter-hours = 96 cells. */
interface QuarterHourCell {
  x: number;
  y: number;
  fill: string;
  hour: number;
}

/** The website's quarter-hour ramp (website/DESIGN.md): empty, then four levels of shared energy. */
const RAMP = ['#eceff1', '#81c784', '#43a047', '#2e7d32', '#1b5e20'];

/** Shared-energy level of each hour of the drawn day: nothing at night, a plateau around noon. */
const HOURLY_LEVEL = [0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 3, 4, 4, 4, 3, 3, 2, 2, 1, 1, 0, 0, 0, 0];

const QUARTER_HOURS: readonly QuarterHourCell[] = HOURLY_LEVEL.flatMap((level, hour) =>
  [0, 1, 2, 3].map((quarter) => ({
    x: Math.round((56 + (hour * 368) / 24) * 10) / 10,
    y: 228 + quarter * 16,
    // A fixed wobble, so the four quarters of an hour don't read as identical rows.
    fill: RAMP[level > 0 && (hour * 7 + quarter * 3) % 5 === 0 ? level - 1 : level],
    hour,
  })),
);

/**
 * The login page's feature illustrations, drawn in the product's own vocabulary
 * (meters on a map, quarter-hours, keys, invoices) instead of stock artwork.
 *
 * Purely decorative: every drawing is `aria-hidden`, the slide's visible title says
 * what it shows. While `active` is true the host carries `is-playing`, which starts
 * the drawing's one-off build; it replays each time the slide comes back.
 */
@Component({
  selector: 'app-tour-illustration',
  standalone: true,
  templateUrl: './tour-illustration.html',
  styleUrl: './tour-illustration.css',
  host: { '[class.is-playing]': 'active()' },
})
export class TourIllustration {
  readonly kind = input.required<TourIllustrationKind>();
  readonly active = input(false);

  readonly quarterHours = QUARTER_HOURS;
}
