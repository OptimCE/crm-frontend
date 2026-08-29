import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { TagModule } from 'primeng/tag';
import type { MapBadgeSpec, MapFieldSpec } from '../map.types';

/** One row of a popup. Mirrors the shared part of MapPoint and MapZone. */
export interface MapPopupEntry {
  readonly id: string;
  readonly title: string;
  readonly fields?: readonly MapFieldSpec[];
  readonly badges?: readonly MapBadgeSpec[];
  /** Must be an ABSOLUTE path — see the note on MapPoint.routerLink. */
  readonly routerLink?: string;
  /** Shown when the point is a commune centroid rather than a real address. */
  readonly approximate?: boolean;
}

/**
 * The Angular content of a map popup.
 *
 * Created outside any view hierarchy by {@link MapPopupHost} and handed to
 * MapLibre via `setDOMContent`, which is why it is a plain component with no
 * assumptions about its parent.
 */
@Component({
  selector: 'app-map-popup',
  standalone: true,
  imports: [TranslatePipe, TagModule, RouterLink],
  templateUrl: './map-popup.html',
  styleUrl: './map-popup.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'dialog',
    tabindex: '-1',
    class: 'app-map-popup__root',
    '(keydown.escape)': 'closeRequest.emit()',
  },
})
export class MapPopup {
  readonly titleKey = input.required<string>();
  readonly entries = input.required<readonly MapPopupEntry[]>();
  readonly closeRequest = output<void>();

  /**
   * Paged AND scrollable, both on purpose: paging keeps the DOM small so
   * MapLibre's per-frame popup repositioning stays cheap, and scrolling keeps a
   * five-item page usable at 320px.
   */
  protected readonly pageSize = 5;
  protected readonly page = signal(0);

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.entries().length / this.pageSize)),
  );

  protected readonly visible = computed(() =>
    this.entries().slice(this.page() * this.pageSize, (this.page() + 1) * this.pageSize),
  );

  protected previous(): void {
    this.page.update((current) => Math.max(0, current - 1));
  }

  protected next(): void {
    this.page.update((current) => Math.min(this.pageCount() - 1, current + 1));
  }
}
