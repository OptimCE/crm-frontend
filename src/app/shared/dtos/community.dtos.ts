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
  sort_role?: Sort;
}

export interface CommunityDTO {
  name: string;
}

export interface MyCommunityDTO {
  id: number;
  auth_community_id: string;
  name: string;
  role: Role;
}

export interface UsersCommunityDTO {
  id_user: number;
  id_community: number;
  email: string;
  role: Role;
}

export interface CreateCommunityDTO {
  name: string;
}

export interface PatchRoleUserDTO {
  id_user: number;
  new_role: Role;
}
