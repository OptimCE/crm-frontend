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
import {Observable} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class InvitationService {
  private http = inject(HttpClient);
  private apiAddress: string;

  constructor() {
    this.apiAddress = environments.apiUrl + '/invitations';
  }

  getMembersPendingInviation(query: UserMemberInvitationQuery): Observable<ApiResponsePaginated<UserMemberInvitationDTO[] | string>> {
    return this.http.get<ApiResponsePaginated<UserMemberInvitationDTO[] | string>>(
      this.apiAddress + '/',
      {
        params: {
          ...query,
        },
      },
    );
  }

  getManagerPendingInvitation(query: UserManagerInvitationQuery): Observable<ApiResponsePaginated<UserManagerInvitationDTO[] | string>> {
    return this.http.get<ApiResponsePaginated<UserManagerInvitationDTO[] | string>>(
      this.apiAddress + '/managers',
      {
        params: {
          ...query,
        },
      },
    );
  }

  getOwnMembersPendingInviation(query: UserMemberInvitationQuery): Observable<ApiResponsePaginated<UserMemberInvitationDTO[] | string>> {
    return this.http.get<ApiResponsePaginated<UserMemberInvitationDTO[] | string>>(
      this.apiAddress + '/own',
      {
        params: {
          ...query,
        },
      },
    );
  }

  getOwnMemberPendingInvitationById(id: number): Observable<ApiResponse<IndividualDTO | CompanyDTO | string>> {
    return this.http.get<ApiResponse<IndividualDTO | CompanyDTO | string>>(
      this.apiAddress + '/own/members/' + id,
    );
  }

  getOwnManagerPendingInvitation(query: UserManagerInvitationQuery): Observable<ApiResponsePaginated<UserManagerInvitationDTO[] | string>> {
    return this.http.get<ApiResponsePaginated<UserManagerInvitationDTO[] | string>>(
      this.apiAddress + '/own/managers',
      {
        params: {
          ...query,
        },
      },
    );
  }

  inviteUserToBecomeMember(invitation: InviteUser): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(this.apiAddress + '/member', invitation);
  }

  inviteUserToBecomeManager(invitation: InviteUser): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(this.apiAddress + '/manager', invitation);
  }

  acceptInvitationMember(accept_invitation: AcceptInvitationDTO): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(this.apiAddress + '/accept', accept_invitation);
  }

  acceptInvitationMemberEncoded(accept_invitation: AcceptInvitationWEncodedDTO): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(
      this.apiAddress + '/accept/encoded',
      accept_invitation,
    );
  }

  acceptInvitationManager(accept_invitation: AcceptInvitationDTO): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(
      this.apiAddress + '/accept/manager',
      accept_invitation,
    );
  }

  cancelMemberInvitation(id_invitation: number): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(this.apiAddress + `/${id_invitation}/member`);
  }
  cancelManagerInvitation(id_invitation: number): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(this.apiAddress + `/${id_invitation}/manager`);
  }

  refuseMemberInvitation(id_invitation: number): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(this.apiAddress + `/${id_invitation}/own/member`);
  }
  refuseManagerInvitation(id_invitation: number): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(this.apiAddress + `/${id_invitation}/own/manager`);
  }
}
