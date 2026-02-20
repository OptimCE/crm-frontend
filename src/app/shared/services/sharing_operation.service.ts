import { inject, Injectable } from '@angular/core';
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
  SharingOperationKeyDTO,
  SharingOperationMetersQuery,
  SharingOperationPartialDTO,
  SharingOperationPartialQuery,
} from '../dtos/sharing_operation.dtos';
import { from, map, Observable, switchMap } from 'rxjs';
import { ApiResponse, ApiResponsePaginated } from '../../core/dtos/api.response';
import { PartialMeterDTO } from '../dtos/meter.dtos';
import { KeyPartialQuery } from '../dtos/key.dtos';

@Injectable({
  providedIn: 'root',
})
export class SharingOperationService {
  private http = inject(HttpClient);
  private apiAddress: string;

  constructor() {
    this.apiAddress = environments.apiUrl + '/sharing_operations';
  }

  private toHttpParams(obj: Record<string, unknown>): Record<string, string | number | boolean> {
    const params: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null) {
        params[key] = value as string | number | boolean;
      }
    }
    return params;
  }

  getSharingOperationList(
    query: SharingOperationPartialQuery,
  ): Observable<ApiResponsePaginated<SharingOperationPartialDTO[] | string>> {
    return this.http.get<ApiResponsePaginated<SharingOperationPartialDTO[] | string>>(
      this.apiAddress + '/',
      {
        params: this.toHttpParams(query as unknown as Record<string, unknown>),
      },
    );
  }

  getSharingOperation(id: number): Observable<ApiResponse<SharingOperationDTO | string>> {
    return this.http.get<ApiResponse<SharingOperationDTO | string>>(this.apiAddress + '/' + id);
  }

  getSharingOperationMetersList(
    id: number,
    query: SharingOperationMetersQuery,
  ): Observable<ApiResponsePaginated<PartialMeterDTO[] | string>> {
    return this.http.get<ApiResponsePaginated<PartialMeterDTO[] | string>>(
      this.apiAddress + '/' + id + '/meters',
      {
        params: this.toHttpParams(query as unknown as Record<string, unknown>),
      },
    );
  }

  getSharingOperationKeysList(
    id: number,
    query: KeyPartialQuery,
  ): Observable<ApiResponsePaginated<SharingOperationKeyDTO[] | string>> {
    return this.http.get<ApiResponsePaginated<SharingOperationKeyDTO[] | string>>(
      this.apiAddress + '/' + id + '/keys',
      {
        params: this.toHttpParams(query as unknown as Record<string, unknown>),
      },
    );
  }

  getSharingOperationConsumptions(
    id: number,
    query: SharingOperationConsumptionQuery,
  ): Observable<ApiResponse<SharingOpConsumptionDTO | string>> {
    return this.http.get<ApiResponse<SharingOpConsumptionDTO | string>>(
      this.apiAddress + '/' + id + '/consumptions',
      {
        params: this.toHttpParams(query as unknown as Record<string, unknown>),
      },
    );
  }

  downloadSharingOperationConsumptions(
    id: number,
    query: SharingOperationConsumptionQuery,
  ): Observable<ApiResponse<string> | { blob: Blob; filename: string }> {
    return this.http
      .get(this.apiAddress + '/' + id + '/consumptions/download', {
        observe: 'response', // Gives us access to headers
        responseType: 'blob',
        params: this.toHttpParams(query as unknown as Record<string, unknown>),
      })
      .pipe(
        switchMap((response) => {
          const blob = response.body as Blob;

          if (blob.type === 'application/json') {
            return from(blob.text()).pipe(map((text) => JSON.parse(text) as ApiResponse<string>));
          }

          // Extract filename from Content-Disposition
          const contentDisposition = response.headers.get('content-disposition');
          let filename = 'cle_repartition.xlsx'; // Default
          if (contentDisposition) {
            const match = contentDisposition.match(/filename="(.+)"/);
            if (match && match[1]) {
              filename = match[1];
            }
          }

          return [{ blob, filename }];
        }),
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
