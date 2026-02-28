import { Injectable } from '@angular/core';
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
import { catchError, map, Observable, tap } from 'rxjs';
import { ApiResponse, ApiResponsePaginated } from '../../core/dtos/api.response';
import { PartialMeterDTO } from '../dtos/meter.dtos';
import { KeyPartialQuery } from '../dtos/key.dtos';
import { ServiceBase } from './service.base';
import { HttpErrorResponse } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class SharingOperationService extends ServiceBase {
  private readonly apiAddress: string;

  constructor() {
    super();
    this.apiAddress = environments.apiUrl + '/sharing_operations';
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

  getSharingOperationList(
    query: SharingOperationPartialQuery,
  ): Observable<ApiResponsePaginated<SharingOperationPartialDTO[] | string>> {
    return this.cachedGet<ApiResponsePaginated<SharingOperationPartialDTO[] | string>>(
      `sharing-operations-list:${JSON.stringify(query)}`,
      this.apiAddress + '/',
      query,
    );
    // return this.http.get<ApiResponsePaginated<SharingOperationPartialDTO[] | string>>(
    //   this.apiAddress + '/',
    //   {
    //     params: this.toHttpParams(query as unknown as Record<string, unknown>),
    //   },
    // );
  }

  getSharingOperation(id: number): Observable<ApiResponse<SharingOperationDTO | string>> {
    return this.cachedGet<ApiResponse<SharingOperationDTO | string>>(
      `sharing-operation:${id}`,
      this.apiAddress + `/${id}`,
    );
    // return this.http.get<ApiResponse<SharingOperationDTO | string>>(this.apiAddress + '/' + id);
  }

  getSharingOperationMetersList(
    id: number,
    query: SharingOperationMetersQuery,
  ): Observable<ApiResponsePaginated<PartialMeterDTO[] | string>> {
    return this.cachedGet<ApiResponsePaginated<PartialMeterDTO[] | string>>(
      `sharing-operation-meters-list:${id}/${JSON.stringify(query)}`,
      this.apiAddress + `/${id}/meters`,
      query,
    );
    // return this.http.get<ApiResponsePaginated<PartialMeterDTO[] | string>>(
    //   this.apiAddress + '/' + id + '/meters',
    //   {
    //     params: this.toHttpParams(query as unknown as Record<string, unknown>),
    //   },
    // );
  }

  getSharingOperationKeysList(
    id: number,
    query: KeyPartialQuery,
  ): Observable<ApiResponsePaginated<SharingOperationKeyDTO[] | string>> {
    return this.cachedGet<ApiResponsePaginated<SharingOperationKeyDTO[] | string>>(
      `sharing-operation-keys:${id}/${JSON.stringify(query)}`,
      this.apiAddress + `/${id}/keys`,
      query,
    );
    // return this.http.get<ApiResponsePaginated<SharingOperationKeyDTO[] | string>>(
    //   this.apiAddress + '/' + id + '/keys',
    //   {
    //     params: this.toHttpParams(query as unknown as Record<string, unknown>),
    //   },
    // );
  }

  getSharingOperationConsumptions(
    id: number,
    query: SharingOperationConsumptionQuery,
  ): Observable<ApiResponse<SharingOpConsumptionDTO | string>> {
    return this.cachedGet<ApiResponse<SharingOpConsumptionDTO | string>>(
      `sharing-operation-consumption:${id}/${JSON.stringify(query)}`,
      this.apiAddress + `/${id}/consumption`,
      query,
    );
    // return this.http.get<ApiResponse<SharingOpConsumptionDTO | string>>(
    //   this.apiAddress + '/' + id + '/consumptions',
    //   {
    //     params: this.toHttpParams(query as unknown as Record<string, unknown>),
    //   },
    // );
  }

  downloadSharingOperationConsumptions(
    id: number,
    query: SharingOperationConsumptionQuery,
  ): Observable<ApiResponse<string> | { blob: Blob; filename: string }> {
    return this.http
      .get(this.apiAddress + '/' + id + '/consumptions/download', {
        observe: 'response',
        responseType: 'blob',
        params: { ...query },
      })
      .pipe(
        map((response) => {
          const blob = response.body as Blob;
          const contentDisposition = response.headers.get('content-disposition');
          let filename = 'consumptions.xlsx';
          if (contentDisposition) {
            const match = contentDisposition.match(/filename="(.+)"/);
            if (match?.[1]) {
              filename = match[1];
            }
          }

          return { blob, filename };
        }),
        catchError((error: HttpErrorResponse) => this.blobErrorHandler(error)),
      );
  }

  createSharingOperation(
    new_sharing_operations: CreateSharingOperationDTO,
  ): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(this.apiAddress + '/', new_sharing_operations).pipe(
      tap(() => {
        this.cache.invalidate('sharing-operation-list');
      }),
    );
  }

  addKeyToSharing(
    new_key_to_operation: AddKeyToSharingOperationDTO,
  ): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(this.apiAddress + '/key', new_key_to_operation).pipe(
      tap(() => {
        this.cache.invalidate(`sharing-operation-keys:${new_key_to_operation.id_sharing}`);
        this.cache.invalidate(`sharing-operation:${new_key_to_operation.id_sharing}`);
      }),
    );
  }

  addMeterToSharing(
    new_meters_to_operation: AddMeterToSharingOperationDTO,
  ): Observable<ApiResponse<string>> {
    return this.http
      .post<ApiResponse<string>>(this.apiAddress + '/meter', new_meters_to_operation)
      .pipe(
        tap(() => {
          this.cache.invalidate('sharing-operation-meters-list');
          this.cache.invalidate(`sharing-operation:${new_meters_to_operation.id_sharing}`);
        }),
      );
  }

  addConsumptionDataToSharing(
    upload_consumption_data: AddConsumptionDataDTO,
  ): Observable<ApiResponse<string>> {
    return this.http
      .post<ApiResponse<string>>(this.apiAddress + '/consumptions', upload_consumption_data)
      .pipe(
        tap(() => {
          this.cache.invalidate(
            `sharing-operation:${upload_consumption_data.id_sharing_operation}`,
          );
          this.cache.invalidate(
            `sharing-operation-consumption:${upload_consumption_data.id_sharing_operation}`,
          );
        }),
      );
  }

  patchKeyStatus(
    patched_key_status: PatchKeyToSharingOperationDTO,
  ): Observable<ApiResponse<string>> {
    return this.http.patch<ApiResponse<string>>(this.apiAddress + '/key', patched_key_status).pipe(
      tap(() => {
        this.cache.invalidate(`sharing-operation-keys:${patched_key_status.id_sharing}`);
      }),
    );
  }

  patchMeterStatus(
    patched_meter_status: PatchMeterToSharingOperationDTO,
  ): Observable<ApiResponse<string>> {
    return this.http
      .patch<ApiResponse<string>>(this.apiAddress + '/meter', patched_meter_status)
      .pipe(
        tap(() => {
          this.cache.invalidate(`sharing-operation:${patched_meter_status.id_sharing}`);
          this.cache.invalidate(`sharing-operation-meters-list:${patched_meter_status.id_sharing}`);
        }),
      );
  }

  deleteSharingOperation(id: number): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(this.apiAddress + '/' + id).pipe(
      tap(() => {
        this.cache.invalidate(`sharing-operation:${id}`);
        this.cache.invalidate(`sharing-operation-meters-list:${id}`);
        this.cache.invalidate(`sharing-operation-consumption:${id}`);
        this.cache.invalidate(`sharing-operations-list`);
      }),
    );
  }

  deleteMeterFromSharingOperation(
    id: number,
    removed_meter_status: RemoveMeterFromSharingOperationDTO,
  ): Observable<ApiResponse<string>> {
    return this.http
      .delete<ApiResponse<string>>(this.apiAddress + '/' + id + '/meter', {
        body: removed_meter_status,
      })
      .pipe(
        tap(() => {
          this.cache.invalidate(`sharing-operation-meters-list:${id}`);
        }),
      );
  }
}
