import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {environments} from '../../../environments/environments';
import {ApiResponse, ApiResponsePaginated} from '../../core/dtos/api.response';
import {UserDTO} from '../dtos/user.dtos';
import {
  AcceptInvitationDTO, AcceptInvitationWEncodedDTO,
  InviteUser,
  UserManagerInvitationDTO,
  UserManagerInvitationQuery,
  UserMemberInvitationDTO,
  UserMemberInvitationQuery
} from '../dtos/invitation.dtos';
import {Observable} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class InvitationService {
  private apiAddress: string;

  constructor(private http: HttpClient) {
    this.apiAddress = environments.apiUrl + '/invitations';
  }

  getMembersPendingInviation(query: UserMemberInvitationQuery){
    return this.http.get<ApiResponsePaginated<UserMemberInvitationDTO[]|string>>(this.apiAddress+"/", {
      params: {
        ...query
      }
    })
  }

  getManagerPendingInvitation(query: UserManagerInvitationQuery){
    return this.http.get<ApiResponsePaginated<UserManagerInvitationDTO[]|string>>(this.apiAddress+"/managers", {
      params: {
        ...query
      }
    })
  }

  getOwnMembersPendingInviation(query: UserMemberInvitationQuery){
    return this.http.get<ApiResponsePaginated<UserMemberInvitationDTO[]|string>>(this.apiAddress+"/own", {
      params: {
        ...query
      }
    })
  }

  getOwnManagerPendingInvitation(query: UserManagerInvitationQuery){
    return this.http.get<ApiResponsePaginated<UserManagerInvitationDTO[]|string>>(this.apiAddress+"/own/managers", {
      params: {
        ...query
      }
    })
  }

  inviteUserToBecomeMember(invitation: InviteUser){
    return this.http.post<ApiResponse<string>>(this.apiAddress+"/member", invitation);
  }

  inviteUserToBecomeManager(invitation: InviteUser){
    return this.http.post<ApiResponse<string>>(this.apiAddress+"/manager", invitation);
  }

  acceptInvitationMember(accept_invitation: AcceptInvitationDTO){
    return this.http.post<ApiResponse<string>>(this.apiAddress+"/accept", accept_invitation)
  }

  acceptInvitationMemberEncoded(accept_invitation: AcceptInvitationWEncodedDTO){
    return this.http.post<ApiResponse<string>>(this.apiAddress+"/accept/encoded", accept_invitation)
  }

  acceptInvitationManager(accept_invitation: AcceptInvitationDTO){
    return this.http.post<ApiResponse<string>>(this.apiAddress+"/accept/manager", accept_invitation)
  }

  cancelMemberInvitation(id_invitation: number){
    return this.http.delete<ApiResponse<string>>(this.apiAddress+`/${id_invitation}/member`);
  }
  cancelManagerInvitation(id_invitation: number){
    return this.http.delete<ApiResponse<string>>(this.apiAddress+`/${id_invitation}/manager`);
  }

  refuseMemberInvitation(id_invitation: number){
    return this.http.delete<ApiResponse<string>>(this.apiAddress+`/${id_invitation}/own/member`);
  }
  refuseManagerInvitation(id_invitation: number){
    return this.http.delete<ApiResponse<string>>(this.apiAddress+`/${id_invitation}/own/manager`);
  }
}
