import { Role } from '../../core/dtos/role';
import { PaginationQuery, Sort } from './query.dtos';

export interface CommunityQueryDTO extends PaginationQuery {
  name?: string;
  sort_name?: Sort;
  sort_id?: Sort;
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
  logo_url: string | null;
}

export interface MyCommunityDTO {
  id: number;
  auth_community_id: string;
  name: string;
  role: Role;
  logo_url?: string | null;
}

export interface CommunityDetailDTO {
  id: number;
  name: string;
  auth_community_id: string;
  created_at: string;
  updated_at: string;
  member_count: number;
  user_role?: Role;
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
}

export interface PatchRoleUserDTO {
  id_user: number;
  new_role: Role;
}
