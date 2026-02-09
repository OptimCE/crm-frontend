import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {environments} from '../../../environments/environments';
import {ApiResponse, ApiResponsePaginated} from '../../core/dtos/api.response';
import {UpdateUserDTO, UserDTO} from '../dtos/user.dtos';
import {
  CommunityQueryDTO,
  CommunityUsersQueryDTO,
  CreateCommunityDTO,
  MyCommunityDTO, PatchRoleUserDTO,
  UsersCommunityDTO
} from '../dtos/community.dtos';

@Injectable({
  providedIn: 'root',
})
export class CommunityService {
  private apiAddress: string;

  constructor(private http: HttpClient) {
    this.apiAddress = environments.apiUrl + '/communities';
  }

  getMyCommunities(query: CommunityQueryDTO) {
    return this.http.get<ApiResponsePaginated<MyCommunityDTO[]|string>>(this.apiAddress + '/my-communities',{
      params:{
        ...query
      }
    });
  }

  getUsers(query: CommunityUsersQueryDTO) {
    return this.http.get<ApiResponsePaginated<UsersCommunityDTO[]|string>>(this.apiAddress + '/users',{
      params:{
        ...query
      }
    });
  }
  getAdmins(query: CommunityUsersQueryDTO) {
    return this.http.get<ApiResponsePaginated<UsersCommunityDTO[]|string>>(this.apiAddress + '/admins',{
      params:{
        ...query
      }
    });
  }

  createCommunity(created_community: CreateCommunityDTO){
    return this.http.post<ApiResponse<string>>(this.apiAddress + '/',created_community)
  }

  updateCommunity(updated_community: CreateCommunityDTO){
    return this.http.put<ApiResponse<string>>(this.apiAddress + '/',updated_community)
  }

  patchRoleUser(patched_role_user: PatchRoleUserDTO){
    return this.http.patch<ApiResponse<string>>(this.apiAddress + '/',patched_role_user)
  }

  leave(id_community: number){
    return this.http.delete<ApiResponse<string>>(this.apiAddress + `/leave/${id_community}`);
  }

  kick(id_user:number){
    return this.http.delete<ApiResponse<string>>(this.apiAddress + `/kick/${id_user}`);
  }

  deleteCommunity(id_community: number){
    return this.http.delete<ApiResponse<string>>(this.apiAddress + `/delete/${id_community}`);
  }
}
