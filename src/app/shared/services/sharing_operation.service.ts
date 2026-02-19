import {inject, Injectable} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environments } from '../../../environments/environments';
import {
  AddConsumptionDataDTO,
  AddKeyToSharingOperationDTO,
  AddMeterToSharingOperationDTO,
  CreateSharingOperationDTO,
  PatchKeyToSharingOperationDTO,
  PatchMeterToSharingOperationDTO,
  RemoveMeterFromSharingOperationDTO,
  SharingOpConsumptionDTO,
  SharingOperationConsumptionQuery,
  SharingOperationDTO,
  SharingOperationPartialDTO,
  SharingOperationPartialQuery,
} from '../dtos/sharing_operation.dtos';
import { Observable } from 'rxjs';
import { ApiResponse, ApiResponsePaginated } from '../../core/dtos/api.response';

@Injectable({
  providedIn: 'root',
})
export class SharingOperationService {
  private http = inject(HttpClient)
  private apiAddress: string;

  constructor() {
    this.apiAddress = environments.apiUrl + '/sharing_operations';
  }

  getSharingOperationList(
    query: SharingOperationPartialQuery,
  ): Observable<ApiResponsePaginated<SharingOperationPartialDTO[] | string>> {
    return this.http.get<ApiResponsePaginated<SharingOperationPartialDTO[] | string>>(
      this.apiAddress + '/',
      {
        params: { ...query },
      },
    );
  }

  getSharingOperation(id: number): Observable<ApiResponse<SharingOperationDTO | string>> {
    return this.http.get<ApiResponse<SharingOperationDTO | string>>(this.apiAddress + '/' + id);
  }

  getSharingOperationConsumptions(
    id: number,
    query: SharingOperationConsumptionQuery,
  ): Observable<ApiResponse<SharingOpConsumptionDTO | string>> {
    return this.http.get<ApiResponse<SharingOpConsumptionDTO | string>>(
      this.apiAddress + '/' + id + '/consumptions',
      {
        params: { ...query },
      },
    );
  }

  downloadSharingOperationConsumptions(
    id: number,
    query: SharingOperationConsumptionQuery,
  ): Observable<ApiResponse<any | string>> {
    return this.http.get<ApiResponse<any | string>>(
      this.apiAddress + '/' + id + '/consumptions/download',
      {
        params: { ...query },
      },
    );
  }

  createSharingOperation(
    new_sharing_operations: CreateSharingOperationDTO,
  ): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(this.apiAddress + '/', new_sharing_operations);
  }

  addKeyToSharing(
    new_key_to_operation: AddKeyToSharingOperationDTO,
  ): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(this.apiAddress + '/key', new_key_to_operation);
  }

  addMeterToSharing(
    new_meters_to_operation: AddMeterToSharingOperationDTO,
  ): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(this.apiAddress + '/meter', new_meters_to_operation);
  }

  addConsumptionDataToSharing(
    upload_consumption_data: AddConsumptionDataDTO,
  ): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(
      this.apiAddress + '/consumptions',
      upload_consumption_data,
    );
  }

  patchKeyStatus(
    patched_key_status: PatchKeyToSharingOperationDTO,
  ): Observable<ApiResponse<string>> {
    return this.http.patch<ApiResponse<string>>(this.apiAddress + '/key', patched_key_status);
  }

  patchMeterStatus(
    patched_meter_status: PatchMeterToSharingOperationDTO,
  ): Observable<ApiResponse<string>> {
    return this.http.patch<ApiResponse<string>>(this.apiAddress + '/meter', patched_meter_status);
  }

  deleteSharingOperation(id: number): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(this.apiAddress + '/' + id);
  }

  deleteMeterFromSharingOperation(
    id: number,
    removed_meter_status: RemoveMeterFromSharingOperationDTO,
  ): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(this.apiAddress + '/' + id + '/meter', {
      body: removed_meter_status,
    });
  }
}
