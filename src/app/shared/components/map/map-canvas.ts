import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  NgZone,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapMouseEvent,
  MapGeoJSONFeature,
} from 'maplibre-gl';
import { environments } from '../../../../environments/environments';
import { MAPLIBRE_LOADER, type MapLibreRuntime } from './map.loader';
import {
  buildPointSource,
  buildZoneCentroids,
  buildZoneSource,
  computeBounds,
  groupCoincidentPoints,
  type PointGroup,
} from './map-cluster';
import {
  L_CLUSTER,
  L_POINT,
  L_ZONE_CLUSTER,
  L_ZONE_FILL,
  pointLayers,
  SRC_POINTS,
  SRC_ZONE_CENTROIDS,
  SRC_ZONE_FILL,
  zoneLayers,
} from './map-layers';
import { MapPopupHost } from './map-popup/map-popup-host';
import type { MapPopupEntry } from './map-popup/map-popup';
import {
  MAP_DEFAULT_CENTER,
  MAP_DEFAULT_ZOOM,
  MAP_PRECISION_APPROXIMATE,
  type MapErrorKind,
  type MapFitTarget,
  type MapPoint,
  type MapSelection,
  type MapZone,
} from './map.types';

/**
 * A MapLibre canvas driven by signal inputs.
 *
 * Feature-agnostic on purpose: callers map their DTOs onto {@link MapPoint} /
 * {@link MapZone} and this knows nothing about meters or communities.
 */
@Component({
  selector: 'app-map-canvas',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './map-canvas.html',
  styleUrl: './map-canvas.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MapPopupHost],
})
export class MapCanvas {
  readonly points = input<readonly MapPoint[]>([]);
  readonly zones = input<readonly MapZone[]>([]);
  readonly fitTo = input<MapFitTarget>('all');
  readonly clusterRadius = input(50);
  readonly clusterMaxZoom = input(14);
  readonly pointsPopupTitleKey = input('MAP.POPUP.TITLE_POINTS');
  readonly zonesPopupTitleKey = input('MAP.POPUP.TITLE_ZONES');
  readonly ariaLabel = input('');

  readonly featureSelect = output<MapSelection>();
  readonly mapError = output<MapErrorKind>();

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('mapHost');
  private readonly zone = inject(NgZone);
  private readonly loader = inject(MAPLIBRE_LOADER);
  private readonly popupHost = inject(MapPopupHost);

  /**
   * Flips on the map's `load` event. A SIGNAL rather than a field, deliberately:
   * every effect below gates on it, so they re-run by themselves the moment the
   * map exists and apply the latest inputs. That removes any need for a manual
   * replay queue for data that arrived while the map was still booting.
   */
  protected readonly ready = signal(false);
  protected readonly failed = signal<MapErrorKind | null>(null);

  private map: MapLibreMap | null = null;
  private runtime: MapLibreRuntime | null = null;
  /** Members by feature `group_key`, so properties stay flat primitives. */
  private pointIndex = new Map<string, readonly MapPoint[]>();
  private zoneIndex = new Map<string, MapZone>();
  private zoneGroupIndex = new Map<string, readonly MapPoint[]>();
  private lastFitSignature = '';

  constructor() {
    afterNextRender(() => void this.boot());
    inject(DestroyRef).onDestroy(() => this.teardown());

    effect(() => {
      if (!this.ready()) return;
      this.applyPoints(this.points());
    });
    effect(() => {
      if (!this.ready()) return;
      this.applyZones(this.zones());
    });
    effect(() => {
      // Reads points()/zones() on purpose: a filter change is a new dataset and
      // should refit, while a user's pan survives until the data itself changes.
      if (!this.ready()) return;
      this.applyFit(this.fitTo(), this.points(), this.zones());
    });
  }

  private async boot(): Promise<void> {
    // Probe BEFORE paying for a ~570 kB dynamic import. maplibre-gl v6 requires
    // WebGL2, and a browser without it must land in a translated fallback
    // rather than a stack trace.
    if (!hasWebGl2()) {
      this.failed.set('webgl');
      this.mapError.emit('webgl');
      return;
    }

    let runtime: MapLibreRuntime;
    try {
      runtime = await this.loader();
    } catch {
      this.failed.set('load');
      this.mapError.emit('load');
      return;
    }
    this.runtime = runtime;

    // MapLibre drives a requestAnimationFrame render loop, which zone.js
    // patches. Constructed inside the zone, every pan and zoom would run a full
    // app-wide change-detection cycle at 60 Hz. Same reasoning the realtime
    // service already applies to EventSource.
    //
    // The constructor itself can throw — a lost WebGL context, a style URL that
    // is not JSON. Uncaught, that would leave the user staring at a spinner
    // that never resolves, so it lands in the same visible error state as a
    // failed import.
    try {
      this.createMap(runtime);
    } catch {
      this.failed.set('load');
      this.mapError.emit('load');
    }
  }

