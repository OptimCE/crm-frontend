import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environments } from '../../../environments/environments';
import { CacheService } from '../../core/services/cache/cache.service';
import { DsoResolutionDTO } from '../dtos/dso.dtos';
import { DsoService } from './dso.service';

describe('DsoService', () => {
  let service: DsoService;
  let httpMock: HttpTestingController;
  const base = `${environments.apiUrl}/dso`;
  const unavailable: DsoResolutionDTO = { available: false, status: 'unavailable', warnings: [] };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DsoService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DsoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('reads the operator catalogue with a GET, under a key no community switch drops', () => {
    service.getOperators().subscribe();

    const req = httpMock.expectOne(`${base}/operators`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], error_code: 0 });

    // National data: `dso-operators` is not a COMMUNITY_SCOPED_CACHE_PREFIXES entry.
    expect(TestBed.inject(CacheService).get('dso-operators')).toEqual({ data: [], error_code: 0 });
    service.getOperators().subscribe();
    httpMock.expectNone(`${base}/operators`);
  });

  it('resolves with a GET carrying only the fields that are set', () => {
    service
      .resolve({
        postcode: '5020',
        city: 'Namur',
        ean: '541448200000000001',
        nis_code: 92094,
        post_name: undefined,
        section: '',
      })
      .subscribe();

    const req = httpMock.expectOne((r) => r.url === `${base}/resolve`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().sort()).toEqual(['city', 'ean', 'nis_code', 'postcode']);
    expect(req.request.params.get('nis_code')).toBe('92094');
    expect(req.request.params.get('postcode')).toBe('5020');
    req.flush({ data: unavailable, error_code: 0 });
  });

  it('keys the cache on the query, whatever the order its fields were set in', () => {
    service.resolve({ postcode: '5020', city: 'Namur' }).subscribe();
    httpMock.expectOne((r) => r.url === `${base}/resolve`).flush({ data: unavailable });

    service.resolve({ city: 'Namur', postcode: '5020', ean: undefined }).subscribe();

    httpMock.expectNone((r) => r.url === `${base}/resolve`);
    // The prefix COMMUNITY_SCOPED_CACHE_PREFIXES drops on a switch: warnings depend
    // on the active community's regulator.
    expect(
      TestBed.inject(CacheService).get('dso-resolve:{"city":"Namur","postcode":"5020"}'),
    ).toBeTruthy();
  });

  it('asks again for another query', () => {
    service.resolve({ postcode: '5020' }).subscribe();
    httpMock.expectOne((r) => r.url === `${base}/resolve`).flush({ data: unavailable });

    service.resolve({ postcode: '5020', ins: '92094', section: '92094|flawinne' }).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${base}/resolve`);
    expect(req.request.params.get('section')).toBe('92094|flawinne');
    req.flush({ data: unavailable });
  });

  it('does NOT retry a failed lookup: the form carries on with its own list', () => {
    let errored = false;
    service.resolve({ postcode: '4000' }).subscribe({ error: () => (errored = true) });

    httpMock
      .expectOne((r) => r.url === `${base}/resolve`)
      .flush(null, { status: 504, statusText: 'Gateway Timeout' });

    httpMock.expectNone((r) => r.url === `${base}/resolve`);
    expect(errored).toBe(true);
  });
});
