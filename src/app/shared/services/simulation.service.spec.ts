import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environments } from '../../../environments/environments';
import { SIMULATION_CHART_MAX_POINTS, SimulationService } from './simulation.service';

describe('SimulationService', () => {
  let service: SimulationService;
  let httpMock: HttpTestingController;
  const base = `${environments.apiUrl}/simulation`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SimulationService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SimulationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  // BUG: the chart fetched the whole stored object, per-consumer series
  // included: up to 400 MB of JSON for a large run, which the gateway decodes
  // whole (and times out on) and the browser then parses. It draws only each
  // iteration's own series, at most SIMULATION_CHART_MAX_POINTS points.
  it('asks for the time series sampled to what the chart draws', () => {
    let stride: number | undefined;
    service.getTimeseries(7).subscribe((response) => {
      stride = typeof response.data === 'string' ? undefined : response.data.stride;
    });

    const req = httpMock.expectOne((r) => r.url === `${base}/7/timeseries`);
    expect(req.request.method).toBe('GET');
    expect(req.request.urlWithParams).toBe(`${base}/7/timeseries?max_points=1500`);
    expect(req.request.params.get('max_points')).toBe(String(SIMULATION_CHART_MAX_POINTS));
    req.flush({ data: { iterations: [], stride: 24 }, error_code: 0 });

    expect(stride).toBe(24);
  });
});
