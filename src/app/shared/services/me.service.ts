import { Injectable } from '@angular/core';
import { environments } from '../../../environments/environments';
import { ApiResponse, ApiResponsePaginated } from '../../core/dtos/api.response';
import { Observable, tap } from 'rxjs';
import { ServiceBase } from './service.base';
import {
  MeAllocationSharesDTO,
  MeAllocationSharesQuery,
  MeCompanyDTO,
  MeDocumentDTO,
  MeEnergySummaryDTO,
  MeEnergySummaryQuery,
  MeDocumentPartialQuery,
  MeIndividualDTO,
  MeMemberPartialQuery,
  MeMembersPartialDTO,
  MeMeterDTO,
  MeMetersPartialQuery,
  MePartialMeterDTO,
} from '../dtos/me.dtos';
import {
  AcceptInvitationDTO,
  AcceptInvitationWEncodedDTO,
  UserManagerInvitationDTO,
  UserManagerInvitationQuery,
  UserMemberInvitationDTO,
  UserMemberInvitationQuery,
} from '../dtos/invitation.dtos';
import { CompanyDTO, IndividualDTO } from '../dtos/member.dtos';
import { DownloadDocument } from '../dtos/document.dtos';
import { MeterConsumptionDTO, MeterConsumptionQuery } from '../dtos/meter.dtos';
import { defineTTL } from '../../core/services/cache/cache.helper';

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

  getDocumentById(id: number): Observable<ApiResponse<DownloadDocument>> {
    return this.http.get<ApiResponse<DownloadDocument>>(this.apiAddress + `/documents/${id}`);
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

  getMeterConsumptions(
    id: string,
    query: MeterConsumptionQuery,
  ): Observable<ApiResponse<MeterConsumptionDTO | string>> {
    return this.cachedGet<ApiResponse<MeterConsumptionDTO | string>>(
      `me:meter-consumptions:${id}/${JSON.stringify(query)}`,
      this.apiAddress + `/meters/${id}/consumptions`,
      query,
    );
  }

  /**
   * `GET /me/allocation-shares` — the caller's own key fraction per operation.
   *
   * Cross-community and `idChecker`-only, so the cache key deliberately carries
   * no community: one response covers every community the user is a member of,
   * and the caller filters. Two minutes rather than the five-minute default —
   * this feeds a dashboard tile.
   */
  /**
   * Consumption totals for one calendar month, across every community.
   *
   * Keyed WITHOUT the community, like `getAllocationShares`: the endpoint is
   * cross-community and answers with no `X-Community-ID` at all, which is what
   * the user dashboard needs before a community has been picked.
   */
  getEnergySummary(
    query: MeEnergySummaryQuery = {},
  ): Observable<ApiResponse<MeEnergySummaryDTO | string>> {
    return this.cachedGet<ApiResponse<MeEnergySummaryDTO | string>>(
      `me:energy-summary:${JSON.stringify(query)}`,
      this.apiAddress + '/energy-summary',
      query,
      defineTTL(2),
    );
  }

  getAllocationShares(
    query: MeAllocationSharesQuery = {},
  ): Observable<ApiResponse<MeAllocationSharesDTO | string>> {
    return this.cachedGet<ApiResponse<MeAllocationSharesDTO | string>>(
      `me:allocation-shares:${JSON.stringify(query)}`,
      this.apiAddress + '/allocation-shares',
      query,
      defineTTL(2),
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
