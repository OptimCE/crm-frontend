import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environments } from '../../../environments/environments';
import { DataExportService } from './data-export.service';

describe('DataExportService', () => {
  let service: DataExportService;
  let http: HttpTestingController;
  const base = `${environments.apiUrl}/exports`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DataExportService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('asks for an export with the scope and, for a community, its Keycloak id', () => {
    service.request({ scope: 'community', community_id: 'org-1' }).subscribe();
    const req = http.expectOne(`${base}/`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ scope: 'community', community_id: 'org-1' });
    req.flush({ data: { export_id: 'x', status: 'pending' } });
  });

  it('reads the list with its view and page, uncached: two reads are two requests', () => {
    service.list({ view: 'community', page: 2, limit: 10 }).subscribe();
    service.list({ view: 'community', page: 2, limit: 10 }).subscribe();
    const reqs = http.match((r) => r.url === `${base}/`);
    expect(reqs).toHaveLength(2);
    expect(reqs[0].request.params.get('view')).toBe('community');
    expect(reqs[0].request.params.get('page')).toBe('2');
    expect(reqs[0].request.params.get('limit')).toBe('10');
    reqs.forEach((r) => r.flush({ data: [], pagination: { page: 2, limit: 10, total: 0 } }));
  });

  it('gets a download URL by POST, the id path-encoded', () => {
    service.downloadUrl('a/b').subscribe();
    const req = http.expectOne(`${base}/a%2Fb/download-url`);
    expect(req.request.method).toBe('POST');
    req.flush({ data: { url: 'https://storage.example/x', expires_in: 300 } });
  });
});
