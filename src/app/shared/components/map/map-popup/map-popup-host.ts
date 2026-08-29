import {
  ApplicationRef,
  ComponentRef,
  createComponent,
  DestroyRef,
  EnvironmentInjector,
  inject,
  Injectable,
} from '@angular/core';
import type { LngLatLike, Map as MapLibreMap, Popup } from 'maplibre-gl';
import type { MapLibreRuntime } from '../map.loader';
import { MapPopup, type MapPopupEntry } from './map-popup';

/**
 * Bridges an Angular component into a MapLibre popup.
 *
 * Provided at the map component's level, so there is exactly one live popup per
 * map and opening a second one closes the first.
 */
@Injectable()
export class MapPopupHost {
  private readonly environmentInjector = inject(EnvironmentInjector);
  private readonly appRef = inject(ApplicationRef);

  private ref: ComponentRef<MapPopup> | null = null;
  private popup: Popup | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.close());
  }

  open(
    runtime: MapLibreRuntime,
    map: MapLibreMap,
    lngLat: LngLatLike,
    titleKey: string,
    entries: readonly MapPopupEntry[],
  ): void {
    this.close();

    const ref = createComponent(MapPopup, { environmentInjector: this.environmentInjector });
    ref.setInput('titleKey', titleKey);
    ref.setInput('entries', entries);

    // LOAD-BEARING. A component created outside a view hierarchy receives no
    // change detection at all: without attachView the TranslatePipe would
    // resolve once and never repaint on a language change, and the @for over
    // pages would never update.
    this.appRef.attachView(ref.hostView);
    ref.changeDetectorRef.detectChanges();

    const popup = new runtime.Popup({
      // Our own translated button lives inside MapPopup; MapLibre's is
      // hard-coded English with no i18n hook.
      closeButton: false,
      closeOnClick: true,
      focusAfterOpen: true,
      maxWidth: '22rem',
      className: 'app-map-popup',
    })
      .setLngLat(lngLat)
      .setDOMContent(ref.location.nativeElement as HTMLElement)
      .addTo(map);

    ref.instance.closeRequest.subscribe(() => {
      this.close();
    });
    popup.on('close', () => {
      this.close();
    });

    this.ref = ref;
    this.popup = popup;
  }

  close(): void {
    const ref = this.ref;
    const popup = this.popup;

    // Null the fields FIRST. popup.remove() re-enters here through its own
    // 'close' event, and without this guard the second pass would destroy an
    // already-destroyed component and emit from a dead OutputRef.
    this.ref = null;
    this.popup = null;

    popup?.remove();
    if (ref) {
      this.appRef.detachView(ref.hostView);
      ref.destroy();
    }
  }
}
