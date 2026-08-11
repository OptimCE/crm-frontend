/**
 * Readiness aggregate served by `GET /communities/dashboard`.
 *
 * Mirrors `crm-backend/src/modules/communities/api/community.dtos.ts`. Field
 * names match the CRM columns exactly so the tile can derive both its i18n key
 * and its "fix this" link from the field name, with no lookup table.
 */
export interface CommunityDashboardMembers {
  total: number;
  active: number;
  inactive: number;
  pending: number;
  /** Members nobody can log in as — no `user_member_link` row. */
  without_user_account: number;
  /** Blank required field, missing sub-type row, or a blank address component. */
  incomplete: number;
}

export interface CommunityDashboardMeters {
  total: number;
  active: number;
  inactive: number;
  waiting_grd: number;
  waiting_manager: number;
  /** No meter_data row covering today at all — no status, no holder, no operation. */
  without_active_data: number;
  /** Has a current row, but it is attached to no sharing operation. */
  not_in_sharing_operation: number;
}

export interface CommunityDashboardOperationRef {
  id: number;
  name: string;
}

export interface CommunityDashboardSharingOperations {
  total: number;
  without_valid_key: number;
  with_pending_key: number;
  /** Capped server-side; `without_valid_key` is the true count. */
  operations_without_valid_key: CommunityDashboardOperationRef[];
}

export interface CommunityDashboardInvitations {
  member_pending: number;
  member_to_be_encoded: number;
  manager_pending: number;
}

/** Community-level fields the readiness tile chases, as sent by the backend. */
export type CommunityLegalField =
  | 'vat_number'
  | 'legal_name'
  | 'iban'
  | 'account_holder_name'
  | 'headquarters_address'
  | 'regulator';

export interface CommunityDashboardLegalInfo {
  missing_fields: CommunityLegalField[];
  complete: boolean;
}

export interface CommunityDashboardDTO {
  /** Calendar date the windowed counters were evaluated at (`YYYY-MM-DD`). */
  as_of: string;
  members: CommunityDashboardMembers;
  meters: CommunityDashboardMeters;
  sharing_operations: CommunityDashboardSharingOperations;
  invitations: CommunityDashboardInvitations;
  legal_info: CommunityDashboardLegalInfo;
}
