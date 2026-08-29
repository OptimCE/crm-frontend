import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { MapViewMode } from '../map/map.types';

/**
 * A two-button list/map switch, sized to sit in the page header's action slot.
 *
 * Hand-rolled rather than PrimeNG tabs. `p-tabpanel` keeps `hidden` on its host
 * when deactivated, which means a WebGL canvas mounted inside one is 0x0 and
 * renders nothing until something calls `resize()` — and there is no lifecycle
 * hook to hang that on. It also latches `hasBeenRendered`, so the map and its
 * tile connections would stay alive for the rest of the page's life. Driving an
 * `@if` instead means exactly one view is ever instantiated.
 */
@Component({
  selector: 'app-view-toggle',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './view-toggle.html',
  styleUrl: './view-toggle.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewToggle {
  readonly value = input.required<MapViewMode>();
  readonly valueChange = output<MapViewMode>();

  protected select(mode: MapViewMode): void {
    if (mode !== this.value()) {
      this.valueChange.emit(mode);
    }
  }
}
