interface RuntimeKeycloakConfig {
  realm: string;
  url: string;
  clientId: string;
  urlPattern: string;
  urlPatternFlags?: string;
}

/** Basemap settings for the map views. */
interface RuntimeMapConfig {
  /**
   * MapLibre style JSON URL.
   *
   * Defaults to the OpenFreeMap public instance: no API key, no registration,
   * no request limit, commercial use allowed, OpenStreetMap data under ODbL.
   * Point it at a self-hosted style to remove the third-party dependency.
   */
  styleUrl: string;
  /**
   * Extra attribution to print on the map, on top of whatever the tiles already
   * declare.
   *
   * Empty by default, and deliberately so: OpenFreeMap's TileJSON already
   * carries "OpenFreeMap © OpenMapTiles Data from OpenStreetMap", MapLibre
   * picks it up automatically, and setting the same text here prints it twice.
   * Fill it in only for a self-hosted style whose TileJSON declares none —
   * OpenStreetMap-derived tiles are ODbL and the attribution is not optional.
   */
  attribution: string;
  /**
   * Font stack for the cluster and coincidence count labels.
   *
   * Must exist in the style's `glyphs` endpoint. OpenFreeMap's Liberty style
   * serves only Noto Sans — asking for "Open Sans Regular" makes every count
   * badge silently disappear, with nothing in the console. Override only when
   * self-hosting a style that ships a different family.
   */
  fontStack: string[];
}

export interface RuntimeConfig {
  apiUrl: string;
  basePath: string;
  /**
   * Absolute or root-relative URL of the SSE stream.
   *
   * Deliberately its OWN key rather than derived from `apiUrl`: this is the one
   * endpoint that bypasses the API gateway, and string-surgery on `apiUrl` is
   * exactly how such a URL ends up pointed somewhere unintended. Keeping it
   * explicit also makes the requirement checkable — it must NOT match
   * `keycloak.urlPattern`, because EventSource cannot send a bearer token and an
   * interceptor trying to attach one would be misleading.
   *
   * Rendered from the same `WEB_REALTIME_PATH` as the nginx location, so the two
   * cannot drift.
   */
  realtimeUrl: string;
  map: RuntimeMapConfig;
  keycloak: RuntimeKeycloakConfig;
}

// These default values are for local development, need to be overridden using config.json in production (see assets/config/config.json)
const DEFAULT_CONFIG: RuntimeConfig = {
  apiUrl: 'http://localhost:8080',
  basePath: 'http://localhost:4200',
  // Root-relative on purpose. An absolute http://localhost:8089 default would be
  // cross-origin from `ng serve` on :4200, and crm-backend has CORS disabled, so
  // the EventSource would fail with no diagnostic at all. Relative means it works
  // through the reverse proxy in Docker, and under `ng serve` it needs the
  // /realtime proxy entry in proxy.conf.json.
  realtimeUrl: '/realtime/stream',
  map: {
    styleUrl: 'https://tiles.openfreemap.org/styles/liberty',
    attribution: '',
    fontStack: ['Noto Sans Regular'],
  },
  keycloak: {
    realm: 'optimce-realm',
    url: 'http://localhost:8081',
    clientId: 'optimce-frontend',
    urlPattern: '^(http://localhost:8080)(/.*)?$',
    urlPatternFlags: 'i',
  },
};

let currentConfig: RuntimeConfig = DEFAULT_CONFIG;
// Apply given config then default values for missing properties
export function setRuntimeConfig(config: Partial<RuntimeConfig>): void {
  const mergedConfig: RuntimeConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    // The nested merge is hand-written per key, so every nested object needs
    // its own line here or a partial config silently drops its siblings.
    map: {
      ...DEFAULT_CONFIG.map,
      ...config.map,
    },
    keycloak: {
      ...DEFAULT_CONFIG.keycloak,
      ...config.keycloak,
    },
  };

  currentConfig = mergedConfig;
}
// Accessible variable for the rest of the app to read config values
export const environments = {
  get apiUrl(): string {
    return currentConfig.apiUrl;
  },
  get basePath(): string {
    return currentConfig.basePath;
  },
  get realtimeUrl(): string {
    return currentConfig.realtimeUrl;
  },
  get map(): RuntimeMapConfig {
    // envsubst renders an UNSET variable as "", and "" is not undefined — the
    // spread in setRuntimeConfig would happily install it and every tile
    // request would 404. Falling back on empty rather than only on absent.
    const map = currentConfig.map;
    return {
      styleUrl: map.styleUrl || DEFAULT_CONFIG.map.styleUrl,
      // No `||` fallback: an empty attribution is a valid, intended value.
      attribution: map.attribution ?? DEFAULT_CONFIG.map.attribution,
      fontStack: map.fontStack?.length ? map.fontStack : DEFAULT_CONFIG.map.fontStack,
    };
  },
  get keycloak(): {
    realm: string;
    url: string;
    clientId: string;
    urlPattern: RegExp;
  } {
    return {
      realm: currentConfig.keycloak.realm,
      url: currentConfig.keycloak.url,
      clientId: currentConfig.keycloak.clientId,
      urlPattern: new RegExp(
        currentConfig.keycloak.urlPattern,
        currentConfig.keycloak.urlPatternFlags,
      ),
    };
  },
};
