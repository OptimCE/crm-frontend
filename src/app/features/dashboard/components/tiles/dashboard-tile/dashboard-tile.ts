import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';

import { TileState } from '../../../dashboard-format';

/**
 * The shell every dashboard tile wraps itself in.
 *
 * Owns the loading / error / empty / ready state machine so that one dead annexe
 * degrades to a single card instead of blanking the page, and so every tile
 * announces itself the same way.
 *
 * Accessibility contract, deliberately centralised here rather than repeated:
 *  - each tile is a named region (`section` + `aria-labelledby`), so a screen
 *    reader can jump tile to tile;
 *  - `aria-busy` plus a visually hidden `role="status"` while loading — the rest
 *    of the app shows skeletons and announces nothing;
 *  - the heading is an `h2`: `app-header-page` owns the page's single `h1`.
 */
@Component({
  selector: 'app-dashboard-tile',
  standalone: true,
  imports: [TranslatePipe, Button, Skeleton],
  templateUrl: './dashboard-tile.html',
  styleUrl: './dashboard-tile.css',
})
export class DashboardTile {
  readonly title = input.required<string>();
  readonly icon = input.required<string>();
  readonly state = input.required<TileState>();
  /** Must be unique on the page — it is the target of `aria-labelledby`. */
  readonly headingId = input.required<string>();

  readonly retry = output<void>();

  protected readonly skeletons = [1, 2, 3];
}
