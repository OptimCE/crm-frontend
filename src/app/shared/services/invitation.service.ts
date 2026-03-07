import { Injectable } from '@angular/core';
import { environments } from '../../../environments/environments';
import { ApiResponse, ApiResponsePaginated } from '../../core/dtos/api.response';
import {
  InviteUser,
  UserManagerInvitationDTO,
  UserManagerInvitationQuery,
  UserMemberInvitationDTO,
  UserMemberInvitationQuery,
} from '../dtos/invitation.dtos';
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
  }

  getManagerPendingInvitation(
    query: UserManagerInvitationQuery,
  ): Observable<ApiResponsePaginated<UserManagerInvitationDTO[] | string>> {
    return this.cachedGet<ApiResponsePaginated<UserManagerInvitationDTO[] | string>>(
      `managers-invitation:${JSON.stringify(query)}`,
      this.apiAddress + '/managers',
      query,
    );
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
}
