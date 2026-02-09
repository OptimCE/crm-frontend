import {AddressDTO, CreateAddressDTO, UpdateAddressDTO} from './address.dtos';
import {MemberStatus, MemberType} from '../types/member.types';
import {PaginationQuery, Sort} from './query.dtos';

export interface MemberPartialQuery extends PaginationQuery{
  name?: string;
  member_type?: MemberType;
  status?: MemberStatus;
  sort_name?: Sort;
}

export interface MembersPartialDTO {
  id: number;
  name: string;
  member_type: MemberType;
  status: MemberStatus;
}

export interface MemberDTO extends MembersPartialDTO {
  iban: string;
  home_address: AddressDTO;
  billing_address: AddressDTO;
  user_link_email?: string
}

export interface ManagerDTO {
  id: number;
  NRN: string;
  name: string;
  surname: string;
  email: string;
  phone_number?: string;
}

export interface IndividualDTO extends MemberDTO {
  NRN: string;
  first_name: string;
  email: string;
  phone_number: string;
  social_rate: boolean;
  manager?: ManagerDTO;
}

export interface CompanyDTO extends MemberDTO {
  vat_number: string;
  manager: ManagerDTO;
}
export interface CreateManagerDTO {
  NRN: string;
  name: string;
  surname: string;
  email: string;
  phone_number: string;
}
export interface CreateMemberDTO {
  name: string;
  member_type: MemberType;
  status: MemberStatus;
  iban: string;
  home_address: CreateAddressDTO;
  billing_address: CreateAddressDTO;
  first_name: string;
  NRN: string; // National Registry Number
  email: string;
  phone_number?: string;
  social_rate: boolean;
  vat_number: string;
  manager?: CreateManagerDTO;
}

/**
 * DTO for updating an existing member.
 * Most fields are optional to allow partial updates.
 */
export interface UpdateMemberDTO {
  id: number;
  name?: string;
  status?: MemberStatus;
  iban?: string;
  home_address?: UpdateAddressDTO;
  billing_address?: UpdateAddressDTO;
  first_name?: string;
  NRN?: string;
  email?: string;
  phone_number?: string;
  social_rate?: boolean;
  vat_number?: string;
  manager?: CreateManagerDTO;
}

/**
 * DTO for patching member status only.
 */
export interface PatchMemberStatusDTO {
  id_member: number;
  status: MemberStatus;
}

/**
 * DTO for inviting a user to link to a member account.
 */
export interface PatchMemberInviteUserDTO {
  id_member: number;
  user_email: string;
}

/**
 * DTO representing the link status between a member and a user account.
 */
export interface MemberLinkDTO {
  user_email?: string;
  user_id?: number;
  status?: MemberStatus;
  id?: number;
}

export interface MemberLinkQueryDTO{
  email: string;
}
