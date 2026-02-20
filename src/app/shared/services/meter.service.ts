import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MeterService {
  private http = inject(HttpClient);
  private apiAddress: string;

  constructor() {
    this.apiAddress = environments.apiUrl + '/meters';
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

  getMetersList(
    query: MeterPartialQuery,
  ): Observable<ApiResponsePaginated<PartialMeterDTO[] | string>> {
    return this.http.get<ApiResponsePaginated<PartialMeterDTO[] | string>>(this.apiAddress + '/', {
      params: this.toHttpParams(query as unknown as Record<string, unknown>),
    });
  }

  getMeter(id: string): Observable<ApiResponse<MetersDTO | string>> {
    return this.http.get<ApiResponse<MetersDTO | string>>(this.apiAddress + '/' + id);
  }

  getMeterConsumptions(
    id: string,
    query: MeterConsumptionQuery,
  ): Observable<ApiResponse<MeterConsumptionDTO | string>> {
    return this.http.get<ApiResponse<MeterConsumptionDTO | string>>(
      this.apiAddress + '/' + id + '/consumptions',
      {
        params: this.toHttpParams(query as unknown as Record<string, unknown>),
      },
    );
  }

  downloadMeterConsumptions(
    id: string,
    query: MeterConsumptionQuery,
  ): Observable<ApiResponse<unknown>> {
    return this.http.get<ApiResponse<unknown>>(
      this.apiAddress + '/' + id + '/consumptions/download',
      {
        params: this.toHttpParams(query as unknown as Record<string, unknown>),
      },
    );
  }

  addMeter(create_meter: CreateMeterDTO): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(this.apiAddress + '/', create_meter);
  }

  updateMeter(updated_meter: UpdateMeterDTO): Observable<ApiResponse<string>> {
    return this.http.put<ApiResponse<string>>(this.apiAddress + '/', updated_meter);
  }

  patchMeterData(patch_meter_data: PatchMeterDataDTO): Observable<ApiResponse<string>> {
    return this.http.patch<ApiResponse<string>>(this.apiAddress + '/data', patch_meter_data);
  }

  deleteMeter(id: string): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(this.apiAddress + '/' + id);
  }
}
