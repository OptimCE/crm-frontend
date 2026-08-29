import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { vi } from 'vitest';
import { MapCanvas } from './map-canvas';
import { MAPLIBRE_LOADER, type MapLibreRuntime } from './map.loader';
import { L_CLUSTER, L_POINT, L_ZONE_FILL, SRC_POINTS } from './map-layers';
import type { MapPoint, MapZone } from './map.types';

// maplibre-gl cannot run under jsdom (no WebGL2, no layout). Belt and braces
// with the MAPLIBRE_LOADER override below: nothing here ever resolves the real
// module.
vi.mock('maplibre-gl', () => ({ Map: vi.fn(), Popup: vi.fn(), setWorkerUrl: vi.fn() }));

type Handler = (event: unknown) => void;

function fakeSource() {
  return {
    setData: vi.fn().mockResolvedValue(undefined),
    getClusterExpansionZoom: vi.fn().mockResolvedValue(12),
  };
}

function fakeMap() {
  const handlers = new Map<string, Handler[]>();
  const sources = new Map<string, ReturnType<typeof fakeSource>>();

  return {
    handlers,
    sources,
    on: vi.fn((event: string, a: unknown, b?: unknown) => {
      const fn = (typeof a === 'function' ? a : b) as Handler;
      handlers.set(event, [...(handlers.get(event) ?? []), fn]);
    }),
    fire: (event: string, payload?: unknown) => {
      for (const fn of handlers.get(event) ?? []) {
        fn(payload);
      }
    },
    addSource: vi.fn((id: string, _spec: unknown) => {
      sources.set(id, fakeSource());
    }),
    addLayer: vi.fn(),
    getLayer: vi.fn(() => ({})),
    getSource: vi.fn((id: string) => sources.get(id)),
    queryRenderedFeatures: vi.fn(() => [] as unknown[]),
    fitBounds: vi.fn(),
    easeTo: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    getCanvas: vi.fn(() => ({ style: {} })),
    remove: vi.fn(),
  };
}

function point(id: string, lat: number, lng: number, rank = 0): MapPoint {
  return { id, lat, lng, precision: 2, rank, title: id, routerLink: `/meters/${id}` };
}

function zone(id: string, groupKey: string): MapZone {
  return {
    id,
    groupKey,
    colorKey: id,
    title: id,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [4, 50],
          [5, 50],
          [5, 51],
          [4, 51],
          [4, 50],
        ],
      ],
    },
  };
}

