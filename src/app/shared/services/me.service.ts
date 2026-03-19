import { Injectable } from '@angular/core';
import { environments } from '../../../environments/environments';
import { ApiResponse, ApiResponsePaginated } from '../../core/dtos/api.response';
import { catchError, map, Observable, tap } from 'rxjs';
import { ServiceBase } from './service.base';
import {
  MeCompanyDTO,
  MeDocumentDTO,
  MeDocumentPartialQuery,
  MeIndividualDTO,
  MeMemberPartialQuery,
  MeMembersPartialDTO,
  MeMeterDTO,
  MeMetersPartialQuery,
  MePartialMeterDTO,
} from '../dtos/me.dtos';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AcceptInvitationDTO,
  AcceptInvitationWEncodedDTO,
  UserManagerInvitationDTO,
  UserManagerInvitationQuery,
  UserMemberInvitationDTO,
  UserMemberInvitationQuery,
} from '../dtos/invitation.dtos';
import { CompanyDTO, IndividualDTO } from '../dtos/member.dtos';

@Injectable({
  providedIn: 'root',
})
export class MeService extends ServiceBase {
  private readonly apiAddress: string;

  constructor() {
    super();
    this.apiAddress = environments.apiUrl + '/me';
  }

  getDocuments(
    query: MeDocumentPartialQuery,
  ): Observable<ApiResponsePaginated<MeDocumentDTO[] | string>> {
    return this.cachedGet<ApiResponsePaginated<MeDocumentDTO[] | string>>(
      `me:documents:${JSON.stringify(query)}`,
      this.apiAddress + '/documents',
      query,
    );
  }

  getDocumentById(id: number): Observable<{ blob: Blob; filename: string }> {
    return this.http
      .get(this.apiAddress + `/documents/${id}`, {
        observe: 'response',
        responseType: 'blob',
      })
      .pipe(
        map((response) => {
          const blob = response.body as Blob;

          const contentDisposition = response.headers.get('content-disposition');
          let filename = 'document.';
          if (contentDisposition) {
            const match = contentDisposition.match(/filename="(.+)"/);
            if (match?.[1]) {
              filename = match[1];
            }
          }

          return { blob, filename };
        }),
        catchError((error: HttpErrorResponse) => this.blobErrorHandler(error)),
      );
  }

  getMembers(
    query: MeMemberPartialQuery,
  ): Observable<ApiResponsePaginated<MeMembersPartialDTO[] | string>> {
    return this.cachedGet<ApiResponsePaginated<MeMembersPartialDTO[] | string>>(
      `me:members:${JSON.stringify(query)}`,
      this.apiAddress + '/members',
      query,
    );
  }

  getMemberById(id: number): Observable<ApiResponse<MeIndividualDTO | MeCompanyDTO | string>> {
    return this.cachedGet<ApiResponse<MeIndividualDTO | MeCompanyDTO | string>>(
      `me:member:${id}`,
      this.apiAddress + `/members/${id}`,
    );
  }

  getMeters(
    query: MeMetersPartialQuery,
  ): Observable<ApiResponsePaginated<MePartialMeterDTO[] | string>> {
    return this.cachedGet<ApiResponsePaginated<MePartialMeterDTO[] | string>>(
      `me:meters:${JSON.stringify(query)}`,
      this.apiAddress + '/meters',
      query,
    );
  }

  getMetersById(id: string): Observable<ApiResponse<MeMeterDTO | string>> {
    return this.cachedGet<ApiResponse<MeMeterDTO | string>>(
      `me:meter:${id}`,
      this.apiAddress + `/meters/${id}`,
    );
  }

  getOwnMembersPendingInviation(
    query: UserMemberInvitationQuery,
  ): Observable<ApiResponsePaginated<UserMemberInvitationDTO[] | string>> {
    return this.cachedGet<ApiResponsePaginated<UserMemberInvitationDTO[] | string>>(
      `own-members-invitation:${JSON.stringify(query)}`,
      this.apiAddress + '/invitations',
      query,
    );
  }

  getOwnMemberPendingInvitationById(
    id: number,
  ): Observable<ApiResponse<IndividualDTO | CompanyDTO | string>> {
    return this.cachedGet<ApiResponse<IndividualDTO | CompanyDTO | string>>(
      `own-members-invitation-id:${id}`,
      this.apiAddress + `/invitations/members/${id}`,
    );
  }

  getOwnManagerPendingInvitation(
    query: UserManagerInvitationQuery,
  ): Observable<ApiResponsePaginated<UserManagerInvitationDTO[] | string>> {
    return this.cachedGet<ApiResponsePaginated<UserManagerInvitationDTO[] | string>>(
      `own-managers-invitation:${JSON.stringify(query)}`,
      this.apiAddress + '/invitations/managers',
      query,
    );
  }

  refuseMemberInvitation(id_invitation: number): Observable<ApiResponse<string>> {
    return this.http
      .delete<ApiResponse<string>>(this.apiAddress + `/invitations/${id_invitation}/member`)
      .pipe(
        tap(() => {
          this.cache.invalidate('own-members-invitation');
        }),
      );
  }
  refuseManagerInvitation(id_invitation: number): Observable<ApiResponse<string>> {
    return this.http
      .delete<ApiResponse<string>>(this.apiAddress + `/invitations/${id_invitation}/manager`)
      .pipe(
        tap(() => {
          this.cache.invalidate('own-managers-invitation');
        }),
      );
  }

  acceptInvitationMember(accept_invitation: AcceptInvitationDTO): Observable<ApiResponse<string>> {
    return this.http
      .post<ApiResponse<string>>(this.apiAddress + '/invitations/accept', accept_invitation)
      .pipe(
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
      .post<ApiResponse<string>>(this.apiAddress + '/invitations/accept/encoded', accept_invitation)
      .pipe(
        tap(() => {
          this.cache.invalidate('own-members-invitation');
          this.cache.invalidate('members-invitation');
        }),
      );
  }

  acceptInvitationManager(accept_invitation: AcceptInvitationDTO): Observable<ApiResponse<string>> {
    return this.http
      .post<ApiResponse<string>>(this.apiAddress + '/invitations/accept/manager', accept_invitation)
      .pipe(
        tap(() => {
          this.cache.invalidate('own-managers-invitation');
          this.cache.invalidate('managers-invitation');
        }),
      );
  }
}
