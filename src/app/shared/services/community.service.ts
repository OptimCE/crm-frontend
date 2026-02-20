import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
import {Observable} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CommunityService {
  private http = inject(HttpClient);
  private apiAddress: string;

  constructor() {
    this.apiAddress = environments.apiUrl + '/communities';
  }

  getMyCommunities(query: CommunityQueryDTO): Observable<ApiResponsePaginated<MyCommunityDTO[] | string>> {
    return this.http.get<ApiResponsePaginated<MyCommunityDTO[] | string>>(
      this.apiAddress + '/my-communities',
      {
        params: {
          ...query,
        },
      },
    );
  }

  getUsers(query: CommunityUsersQueryDTO): Observable<ApiResponsePaginated<UsersCommunityDTO[] |string>> {
    return this.http.get<ApiResponsePaginated<UsersCommunityDTO[] | string>>(
      this.apiAddress + '/users',
      {
        params: {
          ...query,
        },
      },
    );
  }
  getAdmins(query: CommunityUsersQueryDTO): Observable<ApiResponsePaginated<UsersCommunityDTO[] | string>> {
    return this.http.get<ApiResponsePaginated<UsersCommunityDTO[] | string>>(
      this.apiAddress + '/admins',
      {
        params: {
          ...query,
        },
      },
    );
  }

  createCommunity(created_community: CreateCommunityDTO): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(this.apiAddress + '/', created_community);
  }

  updateCommunity(updated_community: CreateCommunityDTO): Observable<ApiResponse<string>> {
    return this.http.put<ApiResponse<string>>(this.apiAddress + '/', updated_community);
  }

  patchRoleUser(patched_role_user: PatchRoleUserDTO): Observable<ApiResponse<string>> {
    return this.http.patch<ApiResponse<string>>(this.apiAddress + '/', patched_role_user);
  }

  leave(id_community: number): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(this.apiAddress + `/leave/${id_community}`);
  }

  kick(id_user: number): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(this.apiAddress + `/kick/${id_user}`);
  }

  deleteCommunity(id_community: number): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(this.apiAddress + `/delete/${id_community}`);
  }
}
