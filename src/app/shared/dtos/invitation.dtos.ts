import { PaginationQuery, Sort } from './query.dtos';
import { CommunityDTO } from './community.dtos';
import { CreateMemberDTO } from './member.dtos';

export interface UserMemberInvitationQuery extends PaginationQuery {
  name?: string;
  to_be_encoded?: boolean;
  sort_name?: Sort;
  sort_date?: Sort;
  sort_email?: Sort;
}

/**
 * DTO representing an invitation for a user to become a member.
 */
export interface UserMemberInvitationDTO {
  id: number;
  member_id?: number;
  member_name?: string;
  user_email: string;
  created_at: Date;
  to_be_encoded: boolean;
  community: CommunityDTO;
}

/**
 * DTO for querying manager invitations.
 */
export interface UserManagerInvitationQuery extends PaginationQuery {
  name?: string;
  sort_name?: Sort;
  sort_date?: Sort;
}
/**
 * DTO representing an invitation for a user to become a manager.
 */
export interface UserManagerInvitationDTO {
  id: number;
  user_email: string;
  community: CommunityDTO;
  created_at: Date;
}

/**
 * DTO for sending an invitation.
 */
export interface InviteUser {
  user_email: string;
}

/**
 * DTO for accepting an invitation.
 */
export interface AcceptInvitationDTO {
  invitation_id: number;
}

/**
 * DTO for accepting an invitation with additional member details.
 * Used when the member needs to be encoded/created during acceptance.
 */
export interface AcceptInvitationWEncodedDTO extends AcceptInvitationDTO {
  member: CreateMemberDTO;
}