describe('MapCanvas', () => {
  let map: ReturnType<typeof fakeMap>;
  let fixture: ComponentFixture<MapCanvas>;
  let component: MapCanvas;
  let webglSupported: boolean;

  beforeEach(async () => {
    map = fakeMap();
    webglSupported = true;

    // jsdom's canvas has no getContext for webgl2, so the probe is stubbed
    // rather than left to return null in every test.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) =>
      kind === 'webgl2' && webglSupported ? {} : null) as never);

    // Ordinary functions, not arrows: both are invoked with `new`, and an arrow
    // is not a constructor. A constructor returning an object yields that
    // object, which is how the fake map reaches the component.
    const runtime: MapLibreRuntime = {
      Map: vi.fn(function () {
        return map;
      }) as never,
      Popup: vi.fn(function () {
        return {
          setLngLat: vi.fn().mockReturnThis(),
          setDOMContent: vi.fn().mockReturnThis(),
          addTo: vi.fn().mockReturnThis(),
          on: vi.fn(),
          remove: vi.fn(),
        };
      }) as never,
    };

    await TestBed.configureTestingModule({
      imports: [MapCanvas, TranslateModule.forRoot()],
      providers: [
        { provide: MAPLIBRE_LOADER, useValue: () => Promise.resolve(runtime) },
        // The popup carries a RouterLink and is created with the ENVIRONMENT
        // injector, so it resolves ActivatedRoute from the root — which is why
        // MapPoint.routerLink must be an absolute path.
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MapCanvas);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  /** Boots the map and settles the effects that gate on `ready`. */
  async function boot(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    map.fire('load');
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('renders the container and the translated controls before any map exists', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('[data-testid="map-canvas__host"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="map-canvas__btn--zoom-in"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="map-canvas__btn--reset"]')).not.toBeNull();
  });

  it('does not touch the map before the load event fires', async () => {
    fixture.componentRef.setInput('points', [point('a', 50.85, 4.35)]);
    fixture.detectChanges();
    await fixture.whenStable();

    // Every effect gates on the `ready` signal; without that gate the first
    // dataset would be applied to a map whose sources do not exist yet.
    expect(map.addSource).not.toHaveBeenCalled();
  });

  it('applies data that arrived while the map was still booting', async () => {
    fixture.componentRef.setInput('points', [point('a', 50.85, 4.35)]);
    await boot();

    // `ready` being a signal is what replays this without a manual queue.
    expect(map.sources.get(SRC_POINTS)?.setData).toHaveBeenCalled();
  });

  it('sums coincident points into the cluster total, not the feature count', async () => {
    await boot();
    fixture.componentRef.setInput('points', [
      point('a', 50.85, 4.35),
      point('b', 50.85, 4.35),
      point('c', 51, 4.4),
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    const clusterProps = (map.addSource.mock.calls.find(([id]) => id === SRC_POINTS)?.[1] ??
      {}) as {
      cluster?: boolean;
      clusterProperties?: Record<string, unknown>;
    };
    expect(clusterProps.cluster).toBe(true);
    expect(clusterProps.clusterProperties?.['total']).toEqual(['+', ['get', 'count']]);

    const payload = map.sources.get(SRC_POINTS)?.setData.mock.lastCall?.[0] as {
      features: { properties: { count: number } }[];
    };
    // Two features for three points, and the grouped one knows it stands for 2.
    expect(payload.features).toHaveLength(2);
    expect(payload.features.map((f) => f.properties.count).sort()).toEqual([1, 2]);
  });

  it('emits every member of a coincidence group on a pin click', async () => {
    await boot();
    const points = [point('a', 50.85, 4.35), point('b', 50.85, 4.35)];
    fixture.componentRef.setInput('points', points);
    fixture.detectChanges();
    await fixture.whenStable();

    const selected: unknown[] = [];
    component.featureSelect.subscribe((selection) => selected.push(selection));

    map.queryRenderedFeatures.mockReturnValue([
      {
        layer: { id: L_POINT },
        properties: { group_key: '50.85000,4.35000' },
        geometry: { type: 'Point', coordinates: [4.35, 50.85] },
      },
    ]);
    map.fire('click', { point: { x: 1, y: 1 }, lngLat: { lng: 4.35, lat: 50.85 } });

    expect(selected).toHaveLength(1);
    expect((selected[0] as { points: MapPoint[] }).points.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('zooms into a cluster instead of opening a popup', async () => {
    await boot();
    fixture.componentRef.setInput('points', [point('a', 50.85, 4.35)]);
    fixture.detectChanges();
    await fixture.whenStable();

    map.queryRenderedFeatures.mockReturnValue([
      {
        layer: { id: L_CLUSTER },
        properties: { cluster_id: 7 },
        geometry: { type: 'Point', coordinates: [4.35, 50.85] },
      },
    ]);
    map.fire('click', { point: { x: 1, y: 1 }, lngLat: { lng: 4.35, lat: 50.85 } });
    await fixture.whenStable();

    expect(map.sources.get(SRC_POINTS)?.getClusterExpansionZoom).toHaveBeenCalledWith(7);
  });

  it('de-dupes overlapping polygons returned once per tile', async () => {
    await boot();
    fixture.componentRef.setInput('zones', [zone('c1:21004', '21004'), zone('c2:21004', '21004')]);
    fixture.detectChanges();
    await fixture.whenStable();

    const selected: unknown[] = [];
    component.featureSelect.subscribe((selection) => selected.push(selection));

    map.queryRenderedFeatures.mockReturnValue([
      { layer: { id: L_ZONE_FILL }, properties: { zone_key: 'c1:21004' } },
      // Same polygon, second tile.
      { layer: { id: L_ZONE_FILL }, properties: { zone_key: 'c1:21004' } },
      { layer: { id: L_ZONE_FILL }, properties: { zone_key: 'c2:21004' } },
    ]);
    map.fire('click', { point: { x: 1, y: 1 }, lngLat: { lng: 4.5, lat: 50.5 } });

    expect((selected[0] as { zones: MapZone[] }).zones.map((z) => z.id)).toEqual([
      'c1:21004',
      'c2:21004',
    ]);
  });

  it('shows the WebGL fallback and never loads the library', async () => {
    webglSupported = false;
    const errors: string[] = [];
    fixture.componentInstance.mapError.subscribe((kind) => errors.push(kind));

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // The probe runs BEFORE the ~570 kB dynamic import, so a browser without
    // WebGL2 never pays for it.
    expect(errors).toEqual(['webgl']);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="map-canvas__error"]'),
    ).not.toBeNull();
  });

  it('frames the data once and does not refit on an unrelated render', async () => {
    await boot();
    fixture.componentRef.setInput('points', [point('a', 50.85, 4.35), point('b', 51, 4.5)]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(map.fitBounds).toHaveBeenCalledTimes(1);

    fixture.detectChanges();
    await fixture.whenStable();

    // A user who has panned must not be yanked back on every change-detection
    // pass — only when the framed extent actually changes.
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
  });
});
