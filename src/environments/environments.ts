type RuntimeKeycloakConfig = {
  realm: string;
  url: string;
  clientId: string;
  urlPattern: string;
  urlPatternFlags?: string;
};

type RuntimeConfig = {
  apiUrl: string;
  basePath: string;
  keycloak: RuntimeKeycloakConfig;
};

// These default values are for local development, need to be overridden using config.json in production (see assets/config/config.json)
const DEFAULT_CONFIG: RuntimeConfig = {
  apiUrl: 'http://localhost:8080',
  basePath: 'http://localhost:4200',
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
export function setRuntimeConfig(config: Partial<RuntimeConfig>) {
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
  get keycloak() {
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