  private createMap(runtime: MapLibreRuntime): void {
    this.zone.runOutsideAngular(() => {
      const map = new runtime.Map({
        container: this.host().nativeElement,
        style: environments.map.styleUrl,
        center: [...MAP_DEFAULT_CENTER] as [number, number],
        zoom: MAP_DEFAULT_ZOOM,
        // The control is always on — the tiles are OpenStreetMap data under
        // ODbL. Extra text is added ONLY when configured: OpenFreeMap's
        // TileJSON already declares its attribution and MapLibre renders it, so
        // repeating it here would print it twice.
        // `{}` rather than `true`: in v6 the option is
        // `false | AttributionControlOptions`, and an empty object is "on with
        // defaults".
        attributionControl: environments.map.attribution
          ? { customAttribution: environments.map.attribution }
          : {},
      });

      map.on('load', () => {
        this.zone.run(() => {
          this.install(map);
          this.ready.set(true);
        });
      });
      map.on('click', (event) => {
        this.zone.run(() => {
          this.onClick(map, event);
        });
      });
      // Cursor feedback touches nothing Angular owns, so it stays outside.
      map.on('mousemove', (event) => {
        const hits = this.queryInteractive(map, event);
        map.getCanvas().style.cursor = hits.length > 0 ? 'pointer' : '';
      });

      this.map = map;
    });
  }

  private install(map: MapLibreMap): void {
    const fontStack = environments.map.fontStack;

    map.addSource(SRC_POINTS, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      cluster: true,
      clusterRadius: this.clusterRadius(),
      clusterMaxZoom: this.clusterMaxZoom(),
      clusterProperties: {
        // The whole point of the coincidence pre-grouping: the badge must show
        // the number of POINTS, not the number of grouped features.
        total: ['+', ['get', 'count']],
        rank: ['max', ['get', 'rank']],
        approx: ['min', ['get', 'approx']],
      },
    });
    map.addSource(SRC_ZONE_FILL, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addSource(SRC_ZONE_CENTROIDS, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      cluster: true,
      clusterRadius: 60,
      clusterMaxZoom: 8,
    });

