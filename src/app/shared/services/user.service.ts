import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environments } from '../../../environments/environments';
import { ApiResponse } from '../../core/dtos/api.response';
import { UpdateUserDTO, UserDTO } from '../dtos/user.dtos';
import {Observable} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private http = inject(HttpClient);
  private apiAddress: string;

  constructor() {
    this.apiAddress = environments.apiUrl + '/users';
  }

  getUserInfo(): Observable<ApiResponse<UserDTO|string>> {
    return this.http.get<ApiResponse<UserDTO | string>>(this.apiAddress + '/');
  }

  updateUserInfo(update_user: UpdateUserDTO): Observable<ApiResponse<string>> {
    return this.http.put<ApiResponse<string>>(this.apiAddress + '/', update_user);
  }
}
