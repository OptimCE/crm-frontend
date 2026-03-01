import { Injectable } from '@angular/core';
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
import { Observable, tap } from 'rxjs';
import { ServiceBase } from './service.base';

@Injectable({
  providedIn: 'root',
})
export class InvitationService extends ServiceBase {
  private readonly apiAddress: string;

  constructor() {
    super();
    this.apiAddress = environments.apiUrl + '/invitations';
  }

  private toHttpParams(obj: Record<string, unknown>): Record<string, string | number | boolean> {
    const params: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null) {
        params[key] = value as string | number | boolean;
      }
    }
    return params;
  }

  getMembersPendingInviation(
    query: UserMemberInvitationQuery,
  ): Observable<ApiResponsePaginated<UserMemberInvitationDTO[] | string>> {
    return this.cachedGet<ApiResponsePaginated<UserMemberInvitationDTO[] | string>>(
      `members-invitation:${JSON.stringify(query)}`,
      this.apiAddress + '/',
      query,
    );
    // return this.http.get<ApiResponsePaginated<UserMemberInvitationDTO[] | string>>(
    //   this.apiAddress + '/',
    //   {
    //     params: this.toHttpParams(query as unknown as Record<string, unknown>),
    //   },
    // );
  }

  getManagerPendingInvitation(
    query: UserManagerInvitationQuery,
  ): Observable<ApiResponsePaginated<UserManagerInvitationDTO[] | string>> {
    return this.cachedGet<ApiResponsePaginated<UserManagerInvitationDTO[] | string>>(
      `managers-invitation:${JSON.stringify(query)}`,
      this.apiAddress + '/managers',
      query,
    );
    // return this.http.get<ApiResponsePaginated<UserManagerInvitationDTO[] | string>>(
    //   this.apiAddress + '/managers',
    //   {
    //     params: this.toHttpParams(query as unknown as Record<string, unknown>),
    //   },
    // );
  }

  getOwnMembersPendingInviation(
    query: UserMemberInvitationQuery,
  ): Observable<ApiResponsePaginated<UserMemberInvitationDTO[] | string>> {
    return this.cachedGet<ApiResponsePaginated<UserMemberInvitationDTO[] | string>>(
      `own-members-invitation:${JSON.stringify(query)}`,
      this.apiAddress + '/own',
      query,
    );
    // return this.http.get<ApiResponsePaginated<UserMemberInvitationDTO[] | string>>(
    //   this.apiAddress + '/own',
    //   {
    //     params: this.toHttpParams(query as unknown as Record<string, unknown>),
    //   },
    // );
  }

  getOwnMemberPendingInvitationById(
    id: number,
  ): Observable<ApiResponse<IndividualDTO | CompanyDTO | string>> {
    return this.cachedGet<ApiResponse<IndividualDTO | CompanyDTO | string>>(
      `own-members-invitation-id:${id}`,
      this.apiAddress + `/own/member/${id}`,
    );
    // return this.http.get<ApiResponse<IndividualDTO | CompanyDTO | string>>(
    //   this.apiAddress + '/own/members/' + id,
    // );
  }

  getOwnManagerPendingInvitation(
    query: UserManagerInvitationQuery,
  ): Observable<ApiResponsePaginated<UserManagerInvitationDTO[] | string>> {
    return this.cachedGet<ApiResponsePaginated<UserManagerInvitationDTO[] | string>>(
      `own-managers-invitation:${JSON.stringify(query)}`,
      this.apiAddress + '/own/managers',
      query,
    );
    // return this.http.get<ApiResponsePaginated<UserManagerInvitationDTO[] | string>>(
    //   this.apiAddress + '/own/managers',
    //   {
    //     params: this.toHttpParams(query as unknown as Record<string, unknown>),
    //   },
    // );
  }

  inviteUserToBecomeMember(invitation: InviteUser): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(this.apiAddress + '/member', invitation).pipe(
      tap(() => {
        this.cache.invalidate('members-invitation');
      }),
    );
  }

  inviteUserToBecomeManager(invitation: InviteUser): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(this.apiAddress + '/manager', invitation).pipe(
      tap(() => {
        this.cache.invalidate('managers-invitation');
      }),
    );
  }

  acceptInvitationMember(accept_invitation: AcceptInvitationDTO): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(this.apiAddress + '/accept', accept_invitation).pipe(
      tap(() => {
        this.cache.invalidate('own-members-invitation');
        this.cache.invalidate('members-invitation');
      }),
    );
  }

  acceptInvitationMemberEncoded(
    accept_invitation: AcceptInvitationWEncodedDTO,
  ): Observable<ApiResponse<string>> {
    return this.http
      .post<ApiResponse<string>>(this.apiAddress + '/accept/encoded', accept_invitation)
      .pipe(
        tap(() => {
          this.cache.invalidate('own-members-invitation');
          this.cache.invalidate('members-invitation');
        }),
      );
  }

  acceptInvitationManager(accept_invitation: AcceptInvitationDTO): Observable<ApiResponse<string>> {
    return this.http
      .post<ApiResponse<string>>(this.apiAddress + '/accept/manager', accept_invitation)
      .pipe(
        tap(() => {
          this.cache.invalidate('own-managers-invitation');
          this.cache.invalidate('managers-invitation');
        }),
      );
  }

  cancelMemberInvitation(id_invitation: number): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(this.apiAddress + `/${id_invitation}/member`).pipe(
      tap(() => {
        this.cache.invalidate('own-members-invitation');
        this.cache.invalidate('members-invitation');
      }),
    );
  }
  cancelManagerInvitation(id_invitation: number): Observable<ApiResponse<string>> {
    return this.http
      .delete<ApiResponse<string>>(this.apiAddress + `/${id_invitation}/manager`)
      .pipe(
        tap(() => {
          this.cache.invalidate('own-managers-invitation');
          this.cache.invalidate('managers-invitation');
        }),
      );
  }

  refuseMemberInvitation(id_invitation: number): Observable<ApiResponse<string>> {
    return this.http
      .delete<ApiResponse<string>>(this.apiAddress + `/${id_invitation}/own/member`)
      .pipe(
        tap(() => {
          this.cache.invalidate('own-members-invitation');
        }),
      );
  }
  refuseManagerInvitation(id_invitation: number): Observable<ApiResponse<string>> {
    return this.http
      .delete<ApiResponse<string>>(this.apiAddress + `/${id_invitation}/own/manager`)
      .pipe(
        tap(() => {
          this.cache.invalidate('own-managers-invitation');
        }),
      );
  }
}
