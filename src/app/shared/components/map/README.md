# Map components

A MapLibre GL canvas plus the pieces around it, shared by every list view that
has a map twin (`/meters`, `/communities/public`, the sharing-operation meters
tabs, and a member's own meters).

`MapCanvas` is deliberately feature-agnostic: callers map their DTOs onto
`MapPoint` / `MapZone` and this folder knows nothing about meters or
communities. The per-feature adapters live next to the list they belong to.

## Why the library is loaded through a token

`maplibre-gl` is reached only through `await import('maplibre-gl')` inside
`map.loader.ts`, behind the `MAPLIBRE_LOADER` injection token. That buys two
things:

- esbuild emits maplibre as its own chunk, fetched the first time someone opens
  a map — never in the initial bundle.
- Specs provide a fake and never resolve the real module, which cannot run under
  jsdom (no WebGL2, no layout).

The same shape as `shared/components/markdown-editor`, for the same reasons.

## Build requirements

`angular.json` copies three files out of `node_modules/maplibre-gl/dist` into
`maplibre/`:

| File                     | Why                                                                                                                                                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `maplibre-gl-worker.mjs` | v6 is ESM-only and loads its worker from a separate file at runtime; `import.meta.url` does not resolve inside a bundler's module graph, so `setWorkerUrl()` is mandatory.                                     |
| `maplibre-gl-shared.mjs` | The worker statically imports it as a **sibling**. Ship one without the other and the container renders while no tile ever loads.                                                                              |
| `maplibre-gl.css`        | 83 kB — too big for a component `styleUrl` (the `anyComponentStyle` budget errors at 8 kB) and wasteful in the global styles array. The loader injects it as a `<link>` instead, so only map users pay for it. |

Smoke-test a **production** build served by nginx, not `ng serve`: Vite resolves
`node_modules` and would mask a wrong asset path.

## Collision handling

Three distinct problems, which is why there is more here than a call to
`cluster: true`:

1. **Proximity** — the GeoJSON source clusters, and a cluster click resolves
   `getClusterExpansionZoom()` and eases in.
2. **Exactly coincident points** — two meters geocoded to one rooftop never
   separate however far you zoom, so `groupCoincidentPoints` merges them at 5
   decimal places (~1.1 m) into one feature carrying `count`. The source then
   sums `count` through `clusterProperties.total`, and the badge shows the
   number of _meters_, not the number of grouped features —
   `point_count_abbreviated` would report the latter, which is the wrong number.
3. **Overlapping polygons** — two sources, because MapLibre clusters Points
   only: an unclustered fill/line source above `ZONE_DETAIL_ZOOM`, and a
   clustered centroid source below it. A click runs one `queryRenderedFeatures`
   and de-dupes by `zone_key`, because a polygon spanning tile boundaries comes
   back once per tile.

One asymmetry worth knowing: the zone badge shows the number of **communes**,
not a summed community total. Summing per-commune counts double-counts a
community present in three communes, so that badge would simply be wrong.

## Configuration

`environments.map` carries `styleUrl`, `attribution` and `fontStack`, fed from
`WEB_MAP_STYLE_URL` through `crm-frontend-config/config.template.json`.

Two things that fail silently if changed carelessly:

- **`fontStack` must exist in the style's `glyphs` endpoint.** OpenFreeMap's
  Liberty style serves only Noto Sans; asking for "Open Sans Regular" makes
  every count badge disappear with nothing in the console.
- **`attribution` is empty by default, on purpose.** OpenFreeMap's TileJSON
  already declares "OpenFreeMap © OpenMapTiles Data from OpenStreetMap" and
  MapLibre renders it; repeating it in config prints it twice. Set it only for a
  self-hosted style whose TileJSON declares none — the tiles are ODbL and the
  attribution is not optional.

## If a CSP is ever added

There is none in the monorepo today. When one arrives it will need
`worker-src 'self' blob:`, `img-src 'self' data: blob:`, and the tile host in
`connect-src` — otherwise the map breaks with no obvious cause.
