import Keycloak from 'keycloak-js';
import { UserContextService } from '../services/authorization/authorization.service';

export function initUserContextAfterKeycloak(userContext: UserContextService, keycloak: Keycloak) {
  return () => {
    // Keycloak is initialized by provideKeycloakAngular at this point.
    if (keycloak.authenticated) {
      userContext.refreshUserContext();
    }
    return Promise.resolve();
  };
}
export function registerKeycloakHooks(userContext: UserContextService, keycloak: Keycloak) {
  return () => {
    keycloak.onAuthSuccess = () => userContext.refreshUserContext();
    keycloak.onAuthRefreshSuccess = () => userContext.refreshUserContext();
    keycloak.onAuthLogout = () => {
      userContext.communitiesById.set({});
      userContext.activeCommunityId.set(null);
    };
    return Promise.resolve();
  };
}
