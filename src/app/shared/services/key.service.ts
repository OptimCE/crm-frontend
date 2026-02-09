import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {environments} from '../../../environments/environments';
import {ApiResponse, ApiResponsePaginated} from '../../core/dtos/api.response';
import {CreateKeyDTO, KeyDTO, KeyPartialDTO, KeyPartialQuery, UpdateKeyDTO} from '../dtos/key.dtos';
import {Observable} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class KeyService {
  private apiAddress: string;

  constructor(private http: HttpClient) {
    this.apiAddress = environments.apiUrl + '/keys';
  }

  getKeysList(query: KeyPartialQuery): Observable<ApiResponsePaginated<KeyPartialDTO[]|string>>{
    return this.http.get<ApiResponsePaginated<KeyPartialDTO[]|string>>(this.apiAddress + '/', {
      params: {...query},
    });
  }

  getKey(id: number): Observable<ApiResponse<KeyDTO|string>>{
    return this.http.get<ApiResponse<KeyDTO|string>>(this.apiAddress + '/' + id);
  }

  downloadKey(id: number): Observable<ApiResponse<KeyDTO|string>>{
    return this.http.get<ApiResponse<KeyDTO|string>>(this.apiAddress + '/' + id);
  }

  addKey(create_key: CreateKeyDTO): Observable<ApiResponse<string>>{
    return this.http.post<ApiResponse<string>>(this.apiAddress + '/', create_key);
  }

  updateKey(update_key: UpdateKeyDTO): Observable<ApiResponse<string>>{
    return this.http.put<ApiResponse<string>>(this.apiAddress + '/', update_key);
  }

  deleteKey(id: number): Observable<ApiResponse<string>>{
    return this.http.delete<ApiResponse<string>>(this.apiAddress + '/' + id);
  }
}
