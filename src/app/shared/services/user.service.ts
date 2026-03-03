import { Injectable } from '@angular/core';
import { environments } from '../../../environments/environments';
import { ApiResponse } from '../../core/dtos/api.response';
import { UpdateUserDTO, UserDTO } from '../dtos/user.dtos';
import { Observable, tap } from 'rxjs';
import { ServiceBase } from './service.base';

@Injectable({
  providedIn: 'root',
})
export class UserService extends ServiceBase {
  private readonly apiAddress: string;

  constructor() {
    super();
    this.apiAddress = environments.apiUrl + '/users';
  }

  getUserInfo(): Observable<ApiResponse<UserDTO | string>> {
    return this.cachedGet<ApiResponse<UserDTO | string>>('users', this.apiAddress + '/');
    // return this.http.get<ApiResponse<UserDTO | string>>(this.apiAddress + '/');
  }

  updateUserInfo(update_user: UpdateUserDTO): Observable<ApiResponse<string>> {
    return this.http.put<ApiResponse<string>>(this.apiAddress + '/', update_user).pipe(
      tap(() => {
        this.cache.invalidate('users');
      }),
    );
  }
}
