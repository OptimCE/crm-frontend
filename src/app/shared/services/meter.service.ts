import { Injectable } from '@angular/core';
import { environments } from '../../../environments/environments';
import {
  CreateMeterDTO,
  MeterConsumptionDTO,
  MeterConsumptionQuery,
  MeterPartialQuery,
  MetersDTO,
  PartialMeterDTO,
  PatchMeterDataDTO,
  UpdateMeterDTO,
} from '../dtos/meter.dtos';
import { ApiResponse, ApiResponsePaginated } from '../../core/dtos/api.response';
import { catchError, map, Observable, tap } from 'rxjs';
import { ServiceBase } from './service.base';
import { HttpErrorResponse } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class MeterService extends ServiceBase {
  private readonly apiAddress: string;

  constructor() {
    super();
    this.apiAddress = environments.apiUrl + '/meters';
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

  getMetersList(
    query: MeterPartialQuery,
  ): Observable<ApiResponsePaginated<PartialMeterDTO[] | string>> {
    return this.cachedGet<ApiResponsePaginated<PartialMeterDTO[] | string>>(
      `meters-list:${JSON.stringify(query)}`,
      this.apiAddress + '/',
      query,
    );
    // return this.http.get<ApiResponsePaginated<PartialMeterDTO[] | string>>(this.apiAddress + '/', {
    //   params: this.toHttpParams(query as unknown as Record<string, unknown>),
    // });
  }

  getMeter(id: string): Observable<ApiResponse<MetersDTO | string>> {
    return this.cachedGet<ApiResponse<MetersDTO | string>>(
      `meters:${id}`,
      this.apiAddress + `/${id}`,
    );
    // return this.http.get<ApiResponse<MetersDTO | string>>(this.apiAddress + '/' + id);
  }

  getMeterConsumptions(
    id: string,
    query: MeterConsumptionQuery,
  ): Observable<ApiResponse<MeterConsumptionDTO | string>> {
    return this.cachedGet<ApiResponse<MeterConsumptionDTO | string>>(
      `meters-consumptions:${id}/${JSON.stringify(query)}`,
      this.apiAddress + `/${id}/consumptions`,
      query,
    );
    // return this.http.get<ApiResponse<MeterConsumptionDTO | string>>(
    //   this.apiAddress + '/' + id + '/consumptions',
    //   {
    //     params: this.toHttpParams(query as unknown as Record<string, unknown>),
    //   },
    // );
  }

  downloadMeterConsumptions(
    id: string,
    query: MeterConsumptionQuery,
  ): Observable<{ blob: Blob; filename: string }> {
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

  addMeter(create_meter: CreateMeterDTO): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(this.apiAddress + '/', create_meter).pipe(
      tap(() => {
        this.cache.invalidate('meters-list');
      }),
    );
  }

  updateMeter(updated_meter: UpdateMeterDTO): Observable<ApiResponse<string>> {
    return this.http.put<ApiResponse<string>>(this.apiAddress + '/', updated_meter).pipe(
      tap(() => {
        this.cache.invalidate('meters-list');
        this.cache.invalidate(`meters:${updated_meter.EAN}`);
      }),
    );
  }

  patchMeterData(patch_meter_data: PatchMeterDataDTO): Observable<ApiResponse<string>> {
    return this.http.patch<ApiResponse<string>>(this.apiAddress + '/data', patch_meter_data).pipe(
      tap(() => {
        this.cache.invalidate('meters-list');
        this.cache.invalidate(`meters:${patch_meter_data.EAN}`);
      }),
    );
  }

  deleteMeter(id: string): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(this.apiAddress + '/' + id).pipe(
      tap(() => {
        this.cache.invalidate('meters-list');
        this.cache.invalidate(`meters:${id}`);
      }),
    );
  }
}
