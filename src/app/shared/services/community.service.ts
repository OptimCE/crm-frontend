import { Injectable } from '@angular/core';
import { environments } from '../../../environments/environments';
import { ApiResponse, ApiResponsePaginated } from '../../core/dtos/api.response';
import {
  CommunityQueryDTO,
  CommunityUsersQueryDTO,
  CreateCommunityDTO,
  MyCommunityDTO,
  PatchRoleUserDTO,
  UsersCommunityDTO,
} from '../dtos/community.dtos';
import { Observable, tap } from 'rxjs';
import { ServiceBase } from './service.base';

@Injectable({
  providedIn: 'root',
})
export class CommunityService extends ServiceBase {
  private readonly apiAddress: string;

  constructor() {
    super();
    this.apiAddress = environments.apiUrl + '/communities';
  }

  getMyCommunities(
    query: CommunityQueryDTO,
  ): Observable<ApiResponsePaginated<MyCommunityDTO[] | string>> {
    return this.cachedGet<ApiResponsePaginated<MyCommunityDTO[] | string>>(
      `communities-own:${JSON.stringify(query)}`,
      this.apiAddress + '/my-communities',
      query,
    );
  }

  getUsers(
    query: CommunityUsersQueryDTO,
  ): Observable<ApiResponsePaginated<UsersCommunityDTO[] | string>> {
    return this.cachedGet<ApiResponsePaginated<UsersCommunityDTO[] | string>>(
      `communities-user:${JSON.stringify(query)}`,
      this.apiAddress + '/users',
      query,
    );
  }
  getAdmins(
    query: CommunityUsersQueryDTO,
  ): Observable<ApiResponsePaginated<UsersCommunityDTO[] | string>> {
    return this.cachedGet<ApiResponsePaginated<UsersCommunityDTO[] | string>>(
      `communities-admin:${JSON.stringify(query)}`,
      this.apiAddress + '/admins',
      query,
    );
  }

  createCommunity(created_community: CreateCommunityDTO): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(this.apiAddress + '/', created_community).pipe(
      tap(() => {
        this.cache.invalidate('communities');
      }),
    );
  }

  updateCommunity(updated_community: CreateCommunityDTO): Observable<ApiResponse<string>> {
    return this.http.put<ApiResponse<string>>(this.apiAddress + '/', updated_community).pipe(
      tap(() => {
        this.cache.invalidate('communities');
      }),
    );
  }

  patchRoleUser(patched_role_user: PatchRoleUserDTO): Observable<ApiResponse<string>> {
    return this.http.patch<ApiResponse<string>>(this.apiAddress + '/', patched_role_user).pipe(
      tap(() => {
        this.cache.invalidate('communities');
      }),
    );
  }

  leave(id_community: number): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(this.apiAddress + `/leave/${id_community}`).pipe(
      tap(() => {
        this.cache.invalidate('communities');
      }),
    );
  }

  kick(id_user: number): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(this.apiAddress + `/kick/${id_user}`).pipe(
      tap(() => {
        this.cache.invalidate('communities');
      }),
    );
  }

  deleteCommunity(id_community: number): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(this.apiAddress + `/delete/${id_community}`).pipe(
      tap(() => {
        this.cache.invalidate('communities');
      }),
    );
  }
}
