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
  /**
   * Frontend i18n key appended to the generic unsubscribe confirmation; absent =
   * generic sentence only. Optional both ways: an older backend simply omits it.
   */
  unsubscribeWarningKey?: string;
}

/**
 * Catalog entry augmented with the active community's subscription state.
 */
export interface CommunityAnnex extends AnnexCatalogEntry {
  subscribed: boolean;
}
