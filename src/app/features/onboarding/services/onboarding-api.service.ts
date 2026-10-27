import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environments } from '../../../../environments/environments';
import { ApiResponse } from '../../../core/dtos/api.response';
import { ServiceBase } from '../../../shared/services/service.base';
import {
  OnboardingStateDTO,
  OnboardingTourKey,
  UpdateOnboardingStateDTO,
} from '../onboarding-tours';

/**
 * The current user's answers to the onboarding offers. Never cached: an answer
 * written in one tab must be seen by the next checkpoint in any tab.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingApiService extends ServiceBase {
  private readonly apiAddress = environments.apiUrl + '/me/onboarding';

  getStates(): Observable<OnboardingStateDTO[]> {
    return this.http
      .get<ApiResponse<OnboardingStateDTO[]>>(this.apiAddress)
      .pipe(map((response) => response.data ?? []));
  }

  /** Idempotent: sending the same answer twice changes nothing. */
  setState(key: OnboardingTourKey, body: UpdateOnboardingStateDTO): Observable<OnboardingStateDTO> {
    return this.http
      .put<ApiResponse<OnboardingStateDTO>>(`${this.apiAddress}/${key}`, body)
      .pipe(map((response) => response.data));
  }
}