    // Zones first so pins always sit on top of a fill.
    for (const layer of zoneLayers(fontStack)) {
      map.addLayer(layer);
    }
    for (const layer of pointLayers(fontStack)) {
      map.addLayer(layer);
    }
  }

  private applyPoints(points: readonly MapPoint[]): void {
    const groups = groupCoincidentPoints(points);
    this.pointIndex = new Map(groups.map((group) => [group.key, group.members]));
    this.setData(SRC_POINTS, buildPointSource(groups));
  }

  private applyZones(zones: readonly MapZone[]): void {
    this.zoneIndex = new Map(zones.map((zone) => [zone.id, zone]));

    const centroids: PointGroup[] = buildZoneCentroids(zones);
    this.zoneGroupIndex = new Map(centroids.map((group) => [group.key, group.members]));

    this.setData(SRC_ZONE_FILL, buildZoneSource(zones));
    this.setData(SRC_ZONE_CENTROIDS, buildPointSource(centroids));
  }

  private setData(sourceId: string, data: GeoJSON.FeatureCollection): void {
    const source = this.map?.getSource<GeoJSONSource>(sourceId);
    // setData is async in maplibre-gl v6 (it hands the payload to the worker).
    // Nothing here depends on the round trip, and a rejection means the source
    // was removed mid-update, so it is explicitly voided rather than awaited.
    void source?.setData(data);
  }

  private applyFit(
    target: MapFitTarget,
    points: readonly MapPoint[],
    zones: readonly MapZone[],
  ): void {
    if (target === 'none' || !this.map) {
      return;
    }

    const bounds = computeBounds(
      target === 'zones' ? [] : points,
      target === 'points' ? [] : zones,
    );
    if (!bounds) {
      return;
    }

    // Refit only when the framed extent actually changed, so a user who has
    // panned is not yanked back on every unrelated re-render.
    const signature = bounds.map((value) => value.toFixed(4)).join(',');
    if (signature === this.lastFitSignature) {
      return;
    }
    this.lastFitSignature = signature;

    this.zone.runOutsideAngular(() => {
      this.map?.fitBounds(
        [
          [bounds[0], bounds[1]],
          [bounds[2], bounds[3]],
        ],
        // maxZoom stops a single point from zooming to street level, where the
        // user loses all context.
        { padding: 48, maxZoom: 15, duration: 400 },
      );
    });
  }

  private queryInteractive(map: MapLibreMap, event: MapMouseEvent): MapGeoJSONFeature[] {
    const layers = [L_CLUSTER, L_POINT, L_ZONE_CLUSTER, L_ZONE_FILL].filter((id) =>
      map.getLayer(id),
    );
    if (layers.length === 0) {
      return [];
    }
    return map.queryRenderedFeatures(event.point, { layers });
  }

  /**
   * ONE click handler, not one per layer.
   *
   * `map.on('click', layerId, ...)` fires once per matching layer, so a pin
   * sitting on a polygon would open two popups on top of each other. A single
   * queryRenderedFeatures in explicit priority order — cluster, then pin, then
   * zone — is the only way to get "the most specific thing under the cursor".
   */
  private onClick(map: MapLibreMap, event: MapMouseEvent): void {
    const hits = this.queryInteractive(map, event);
    if (hits.length === 0) {
      return;
    }

    const cluster = hits.find(
      (feature) => feature.layer.id === L_CLUSTER || feature.layer.id === L_ZONE_CLUSTER,
    );
    if (cluster) {
      void this.expandCluster(map, cluster);
      return;
    }

    const pin = hits.find((feature) => feature.layer.id === L_POINT);
    if (pin) {
      const key = String(pin.properties['group_key']);
      const members = this.pointIndex.get(key) ?? this.zoneGroupIndex.get(key) ?? [];
      if (members.length > 0) {
        this.openPoints(map, event, members);
      }
      return;
    }

    // Every polygon under the cursor, deduped by zone_key: a polygon that spans
    // tile boundaries comes back once PER TILE, and GeoJSON features carry no
    // stable id unless promoteId is set.
    const seen = new Set<string>();
    const zones: MapZone[] = [];
    for (const feature of hits) {
      if (feature.layer.id !== L_ZONE_FILL) continue;
      const key = String(feature.properties['zone_key']);
      if (seen.has(key)) continue;
      seen.add(key);
      const zone = this.zoneIndex.get(key);
      if (zone) zones.push(zone);
    }
    if (zones.length > 0) {
      this.openZones(map, event, zones);
    }
  }

  private async expandCluster(map: MapLibreMap, feature: MapGeoJSONFeature): Promise<void> {
    const sourceId = feature.layer.id === L_ZONE_CLUSTER ? SRC_ZONE_CENTROIDS : SRC_POINTS;
    const source = map.getSource<GeoJSONSource>(sourceId);
    const clusterId = feature.properties['cluster_id'] as number | undefined;
    if (!source || clusterId === undefined) {
      return;
    }
    try {
      const zoom = await source.getClusterExpansionZoom(clusterId);
      const coordinates = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
      this.zone.runOutsideAngular(() => {
        map.easeTo({ center: coordinates, zoom, duration: 400 });
      });
    } catch {
      // A cluster id can go stale between the click and the resolve if the data
      // was replaced. Doing nothing is the right answer; the next click works.
    }
  }

  private openPoints(map: MapLibreMap, event: MapMouseEvent, members: readonly MapPoint[]): void {
    const entries: MapPopupEntry[] = members.map((point) => ({
      id: point.id,
      title: point.title,
      fields: point.fields,
      badges: point.badges,
      routerLink: point.routerLink,
      approximate: point.precision === MAP_PRECISION_APPROXIMATE,
    }));

    this.showPopup(map, event, this.pointsPopupTitleKey(), entries);
    this.featureSelect.emit({
      kind: 'points',
      lng: event.lngLat.lng,
      lat: event.lngLat.lat,
      points: members,
    });
  }

  private openZones(map: MapLibreMap, event: MapMouseEvent, zones: readonly MapZone[]): void {
    const entries: MapPopupEntry[] = zones.map((zone) => ({
      id: zone.id,
      title: zone.title,
      fields: zone.fields,
      badges: zone.badges,
      routerLink: zone.routerLink,
    }));

    this.showPopup(map, event, this.zonesPopupTitleKey(), entries);
    this.featureSelect.emit({ kind: 'zones', lng: event.lngLat.lng, lat: event.lngLat.lat, zones });
  }

  private showPopup(
    map: MapLibreMap,
    event: MapMouseEvent,
    titleKey: string,
    entries: MapPopupEntry[],
  ): void {
    if (this.runtime) {
      this.popupHost.open(this.runtime, map, event.lngLat, titleKey, entries);
    }
  }

  protected zoomIn(): void {
    this.zone.runOutsideAngular(() => this.map?.zoomIn());
  }

  protected zoomOut(): void {
    this.zone.runOutsideAngular(() => this.map?.zoomOut());
  }

  protected resetView(): void {
    this.lastFitSignature = '';
    this.applyFit(this.fitTo(), this.points(), this.zones());
  }

  protected retry(): void {
    this.failed.set(null);
    void this.boot();
  }

  private teardown(): void {
    this.popupHost.close();
    this.map?.remove();
    this.map = null;
    this.runtime = null;
  }
}

/**
 * Whether the browser can run maplibre-gl v6 at all.
 *
 * Wrapped in try/catch because some hardened browsers throw from getContext
 * rather than returning null.
 */
function hasWebGl2(): boolean {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    return false;
  }
}
