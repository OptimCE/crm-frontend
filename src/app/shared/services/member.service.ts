import { Injectable } from '@angular/core';
import { environments } from '../../../environments/environments';
import {
  CompanyDTO,
  CreateMemberDTO,
  IndividualDTO,
  MemberLinkDTO,
  MemberLinkQueryDTO,
  MemberPartialQuery,
  MembersPartialDTO,
  PatchMemberInviteUserDTO,
  PatchMemberStatusDTO,
  UpdateMemberDTO,
} from '../dtos/member.dtos';
import { ApiResponse, ApiResponsePaginated } from '../../core/dtos/api.response';
import { Observable, tap } from 'rxjs';
import { ServiceBase } from './service.base';

@Injectable({
  providedIn: 'root',
})
export class MemberService extends ServiceBase {
  private readonly apiAddress: string;

  constructor() {
    super();
    this.apiAddress = environments.apiUrl + '/members';
  }

  // private toHttpParams(obj: Record<string, unknown>): Record<string, string | number | boolean> {
  //   const params: Record<string, string | number | boolean> = {};
  //   for (const [key, value] of Object.entries(obj)) {
  //     if (value !== undefined && value !== null) {
  //       params[key] = value as string | number | boolean;
  //     }
  //   }
  //   return params;
  // }

  getMembersList(
    query: MemberPartialQuery,
  ): Observable<ApiResponsePaginated<MembersPartialDTO[] | string>> {
    return this.cachedGet<ApiResponsePaginated<MembersPartialDTO[] | string>>(
      `members-list:${JSON.stringify(query)}`,
      this.apiAddress + '/',
      query,
    );
    // return this.http.get<ApiResponsePaginated<MembersPartialDTO[] | string>>(
    //   this.apiAddress + '/',
    //   {
    //     params: this.toHttpParams(query as unknown as Record<string, unknown>),
    //   },
    // );
  }

  getMember(id_member: number): Observable<ApiResponse<IndividualDTO | CompanyDTO | string>> {
    return this.cachedGet<ApiResponse<IndividualDTO | CompanyDTO | string>>(
      `members:${id_member}`,
      this.apiAddress + `/${id_member}`,
    );
    // return this.http.get<ApiResponse<IndividualDTO | CompanyDTO | string>>(
    //   this.apiAddress + '/' + id_member,
    // );
  }

  getMemberLink(
    id_member: number,
    query: MemberLinkQueryDTO,
  ): Observable<ApiResponse<MemberLinkDTO | string>> {
    return this.cachedGet<ApiResponse<MemberLinkDTO | string>>(
      `members-link:${id_member}/${JSON.stringify(query)}`,
      this.apiAddress + `/${id_member}/link`,
      query,
    );
    // return this.http.get<ApiResponse<MemberLinkDTO | string>>(
    //   this.apiAddress + '/' + id_member + '/link',
    //   {
    //     params: this.toHttpParams(query as unknown as Record<string, unknown>),
    //   },
    // );
  }

  addMember(create_member: CreateMemberDTO): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(this.apiAddress + '/', create_member).pipe(
      tap(() => {
        this.cache.invalidate('members-list');
      }),
    );
  }

  updateMember(update_member: UpdateMemberDTO): Observable<ApiResponse<string>> {
    return this.http.put<ApiResponse<string>>(this.apiAddress + '/', update_member).pipe(
      tap(() => {
        this.cache.invalidate('members-list');
        this.cache.invalidate(`members:${update_member.id}`);
      }),
    );
  }

  patchMemberStatus(patch_member_status: PatchMemberStatusDTO): Observable<ApiResponse<string>> {
    return this.http
      .patch<ApiResponse<string>>(this.apiAddress + '/status', patch_member_status)
      .pipe(
        tap(() => {
          this.cache.invalidate('members-list');
          this.cache.invalidate(`members:${patch_member_status.id_member}`);
        }),
      );
  }

  patchMemberLink(
    patch_member_invite_user: PatchMemberInviteUserDTO,
  ): Observable<ApiResponse<string>> {
    return this.http
      .patch<ApiResponse<string>>(this.apiAddress + '/invite', patch_member_invite_user)
      .pipe(
        tap(() => {
          this.cache.invalidate('members-link');
          this.cache.invalidate(`members:${patch_member_invite_user.id_member}`);
        }),
      );
  }

  deleteMember(id_member: number): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(this.apiAddress + '/' + id_member).pipe(
      tap(() => {
        this.cache.invalidate('members');
      }),
    );
  }

  deleteMemberLink(id_member: number): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(this.apiAddress + '/' + id_member + '/link').pipe(
      tap(() => {
        this.cache.invalidate('members');
      }),
    );
  }
}
