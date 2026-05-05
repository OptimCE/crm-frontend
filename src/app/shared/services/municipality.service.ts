import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environments } from '../../../environments/environments';
import { ApiResponsePaginated } from '../../core/dtos/api.response';
import { MunicipalityPartialDTO, MunicipalitySearchQuery } from '../dtos/municipality.dtos';
import { ServiceBase } from './service.base';

@Injectable({
  providedIn: 'root',
})
export class MunicipalityService extends ServiceBase {
  private readonly apiAddress: string;

  constructor() {
    super();
    this.apiAddress = environments.apiUrl + '/municipalities';
  }

  searchMunicipalities(
    query: MunicipalitySearchQuery,
  ): Observable<ApiResponsePaginated<MunicipalityPartialDTO[] | string>> {
    return this.cachedGet<ApiResponsePaginated<MunicipalityPartialDTO[] | string>>(
      `municipalities-search:${JSON.stringify(query)}`,
      this.apiAddress + '/',
      query,
    );
  }
}
