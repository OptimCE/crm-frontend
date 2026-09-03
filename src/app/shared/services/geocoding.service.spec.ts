import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environments } from '../../../environments/environments';
import { AddressSuggestionDTO } from '../dtos/geocoding.dtos';
import { GeocodingService } from './geocoding.service';

describe('GeocodingService', () => {
  let service: GeocodingService;
  let httpMock: HttpTestingController;
  const base = `${environments.apiUrl}/geocoding`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GeocodingService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GeocodingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('asks for suggestions with a GET and the typed query', () => {
    service.suggestAddresses('rue de la loi 16 1000').subscribe();

    const req = httpMock.expectOne((r) => r.url === `${base}/suggest`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('q')).toBe('rue de la loi 16 1000');
    expect(req.request.params.get('limit')).toBe('8');
    req.flush({ data: [], error_code: 0 });
  });

  it('does NOT retry a failed suggestion', () => {
    // `cachedGet` defaults to two retries with a backoff. This fires once per
    // debounced keystroke across six forms, so a default retry turns a slow
    // provider into three times the traffic — and the next keystroke supersedes
    // an unanswered one anyway.
    let errored = false;
    service.suggestAddresses('rue de la loi').subscribe({ error: () => (errored = true) });

    httpMock
      .expectOne((r) => r.url === `${base}/suggest`)
      .flush(null, {
        status: 500,
        statusText: 'Server Error',
      });

    // A second request would mean the retry policy is still on.
    httpMock.expectNone((r) => r.url === `${base}/suggest`);
    expect(errored).toBe(true);
  });

  it('previews with a GET, not a POST', () => {
    // ServiceBase has only cachedGet: as a POST this would forfeit in-flight
    // dedup, the cache, the timeout and the retry policy for an idempotent call.
    service
      .previewAddress({
        street: 'Rue de la Loi',
        number: '16',
        postcode: '1000',
        city: 'Bruxelles',
      })
      .subscribe();

    const req = httpMock.expectOne((r) => r.url === `${base}/preview`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('street')).toBe('Rue de la Loi');
    expect(req.request.params.get('number')).toBe('16');
    req.flush({ data: { found: false, suggestions: [] }, error_code: 0 });
  });

  it('omits an undefined supplement rather than sending "undefined"', () => {
    service
      .previewAddress({ street: 'Rue', number: '1', postcode: '1000', city: 'Bruxelles' })
      .subscribe();

    const req = httpMock.expectOne((r) => r.url === `${base}/preview`);
    expect(req.request.params.has('supplement')).toBe(false);
    req.flush({ data: { found: false, suggestions: [] }, error_code: 0 });
  });

  it('deduplicates identical in-flight queries', () => {
    // Typing produces a burst of near-identical requests; the key folds case
    // and surrounding whitespace so backspacing replays a hit, not a request.
    service.suggestAddresses('Rue De La Loi').subscribe();
    service.suggestAddresses('  rue de la loi  ').subscribe();

    const req = httpMock.expectOne((r) => r.url === `${base}/suggest`);
    req.flush({ data: [] as AddressSuggestionDTO[], error_code: 0 });
  });
});
