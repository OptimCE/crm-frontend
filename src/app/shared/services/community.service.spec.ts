import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Observable } from 'rxjs';

import { environments } from '../../../environments/environments';
import { CommunityService } from './community.service';

describe('CommunityService', () => {
  let service: CommunityService;
  let httpMock: HttpTestingController;
  const base = `${environments.apiUrl}/communities`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CommunityService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CommunityService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('reads the public detail from /communities/:id/public, cached', () => {
    service.getPublicCommunityDetail(7).subscribe();
    const req = httpMock.expectOne(`${base}/7/public`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: { id: 7 }, error_code: 0 });

    service.getPublicCommunityDetail(7).subscribe();
    httpMock.expectNone(`${base}/7/public`);
  });

  type Mutation = (s: CommunityService) => Observable<unknown>;

  it.each<[string, Mutation]>([
    ['updateCommunity', (s: CommunityService) => s.updateCommunity({ contact_email: 'a@b.be' })],
    ['uploadLogo', (s: CommunityService) => s.uploadLogo(new File(['x'], 'logo.png'))],
    ['deleteLogo', (s: CommunityService) => s.deleteLogo()],
  ])('%s makes both details be read again', (_name, mutate) => {
    service.getCommunityDetail(7).subscribe();
    httpMock.expectOne(`${base}/7`).flush({ data: { id: 7 }, error_code: 0 });
    service.getPublicCommunityDetail(7).subscribe();
    httpMock.expectOne(`${base}/7/public`).flush({ data: { id: 7 }, error_code: 0 });

    mutate(service).subscribe();
    httpMock
      .expectOne((req) => req.method !== 'GET' && req.url.startsWith(base))
      .flush({ data: 'ok', error_code: 0 });

    // The page that just saved must not re-read the old values from the cache.
    service.getCommunityDetail(7).subscribe();
    httpMock.expectOne(`${base}/7`).flush({ data: { id: 7 }, error_code: 0 });
    service.getPublicCommunityDetail(7).subscribe();
    httpMock.expectOne(`${base}/7/public`).flush({ data: { id: 7 }, error_code: 0 });
  });
});
