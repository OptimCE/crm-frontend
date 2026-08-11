import { Role } from '../../core/dtos/role';
import { PaginationQuery, Sort } from './query.dtos';
import { AddressDTO, CreateAddressDTO } from './address.dtos';

export interface CommunityQueryDTO extends PaginationQuery {
  name?: string;
  /** Filter by regulator code (see reference/regulators.json). */
  regulator?: string;
  sort_name?: Sort;
  sort_id?: Sort;
}

/** A single energy-market regulator entry from the shared registry. */
export interface RegulatorDTO {
  code: string;
  label: string;
  region: string;
  country: string;
  active: boolean;
}

export interface CommunityUsersQueryDTO extends PaginationQuery {
  email?: string;
  role?: Role;
  sort_email?: Sort;
  sort_id?: Sort;
  sort_name?: Sort;
  sort_role?: Sort;
}

export interface CommunityDTO {
  id: number;
  name: string;
  logo_url: string | null;
}

export interface PublicCommunityDTO {
  id: number;
  name: string;
  /** Coded regulator the community is notified to (see reference/regulators.json). */
  regulator: string;
  logo_url: string | null;
  /** Short-lived presigned URL (~15 min) for direct logo display. */
  logo_presigned_url: string | null;
}

export interface MyCommunityDTO {
  id: number;
  auth_community_id: string;
  name: string;
  role: Role;
  logo_url?: string | null;
  /**
   * Time-limited URL for the logo, or null when there is none.
   *
   * Not `logo_url`: that column holds a raw storage key, so rendering it gives a
   * broken image. Presigning can fail per row, hence nullable — the picker falls
   * back to the community's initials.
   */
  logo_presigned_url?: string | null;
}

export interface CommunityDetailDTO {
  id: number;
  name: string;
  auth_community_id: string;
  created_at: string;
  updated_at: string;
  member_count: number;
  /** Coded regulator the community is notified to (see reference/regulators.json). */
  regulator: string;
  description?: string | null;
  website_url?: string | null;
  logo_url?: string | null;
  /** Short-lived presigned URL (~15 min) for direct logo display. */
  logo_presigned_url?: string | null;
  headquarters_address?: AddressDTO | null;
  /** VAT / BTW number of the community. */
  vat_number?: string | null;
  /** Official registered legal name, distinct from the display name. */
  legal_name?: string | null;
  /** IBAN of the community's bank account. */
  iban?: string | null;
  /** Account holder name — only set when it differs from the legal name. */
  account_holder_name?: string | null;
}

export interface UsersCommunityDTO {
  id_user: number;
  id_community: number;
  email: string;
  role: Role;
  first_name?: string;
  last_name?: string;
  phone?: string;
}

export interface CreateCommunityDTO {
  name: string;
  /** Required coded regulator (defaulted to BE-WAL-CWAPE by the create form). */
  regulator: string;
}

export interface UpdateCommunityDTO {
  name?: string;
  description?: string | null;
  website_url?: string | null;
  /** Coded regulator; changing it is admin-gated and confirmed in the UI. */
  regulator?: string;
  headquarters_address?: CreateAddressDTO;
  vat_number?: string | null;
  legal_name?: string | null;
  iban?: string | null;
  /** Only sent when it differs from legal_name; otherwise null. */
  account_holder_name?: string | null;
}

export interface UploadLogoResponse {
  logo_url: string;
  logo_presigned_url: string;
}

export interface PatchRoleUserDTO {
  id_user: number;
  new_role: Role;
}
