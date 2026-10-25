import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { environments } from '../../../../environments/environments';
import { OnboardingApiService } from './onboarding-api.service';

describe('OnboardingApiService', () => {
  let http: HttpTestingController;
  const url = environments.apiUrl + '/me/onboarding';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should read the states, never from a cache', async () => {
    const service = TestBed.inject(OnboardingApiService);
    const first = firstValueFrom(service.getStates());
    http
      .expectOne(url)
      .flush({ data: [{ tour_key: 'welcome', outcome: 'dismissed' }], error_code: 0 });
    expect(await first).toEqual([{ tour_key: 'welcome', outcome: 'dismissed' }]);

    const second = firstValueFrom(service.getStates());
    http.expectOne(url).flush({ data: [], error_code: 0 });
    expect(await second).toEqual([]);
  });

  it('should PUT one answer to its tour', async () => {
    const pending = firstValueFrom(
      TestBed.inject(OnboardingApiService).setState('community_admin', {
        outcome: 'started',
        tour_version: 'sha384-x',
      }),
    );
    const req = http.expectOne(`${url}/community_admin`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ outcome: 'started', tour_version: 'sha384-x' });
    req.flush({ data: { tour_key: 'community_admin', outcome: 'started' }, error_code: 0 });
    expect((await pending).outcome).toBe('started');
  });
});
