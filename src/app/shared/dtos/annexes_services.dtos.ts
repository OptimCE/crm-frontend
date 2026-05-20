import { Role } from '../../core/dtos/role';

/**
 * Single entry of the annexes-services catalog as exposed by the CRM backend.
 * Mirrors `crm-backend/src/modules/annexes_services/api/annexes-services.dtos.ts`.
 */
export interface AnnexCatalogEntry {
  feature: string;
  displayKey: string;
  descriptionKey: string;
  icon: string;
  minRole: Role;
  frontendRoute: string;
  subscribePath: string;
  unsubscribePath: string;
}

/**
 * Catalog entry augmented with the active community's subscription state.
 */
export interface CommunityAnnex extends AnnexCatalogEntry {
  subscribed: boolean;
}
