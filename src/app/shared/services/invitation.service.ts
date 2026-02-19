import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environments } from '../../../environments/environments';
import { ApiResponse, ApiResponsePaginated } from '../../core/dtos/api.response';
import {
  AcceptInvitationDTO,
  AcceptInvitationWEncodedDTO,
  InviteUser,
  UserManagerInvitationDTO,
  UserManagerInvitationQuery,
  UserMemberInvitationDTO,
  UserMemberInvitationQuery,
} from '../dtos/invitation.dtos';
import { CompanyDTO, IndividualDTO } from '../dtos/member.dtos';

@Injectable({
  providedIn: 'root',
})
export class InvitationService {
  private http = inject(HttpClient);
  private apiAddress: string;

  constructor() {
    this.apiAddress = environments.apiUrl + '/invitations';
  }

  getMembersPendingInviation(query: UserMemberInvitationQuery) {
    return this.http.get<ApiResponsePaginated<UserMemberInvitationDTO[] | string>>(
      this.apiAddress + '/',
      {
        params: {
          ...query,
        },
      },
    );
  }

  getManagerPendingInvitation(query: UserManagerInvitationQuery) {
    return this.http.get<ApiResponsePaginated<UserManagerInvitationDTO[] | string>>(
      this.apiAddress + '/managers',
      {
        params: {
          ...query,
        },
      },
    );
  }

  getOwnMembersPendingInviation(query: UserMemberInvitationQuery) {
    return this.http.get<ApiResponsePaginated<UserMemberInvitationDTO[] | string>>(
      this.apiAddress + '/own',
      {
        params: {
          ...query,
        },
      },
    );
  }

  getOwnMemberPendingInvitationById(id: number) {
    return this.http.get<ApiResponse<IndividualDTO | CompanyDTO | string>>(
      this.apiAddress + '/own/members/' + id,
    );
  }

  getOwnManagerPendingInvitation(query: UserManagerInvitationQuery) {
    return this.http.get<ApiResponsePaginated<UserManagerInvitationDTO[] | string>>(
      this.apiAddress + '/own/managers',
      {
        params: {
          ...query,
        },
      },
    );
  }

  inviteUserToBecomeMember(invitation: InviteUser) {
    return this.http.post<ApiResponse<string>>(this.apiAddress + '/member', invitation);
  }

  inviteUserToBecomeManager(invitation: InviteUser) {
    return this.http.post<ApiResponse<string>>(this.apiAddress + '/manager', invitation);
  }

  acceptInvitationMember(accept_invitation: AcceptInvitationDTO) {
    return this.http.post<ApiResponse<string>>(this.apiAddress + '/accept', accept_invitation);
  }

  acceptInvitationMemberEncoded(accept_invitation: AcceptInvitationWEncodedDTO) {
    return this.http.post<ApiResponse<string>>(
      this.apiAddress + '/accept/encoded',
      accept_invitation,
    );
  }

  acceptInvitationManager(accept_invitation: AcceptInvitationDTO) {
    return this.http.post<ApiResponse<string>>(
      this.apiAddress + '/accept/manager',
      accept_invitation,
    );
  }

  cancelMemberInvitation(id_invitation: number) {
    return this.http.delete<ApiResponse<string>>(this.apiAddress + `/${id_invitation}/member`);
  }
  cancelManagerInvitation(id_invitation: number) {
    return this.http.delete<ApiResponse<string>>(this.apiAddress + `/${id_invitation}/manager`);
  }

  refuseMemberInvitation(id_invitation: number) {
    return this.http.delete<ApiResponse<string>>(this.apiAddress + `/${id_invitation}/own/member`);
  }
  refuseManagerInvitation(id_invitation: number) {
    return this.http.delete<ApiResponse<string>>(this.apiAddress + `/${id_invitation}/own/manager`);
  }
}
