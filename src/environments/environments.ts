interface RuntimeKeycloakConfig {
  realm: string;
  url: string;
  clientId: string;
  urlPattern: string;
  urlPatternFlags?: string;
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
