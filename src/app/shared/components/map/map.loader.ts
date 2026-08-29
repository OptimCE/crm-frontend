import { InjectionToken } from '@angular/core';
import type { Map as MapLibreMap, Popup } from 'maplibre-gl';

/** The slice of the maplibre-gl module the map component actually constructs. */
export interface MapLibreRuntime {
  readonly Map: typeof MapLibreMap;
  readonly Popup: typeof Popup;
}

export type MapLibreLoader = () => Promise<MapLibreRuntime>;

/**
 * How the map component gets maplibre-gl.
 *
 * An injection token rather than a direct import, for two reasons that both
 * matter:
 *
 *  - The `import('maplibre-gl')` lives ONLY inside the default factory, so
 *    esbuild emits maplibre as its own chunk and it is fetched the first time
 *    someone opens a map — never on the initial bundle.
 *  - Specs provide a fake and never resolve the real module, which cannot run
 *    under jsdom (no WebGL2, no layout).
 */
export const MAPLIBRE_LOADER = new InjectionToken<MapLibreLoader>('MAPLIBRE_LOADER', {
  providedIn: 'root',
  factory: () => defaultMapLibreLoader,
});

/** Module-scoped so a second map in the same session skips the whole boot. */
let cached: Promise<MapLibreRuntime> | null = null;

const defaultMapLibreLoader: MapLibreLoader = () => (cached ??= boot());

async function boot(): Promise<MapLibreRuntime> {
  // Resolved against document.baseURI rather than an absolute '/': WEB_BASE_PATH
  // is '/' today, but an absolute path would break silently the day the SPA is
  // mounted on a sub-path.
  const base = document.baseURI;

  // Awaited so the first paint is never unstyled. The stylesheet is asset-copied
  // rather than bundled: at 83 kB it would blow the 8 kB per-component style
  // budget, and putting it in the global styles array would charge every user
  // of every page for a map most of them never open.
  await loadStylesheetOnce(new URL('maplibre/maplibre-gl.css', base).toString());

  const maplibre = await import('maplibre-gl');

  // maplibre-gl v6 is ESM-only and loads its worker from a separate file at
  // runtime; `import.meta.url` does not resolve inside a bundler's module
  // graph, so without this the worker 404s and no tiles ever render. The worker
  // statically imports maplibre-gl-shared.mjs as a SIBLING, so angular.json
  // must copy both into this same directory.
  maplibre.setWorkerUrl(new URL('maplibre/maplibre-gl-worker.mjs', base).toString());

  return { Map: maplibre.Map, Popup: maplibre.Popup };
}

const injectedStylesheets = new Set<string>();

function loadStylesheetOnce(href: string): Promise<void> {
  if (injectedStylesheets.has(href)) {
    return Promise.resolve();
  }
  injectedStylesheets.add(href);

  return new Promise<void>((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    // Resolve on error too: a missing stylesheet makes the map ugly, not
    // broken, and failing the whole boot over it would be worse.
    link.addEventListener('load', () => resolve());
    link.addEventListener('error', () => resolve());
    document.head.appendChild(link);
  });
}
