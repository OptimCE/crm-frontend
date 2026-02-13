export const environments = {
  apiUrl: 'http://localhost:8080',
  basePath: 'http://localhost:4200',
  keycloak: {
    realm: 'optimce-realm',
    url: 'http://localhost:8081',
    clientId: 'optimce-frontend',
    urlPattern: /^(http:\/\/localhost:8080)(\/.*)?$/i,
  },
};
