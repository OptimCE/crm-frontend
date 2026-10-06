import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';

import { environments } from '../../../environments/environments';
import { LiveDeviceType, LiveResolution } from '../dtos/live-data.dtos';
import { LiveDataService } from './live-data.service';

describe('LiveDataService', () => {
  let service: LiveDataService;
  let httpMock: HttpTestingController;
  const base = `${environments.apiUrl}/live`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LiveDataService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LiveDataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  describe('the telemetry reads bypass the cache', () => {
    /**
     * `ServiceBase.cachedGet` memoises under a five-minute TTL. The dashboard
     * polls every 60 s, so a cached `summary` would serve the same body for five
     * minutes and then jump — a poll that looks like it is working and is not.
     *
     * Asserted by calling twice and expecting TWO requests. A cached read would
     * issue one and `httpMock.verify()` would pass regardless, so the count is
     * the assertion.
     */
    it('issues a fresh request for the summary on every call', () => {
      service.summary().subscribe();
      httpMock.expectOne(`${base}/summary`).flush({ data: {}, error_code: 0 });

      service.summary().subscribe();
      httpMock.expectOne(`${base}/summary`).flush({ data: {}, error_code: 0 });
    });

    it('issues a fresh request for the series on every call', () => {
      service.series({ resolution: LiveResolution.HOUR }).subscribe();
      httpMock.expectOne((r) => r.url === `${base}/series`).flush({ data: {}, error_code: 0 });

      service.series({ resolution: LiveResolution.HOUR }).subscribe();
      httpMock.expectOne((r) => r.url === `${base}/series`).flush({ data: {}, error_code: 0 });
    });

    it('issues a fresh request for the fleet status on every call', () => {
      service.opsHealth().subscribe();
      httpMock.expectOne(`${base}/ops/health`).flush({ data: {}, error_code: 0 });

      service.opsHealth().subscribe();
      httpMock.expectOne(`${base}/ops/health`).flush({ data: {}, error_code: 0 });
    });
  });

  describe('series query', () => {
    it('sends only the parameters it was given', () => {
      service.series({ resolution: LiveResolution.DAY }).subscribe();
      const req = httpMock.expectOne((r) => r.url === `${base}/series`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('resolution')).toBe('day');
      // The backend's default window is already snapped to the grid. Sending
      // bounds this client computed is where a rounding slip becomes a 422.
      expect(req.request.params.has('from')).toBe(false);
      expect(req.request.params.has('to')).toBe(false);
      req.flush({ data: {}, error_code: 0 });
    });

    it('passes explicit bounds through UNCHANGED when given', () => {
      // No client-side rounding, ever. A client that quietly snaps an unsnapped
      // bound re-opens the differencing attack the backend's 422 exists to
      // close — it would answer both of two adjacent windows identically.
      service
        .series({
          resolution: LiveResolution.HOUR,
          from: '2026-09-01T10:00:00Z',
          to: '2026-09-02T10:00:00Z',
        })
        .subscribe();
      const req = httpMock.expectOne((r) => r.url === `${base}/series`);
      expect(req.request.params.get('from')).toBe('2026-09-01T10:00:00Z');
      expect(req.request.params.get('to')).toBe('2026-09-02T10:00:00Z');
      req.flush({ data: {}, error_code: 0 });
    });

    it('omits an undefined bound rather than sending the string "undefined"', () => {
      service.series({ resolution: LiveResolution.HOUR, from: undefined }).subscribe();
      const req = httpMock.expectOne((r) => r.url === `${base}/series`);
      expect(req.request.params.has('from')).toBe(false);
      req.flush({ data: {}, error_code: 0 });
    });
  });

  describe('devices', () => {
    it('lists devices from the cached endpoint', () => {
      service.listDevices().subscribe();
      const req = httpMock.expectOne(`${base}/devices`);
      expect(req.request.method).toBe('GET');
      req.flush({ data: [], error_code: 0 });
    });

    it('re-reads the devices when asked for a fresh list, and only then', () => {
      // The "Add device" picker greys out every meter a device still holds. A
      // device another manager revoked is not in this tab's cache-clearing
      // path, so without `fresh` its meter stayed unpickable for five minutes.
      service.listDevices().subscribe();
      httpMock.expectOne(`${base}/devices`).flush({ data: [], error_code: 0 });

      // Positive control: a plain second read is served from the cache.
      service.listDevices().subscribe();
      httpMock.expectNone(`${base}/devices`);

      service.listDevices({ fresh: true }).subscribe();
      httpMock.expectOne(`${base}/devices`).flush({ data: [], error_code: 0 });
    });

    it('creates a device with the production type stated explicitly', () => {
      service
        .createDevice({
          name: 'Roof',
          ean: '541448000000000001',
          type: LiveDeviceType.PRODUCTION,
          pure_injection: true,
        })
        .subscribe();
      const req = httpMock.expectOne(`${base}/devices`);
      expect(req.request.method).toBe('POST');
      expect((req.request.body as { type: number }).type).toBe(LiveDeviceType.PRODUCTION);
      expect((req.request.body as { pure_injection: boolean }).pure_injection).toBe(true);
      req.flush({ data: {}, error_code: 0 });
    });

    it('issues a token with a POST and an empty body', () => {
      service.issueToken('abc-123').subscribe();
      const req = httpMock.expectOne(`${base}/devices/abc-123/token`);
      expect(req.request.method).toBe('POST');
      req.flush({ data: {}, error_code: 0 });
    });

    it('revokes with a POST', () => {
      service.revokeDevice('abc-123').subscribe();
      const req = httpMock.expectOne(`${base}/devices/abc-123/revoke`);
      expect(req.request.method).toBe('POST');
      req.flush({ data: {}, error_code: 0 });
    });

    it('reads one device diagnostics', () => {
      service.diagnostics('abc-123').subscribe();
      const req = httpMock.expectOne(`${base}/devices/abc-123/diagnostics`);
      expect(req.request.method).toBe('GET');
      req.flush({ data: {}, error_code: 0 });
    });
  });

  describe('settings', () => {
    it('reads the settings', () => {
      service.settings().subscribe();
      httpMock.expectOne(`${base}/settings`).flush({ data: {}, error_code: 0 });
    });

    it('replaces the settings with a PUT carrying all three fields', () => {
      // The backend's PUT is a full replacement with `extra="forbid"`. Sending a
      // partial body would 422; sending a default for a field the manager did
      // not touch would silently revert whatever someone else set.
      service
        .updateSettings({ members_see_production: false, members_see_aggregate: true, k: 7 })
        .subscribe();
      const req = httpMock.expectOne(`${base}/settings`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        members_see_production: false,
        members_see_aggregate: true,
        k: 7,
      });
      req.flush({ data: {}, error_code: 0 });
    });

    it('invalidates the cache after a write, so the next read is fresh', () => {
      service.settings().subscribe();
      httpMock.expectOne(`${base}/settings`).flush({ data: { k: 5 }, error_code: 0 });

      service
        .updateSettings({ members_see_production: true, members_see_aggregate: true, k: 9 })
        .subscribe();
      httpMock.expectOne(`${base}/settings`).flush({ data: { k: 9 }, error_code: 0 });

      // Without the invalidation this would be served from the 5-minute cache
      // and the panel would show the OLD value straight after saving.
      service.settings().subscribe();
      httpMock.expectOne(`${base}/settings`).flush({ data: { k: 9 }, error_code: 0 });
    });
  });

  describe('the forecast seam', () => {
    it('reads the forecast', () => {
      service.forecast().subscribe();
      const req = httpMock.expectOne(`${base}/forecast`);
      expect(req.request.method).toBe('GET');
      req.flush({ data: { buckets: [], reason: 'no_method_for_production_chain' }, error_code: 0 });
    });

    it('reads the method list', () => {
      service.forecastMethods().subscribe();
      httpMock.expectOne(`${base}/forecast/methods`).flush({ data: [], error_code: 0 });
    });
  });

  describe('a deactivated subscription (403 NOT_SUBSCRIBED)', () => {
    const notSubscribed = { data: 'not subscribed', error_code: 1003 };
    const forbidden = { status: 403, statusText: 'Forbidden' };

    /**
     * Walks the prototype rather than listing the methods, so an endpoint added
     * later without `gateSubscription` fails here instead of leaking a 1003 to
     * a component that would toast it — the same self-maintaining shape as
     * live-data's `test_route_coverage.py`.
     */
    it('completes every call without a value and announces the loss', () => {
      const prototype = LiveDataService.prototype as unknown as Record<string, unknown>;
      const names = Object.getOwnPropertyNames(prototype).filter(
        (name) => name !== 'constructor' && typeof prototype[name] === 'function',
      );
      // Guards the walk itself: an empty list would pass every assertion below.
      expect(names.length).toBeGreaterThanOrEqual(13);

      let losses = 0;
      service.subscriptionLost$.subscribe(() => losses++);
      const methods = service as unknown as Record<
        string,
        (...args: unknown[]) => Observable<unknown>
      >;

      for (const name of names) {
        const call = methods[name];
        const outcome = { next: 0, error: 0, complete: 0 };
        call.apply(service, call.length > 0 ? ['abc-123'] : []).subscribe({
          next: () => outcome.next++,
          error: () => outcome.error++,
          complete: () => outcome.complete++,
        });
        for (const request of httpMock.match(() => true)) {
          request.flush(notSubscribed, forbidden);
        }
        expect(outcome, name).toEqual({ next: 0, error: 0, complete: 1 });
      }
      expect(losses).toBe(names.length);
    });

    it('passes any other 403 through to the caller', () => {
      // 2440 is the dashboard's privacy banner. Swallowing it here would turn a
      // closed setting into a module that silently shows nothing.
      let losses = 0;
      service.subscriptionLost$.subscribe(() => losses++);
      let values = 0;
      let caught: unknown = null;
      service.summary().subscribe({
        next: () => values++,
        error: (error: unknown) => (caught = error),
      });
      httpMock
        .expectOne(`${base}/summary`)
        .flush({ data: 'forbidden', error_code: 2440 }, forbidden);

      expect(values).toBe(0);
      expect(caught).toBeInstanceOf(HttpErrorResponse);
      expect((caught as HttpErrorResponse).status).toBe(403);
      expect(losses).toBe(0);
    });

    it('drops the cached live-data reads', () => {
      service.settings().subscribe();
      httpMock.expectOne(`${base}/settings`).flush({ data: { k: 5 }, error_code: 0 });
      // Positive control: without a loss the second read is served from cache.
      service.settings().subscribe();
      httpMock.expectNone(`${base}/settings`);

      service.summary().subscribe();
      httpMock.expectOne(`${base}/summary`).flush(notSubscribed, forbidden);

      // A return visit after re-activation must ask the backend again.
      service.settings().subscribe();
      httpMock.expectOne(`${base}/settings`).flush({ data: { k: 5 }, error_code: 0 });
    });
  });

  it('targets the /live gateway prefix, which KrakenD strips before the backend', () => {
    // The gateway endpoint is `/live/summary` and the backend serves `/summary`.
    // Getting this wrong 404s every route while krakend.json looks perfect.
    service.version().subscribe();
    httpMock.expectOne(`${environments.apiUrl}/live/version`).flush({ data: {}, error_code: 0 });
  });
});
