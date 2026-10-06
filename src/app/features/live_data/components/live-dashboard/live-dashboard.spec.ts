import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { vi } from 'vitest';

import { environments } from '../../../../../environments/environments';
import {
  AbsentReason,
  LiveOperation,
  LiveSeries,
  LiveSummary,
} from '../../../../shared/dtos/live-data.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { LIVE_WINDOWS } from '../../live-data-format';
import { LiveDashboard } from './live-dashboard';

// No stub for the chart, and none needed: it sits behind `@defer`, which TestBed
// leaves at its placeholder, so `primeng/chart` and chart.js never load here.
// Overriding the component's imports to swap it out would force a recompile and
// require `await TestBed.compileComponents()` for no benefit.

const base = `${environments.apiUrl}/live`;

/**
 * `rollup_freshness: 'fresh'` unless a test says otherwise: the stale banner is
 * the backend's verdict now, and a fixture without one would be a payload the
 * backend never sends.
 */
function summary(overrides: Partial<LiveSummary> & Record<string, unknown> = {}): LiveSummary {
  return {
    indicative: true,
    n_devices: 3,
    n_devices_online: 3,
    n_devices_never_seen: 0,
    n_devices_silent: 0,
    signal: 'neutral',
    rollup_freshness: 'fresh',
    rollup_lag_minutes: 4,
    absent: [],
    ...overrides,
  } as LiveSummary;
}

/** An ISO instant `hours` before now. */
function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

describe('LiveDashboard', () => {
  let httpMock: HttpTestingController;
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    errorHandlerSpy = { handleError: vi.fn() };
  });

  /**
   * ASYNC, and `compileComponents` is not ceremony here.
   *
   * This component's template contains a `@defer` block, and a deferred block's
   * dependencies are resolved asynchronously — so unlike the other hubs in this
   * app, its metadata is not available synchronously and `createComponent`
   * throws "unresolved metadata" without this await.
   *
   * `lang` is the reader's language. The loader-less TranslateModule sets none,
   * and figures are now written in the reader's language - so it is pinned,
   * rather than left to whatever the fallback happens to be.
   */
  async function render(lang = 'en'): Promise<ComponentFixture<LiveDashboard>> {
    TestBed.configureTestingModule({
      imports: [LiveDashboard, TranslateModule.forRoot()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
      ],
    });
    await TestBed.compileComponents();
    vi.spyOn(TestBed.inject(TranslateService), 'getCurrentLang').mockReturnValue(lang);
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(LiveDashboard);
    fixture.detectChanges();
    return fixture;
  }

  /** A series payload, with the fields a test does not care about filled in. */
  function seriesBody(series: Partial<LiveSeries> = {}): LiveSeries {
    return {
      indicative: true,
      resolution: 'hour',
      start: '2026-09-01T00:00:00Z',
      end: '2026-09-02T00:00:00Z',
      points: [],
      suppressed_buckets: 0,
      truncated: false,
      cap: 1464,
      absent: [],
      ...series,
    };
  }

  /** Answer the four requests `ngOnInit` issues, in whatever order they land. */
  function settle(data: {
    summary?: LiveSummary;
    series?: Partial<LiveSeries>;
    operations?: LiveOperation[];
  }): void {
    // D-14: the operation list behind the scope selector. Empty unless a test
    // gives one - a community with no sharing operation is the dashboard as it was.
    httpMock.expectOne(`${base}/operations`).flush({ data: data.operations ?? [], error_code: 0 });
    httpMock.expectOne(`${base}/summary`).flush({ data: data.summary ?? summary(), error_code: 0 });
    httpMock
      .expectOne((r) => r.url === `${base}/series`)
      .flush({
        data: {
          indicative: true,
          resolution: 'hour',
          start: '2026-09-01T00:00:00Z',
          end: '2026-09-02T00:00:00Z',
          points: [],
          suppressed_buckets: 0,
          truncated: false,
          cap: 1464,
          absent: [],
          ...data.series,
        },
        error_code: 0,
      });
    httpMock.expectOne(`${base}/forecast`).flush({
      data: { indicative: true, buckets: [], reason: 'no_method_for_production_chain' },
      error_code: 0,
    });
  }

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  /** jsdom reports every document as hidden, which would skip every poll tick. */
  function pretendVisible(): void {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  }

  const notSubscribed = { data: 'not subscribed', error_code: 1003 };
  const forbidden = { status: 403, statusText: 'Forbidden' };

  /** Refuse the three first-load requests the way a switched-off community does. */
  function refuseAsNotSubscribed(): void {
    httpMock.expectOne(`${base}/summary`).flush(notSubscribed, forbidden);
    httpMock.expectOne((r) => r.url === `${base}/series`).flush(notSubscribed, forbidden);
    httpMock.expectOne(`${base}/forecast`).flush(notSubscribed, forbidden);
  }

  it('shows production when it is present', async () => {
    const fixture = await render();
    settle({ summary: summary({ production_wh: 4000, bucket: '2026-09-01T10:00:00Z' }) });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(
      el.querySelector('[data-testid="live-dashboard__card--production"]')?.textContent,
    ).toContain('4.00 kWh');
  });

  it("writes the figures in the reader's language", async () => {
    // BUG: `toFixed` always wrote a decimal POINT, so a French, Dutch or German
    // reader saw "4.00 kWh" - which, in all three, reads as four thousand.
    const fixture = await render('fr');
    settle({ summary: summary({ production_wh: 4000, bucket: '2026-09-01T10:00:00Z' }) });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(
      el.querySelector('[data-testid="live-dashboard__card--production"]')?.textContent,
    ).toContain('4,00 kWh');
  });

  it('renders a withheld grid term as an em dash with its reason, NOT as zero', async () => {
    // The rule the whole absent-term design exists for. A `0` here would read as
    // "the community imported nothing" — a claim nobody made, on the one field
    // that was deliberately not answered.
    const fixture = await render();
    settle({
      summary: summary({
        production_wh: 4000,
        bucket: '2026-09-01T10:00:00Z',
        absent: [
          { term: 'import_wh', reason: AbsentReason.BELOW_K_THRESHOLD },
          { term: 'export_wh', reason: AbsentReason.BELOW_K_THRESHOLD },
        ],
      }),
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const grid = el.querySelector('[data-testid="live-dashboard__card--grid"]');
    expect(grid?.textContent).toContain('—');
    expect(grid?.textContent).not.toContain('0 Wh');
    expect(el.querySelector('[data-testid="live-dashboard__grid-absent"]')).not.toBeNull();
  });

  it('still shows production when the grid terms are withheld', async () => {
    // Decided 2026-09-16: production is never subject to k. Suppressing the
    // whole bucket would give every pilot community under five members a blank
    // chart on day one.
    const fixture = await render();
    settle({
      summary: summary({
        production_wh: 4000,
        bucket: '2026-09-01T10:00:00Z',
        absent: [{ term: 'import_wh', reason: AbsentReason.BELOW_K_THRESHOLD }],
      }),
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(
      el.querySelector('[data-testid="live-dashboard__card--production"]')?.textContent,
    ).toContain('4.00 kWh');
  });

  it('says "not measured" rather than showing zero for a community with no rollup', async () => {
    const fixture = await render();
    settle({
      summary: summary({
        absent: [
          { term: 'production_wh', reason: AbsentReason.NOT_MEASURED },
          { term: 'import_wh', reason: AbsentReason.NOT_MEASURED },
        ],
      }),
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="live-dashboard__no-data"]')).not.toBeNull();
  });

  it('does not claim nothing was measured while the first hour is still open', async () => {
    // `/summary` reads CLOSED hours only. A community in its first hour has been
    // measured; "no measurements have been rolled up yet" would be false.
    const fixture = await render();
    settle({
      summary: summary({
        absent: [
          { term: 'production_wh', reason: 'no_closed_hour_yet' },
          { term: 'import_wh', reason: 'no_closed_hour_yet' },
        ],
      }),
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="live-dashboard__no-data"]')).toBeNull();
  });

  describe('the stale-rollup banner', () => {
    /** Switch the chart to the 30-day range and answer its request. */
    function showMonth(fixture: ComponentFixture<LiveDashboard>, points: unknown[]): void {
      fixture.componentInstance.selectWindow(LIVE_WINDOWS[2]);
      httpMock
        .expectOne((r) => r.url === `${base}/series`)
        .flush({
          data: {
            indicative: true,
            resolution: 'day',
            start: hoursAgo(30 * 24),
            end: hoursAgo(-24),
            points,
            suppressed_buckets: 0,
            truncated: false,
            cap: 731,
            absent: [],
          },
          error_code: 0,
        });
      fixture.detectChanges();
    }

    function banner(fixture: ComponentFixture<LiveDashboard>): Element | null {
      return (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="live-dashboard__stale"]',
      );
    }

    it('does not call the 30-day chart stale because its newest day is yesterday', async () => {
      // BUG: the chart's newest point was compared with 90 minutes whatever the
      // resolution. A day series only has CLOSED days, so its newest point is
      // always at least 24 h old and the banner never went away.
      const fixture = await render();
      settle({ summary: summary({ bucket: hoursAgo(2), production_wh: 1 }) });
      showMonth(fixture, [{ bucket: hoursAgo(30), n_devices: 1, production_wh: 5000 }]);

      expect(banner(fixture)).toBeNull();
    });

    it('does not blame the rollups for a fleet that went quiet', async () => {
      // The same comparison at hour resolution: nothing produced for five hours
      // leaves the newest hour five hours old while every tick runs.
      const fixture = await render();
      settle({
        summary: summary({ bucket: hoursAgo(6), production_wh: 1 }),
        series: { points: [{ bucket: hoursAgo(5), n_devices: 1, production_wh: 100 }] },
      });
      fixture.detectChanges();

      expect(banner(fixture)).toBeNull();
    });

    it('says so when the scheduler has stopped, whatever the range', async () => {
      // The positive control: the banner is the backend's rollup verdict now, the
      // same one the Ops tab shows - so it appears on an empty chart too.
      const fixture = await render();
      settle({
        summary: summary({
          bucket: hoursAgo(3),
          production_wh: 1,
          rollup_freshness: 'stale',
          rollup_lag_minutes: 125,
        }),
      });
      fixture.detectChanges();

      expect(banner(fixture)).not.toBeNull();
      expect(fixture.componentInstance.staleMinutes()).toBe('125');
    });
  });

  it('shows the neutral signal banner and nothing that could read as advice', async () => {
    // Deviation 6: with no consumption term, a green light meaning "the sun is
    // shining" is read as "now is a good time to run the washing machine".
    const fixture = await render();
    settle({ summary: summary({ bucket: '2026-09-01T10:00:00Z', production_wh: 1 }) });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="live-dashboard__signal"]')).not.toBeNull();
  });

  it('reports a chart with no production as empty rather than drawing a flat zero', async () => {
    const fixture = await render();
    settle({
      summary: summary({ bucket: '2026-09-01T10:00:00Z' }),
      series: { points: [{ bucket: '2026-09-01T10:00:00Z', n_devices: 1 }] },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const empty = el.querySelector('[data-testid="live-dashboard__chart-empty"]');
    expect(empty).not.toBeNull();
    // No grid term was withheld either: this really is "nothing measured".
    expect(empty?.textContent).toContain('LIVE_DATA.CHART.EMPTY');
    expect(empty?.textContent).not.toContain('EMPTY_WITHHELD');
  });

  describe('a community of prosumers (net meters, no production term)', () => {
    // The reported bug, 2026-10-04: three simulated prosumers and an empty chart.
    // Protocol 3.4 - their meters cannot see production, and the views show the
    // export instead.
    const prosumerPoints = [
      { bucket: '2026-10-04T08:45:00Z', n_devices: 3, import_wh: 46, export_wh: 55 },
      { bucket: '2026-10-04T09:00:00Z', n_devices: 3, import_wh: 565, export_wh: 362 },
    ];
    const belowK = [
      { bucket: '2026-10-04T08:45:00Z', n_devices: 3 },
      { bucket: '2026-10-04T09:00:00Z', n_devices: 3 },
    ];

    it('charts the export instead of reporting an empty production chart', async () => {
      const fixture = await render();
      settle({
        summary: summary({ bucket: '2026-10-04T08:00:00Z' }),
        series: { points: prosumerPoints },
      });
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('[data-testid="live-dashboard__chart-empty"]')).toBeNull();
      expect(fixture.componentInstance.productionLines().map((line) => line.labelKey)).toEqual([
        'LIVE_DATA.CHART.EXPORT',
      ]);
    });

    it('says the export is withheld, not that nothing was measured, below k', async () => {
      const fixture = await render();
      settle({
        summary: summary({ bucket: '2026-10-04T08:00:00Z' }),
        series: { points: belowK, suppressed_buckets: 2 },
      });
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(
        el.querySelector('[data-testid="live-dashboard__chart-empty"]')?.textContent,
      ).toContain('LIVE_DATA.CHART.EMPTY_WITHHELD');
    });
  });

  describe('the grid offtake chart', () => {
    it('charts the aggregate import, with the footnote, from the same series request', async () => {
      const fixture = await render();
      settle({
        summary: summary({ bucket: '2026-10-04T08:00:00Z' }),
        series: {
          points: [{ bucket: '2026-10-04T09:00:00Z', n_devices: 3, import_wh: 565, export_wh: 0 }],
        },
      });
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('[data-testid="live-dashboard__offtake-card"]')).not.toBeNull();
      expect(el.querySelector('[data-testid="live-dashboard__offtake-empty"]')).toBeNull();
      expect(el.querySelector('[data-testid="live-dashboard__offtake-note"]')).not.toBeNull();
      expect(fixture.componentInstance.offtakeLines().map((line) => line.labelKey)).toEqual([
        'LIVE_DATA.CHART.OFFTAKE',
      ]);
      // One /series call feeds both charts - settle() already asserted exactly
      // one, and nothing further is pending.
      httpMock.verify();
    });

    it('gives the privacy reason when the import is withheld below k', async () => {
      const fixture = await render();
      settle({
        summary: summary({ bucket: '2026-10-04T08:00:00Z' }),
        series: {
          points: [{ bucket: '2026-10-04T09:00:00Z', n_devices: 3, production_wh: 900 }],
          suppressed_buckets: 1,
        },
      });
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(
        el.querySelector('[data-testid="live-dashboard__offtake-empty"]')?.textContent,
      ).toContain('LIVE_DATA.ABSENT.BELOW_K_THRESHOLD');
      // The production chart is unaffected: production is never subject to k.
      expect(el.querySelector('[data-testid="live-dashboard__chart-empty"]')).toBeNull();
    });

    it('shares one y-axis maximum with the production chart', async () => {
      const fixture = await render();
      settle({
        summary: summary({ bucket: '2026-10-04T08:00:00Z' }),
        series: {
          points: [
            { bucket: '2026-10-04T09:00:00Z', n_devices: 3, export_wh: 900, import_wh: 300 },
          ],
        },
      });
      fixture.detectChanges();

      expect(fixture.componentInstance.yMax()).toBe(0.9);
    });
  });

  it('counts suppressed buckets when the series carries some', async () => {
    const fixture = await render();
    settle({
      summary: summary({ bucket: '2026-09-01T10:00:00Z' }),
      series: {
        points: [{ bucket: '2026-09-01T10:00:00Z', n_devices: 1, production_wh: 500 }],
        suppressed_buckets: 3,
      },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="live-dashboard__suppressed"]')).not.toBeNull();
  });

  it('treats a 403 AGGREGATE_NOT_VISIBLE as a closed setting, not as a failure', async () => {
    // Only a member gets 2440 (the backend lets managers through), so here the
    // backend already sees one: the manager has closed the aggregate to members.
    // The standard red error toast would read as a bug.
    const fixture = await render();
    httpMock
      .expectOne(`${base}/summary`)
      .flush({ data: 'forbidden', error_code: 2440 }, { status: 403, statusText: 'Forbidden' });
    httpMock
      .expectOne((r) => r.url === `${base}/series`)
      .flush({ data: 'forbidden' }, { status: 403, statusText: 'Forbidden' });
    httpMock
      .expectOne(`${base}/forecast`)
      .flush({ data: 'forbidden' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    // The member view's words. It used to show the k-anonymity text ("too few
    // members contributed"), which gives the reader a false reason.
    expect(el.querySelector('[data-testid="live-dashboard__forbidden"]')?.textContent?.trim()).toBe(
      'LIVE_DATA.MEMBER.FORBIDDEN',
    );
    expect(errorHandlerSpy.handleError).not.toHaveBeenCalled();
  });

  it('shows a toast but NOT the privacy banner when the first load fails for another reason', async () => {
    // The old branch raised the banner for ANY first-load failure, telling a
    // manager that their own privacy setting hid figures it did not.
    const fixture = await render();
    httpMock
      .expectOne(`${base}/summary`)
      .flush(
        { data: 'Boom', error_code: 2432 },
        { status: 500, statusText: 'Internal Server Error' },
      );
    httpMock
      .expectOne((r) => r.url === `${base}/series`)
      .flush({ data: { points: [] }, error_code: 0 });
    httpMock.expectOne(`${base}/forecast`).flush({ data: null, error_code: 0 });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="live-dashboard__forbidden"]')).toBeNull();
    // The backend's own message, not the generic one — the dead
    // `instanceof ApiResponse` branch used to drop it.
    expect(errorHandlerSpy.handleError).toHaveBeenCalledWith('Boom');
  });

  it('keeps the figures and raises nothing when a silent poll fails', async () => {
    const fixture = await render();
    settle({ summary: summary({ production_wh: 4000, bucket: '2026-09-01T10:00:00Z' }) });
    fixture.detectChanges();

    pretendVisible();
    fixture.componentInstance.refresh();
    httpMock
      .expectOne(`${base}/summary`)
      .flush(
        { data: 'Boom', error_code: 2432 },
        { status: 500, statusText: 'Internal Server Error' },
      );
    httpMock
      .expectOne((r) => r.url === `${base}/series`)
      .flush({ data: 'Boom' }, { status: 500, statusText: 'Internal Server Error' });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(
      el.querySelector('[data-testid="live-dashboard__card--production"]')?.textContent,
    ).toContain('4.00 kWh');
    expect(el.querySelector('[data-testid="live-dashboard__forbidden"]')).toBeNull();
    expect(errorHandlerSpy.handleError).not.toHaveBeenCalled();
  });

  it('raises neither banner nor toast when live data has been deactivated', async () => {
    // LiveDataService completes a 1003 empty and the hub leaves the route; a
    // banner or a red toast here would be a second, contradictory reaction.
    const fixture = await render();
    refuseAsNotSubscribed();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="live-dashboard__forbidden"]')).toBeNull();
    expect(errorHandlerSpy.handleError).not.toHaveBeenCalled();
  });

  describe('polling', () => {
    // Only the interval is faked: HttpClient's testing backend and the `@defer`
    // resolution in `render()` must keep their real timers.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      pretendVisible();
    });

    it('polls summary and series every minute', async () => {
      // The positive control for the test below: without it, "no request after
      // a minute" would pass against a dashboard that never polled at all.
      await render();
      settle({});

      vi.advanceTimersByTime(60_000);

      httpMock.expectOne(`${base}/summary`).flush({ data: summary(), error_code: 0 });
      httpMock
        .expectOne((r) => r.url === `${base}/series`)
        .flush({ data: { points: [] }, error_code: 0 });
    });

    it('stops polling once live data has been deactivated', async () => {
      await render();
      refuseAsNotSubscribed();

      vi.advanceTimersByTime(60_000);

      httpMock.expectNone(`${base}/summary`);
      httpMock.expectNone((r) => r.url === `${base}/series`);
    });
  });

  describe('sharing operations (D-14)', () => {
    const solar: LiveOperation = { id: 7, name: 'Solar', n_devices: 2, n_meters: 3 };
    const wind: LiveOperation = { id: 9, name: 'Wind', n_devices: 1, n_meters: 4 };

    it('shows no scope selector and no sharing card without an operation', async () => {
      const fixture = await render();
      settle({ summary: summary({ bucket: '2026-09-01T10:00:00Z', production_wh: 1 }) });
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('[data-testid="live-dashboard__scope"]')).toBeNull();
      expect(el.querySelector('[data-testid="live-dashboard__sharing-card"]')).toBeNull();
    });

    it('offers the whole community and each operation, labels translated', async () => {
      // Translated in the component, not the template: PrimeNG copies an
      // option's label into its aria-label, and a key there is read aloud.
      const fixture = await render();
      settle({
        summary: summary({ bucket: '2026-09-01T10:00:00Z' }),
        operations: [solar, wind],
      });
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('[data-testid="live-dashboard__scope"]')).not.toBeNull();
      expect(fixture.componentInstance.scopeOptions().map((option) => option.label)).toEqual([
        'LIVE_DATA.SCOPE.COMMUNITY',
        'Solar',
        'Wind',
      ]);
      // The community's coverage is every operation's, summed.
      expect(fixture.componentInstance.coverage()).toEqual({ devices: 3, meters: 7 });
    });

    it('switches the charts and the cards to the selected operation', async () => {
      const fixture = await render();
      settle({ summary: summary({ bucket: '2026-09-01T10:00:00Z' }), operations: [solar] });
      fixture.detectChanges();

      fixture.componentInstance.selectScope(7);
      httpMock.expectOne(`${base}/operations/7/summary`).flush({
        data: {
          indicative: true,
          id_sharing_operation: 7,
          bucket: '2026-09-01T10:00:00Z',
          production_wh: 900,
          import_wh: 300,
          export_wh: 700,
          shared_wh: 250,
          n_devices: 2,
          n_meters: 3,
          absent: [],
        },
        error_code: 0,
      });
      httpMock
        .expectOne((r) => r.url === `${base}/operations/7/series`)
        .flush({
          data: seriesBody({
            points: [
              {
                bucket: '2026-09-01T10:00:00Z',
                n_devices: 2,
                import_wh: 300,
                export_wh: 700,
                shared_wh: 250,
              },
            ],
          }),
          error_code: 0,
        });
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('[data-testid="live-dashboard__operation-cards"]')).not.toBeNull();
      expect(el.querySelector('[data-testid="live-dashboard__card--power"]')).toBeNull();
      expect(fixture.componentInstance.coverage()).toEqual({ devices: 2, meters: 3 });
      expect(fixture.componentInstance.sharingSegments().map((segment) => segment.values)).toEqual([
        [0.25],
        [0.05],
        [0.25],
        [0.45],
      ]);
    });

    it('drops a late series for a scope the reader has already left', async () => {
      // Without the guard, the operation's curve would land on the community
      // view the reader switched back to, labelled as the community's.
      const fixture = await render();
      settle({ summary: summary({ bucket: '2026-09-01T10:00:00Z' }), operations: [solar] });
      fixture.detectChanges();

      fixture.componentInstance.selectScope(7);
      httpMock.expectOne(`${base}/operations/7/summary`).flush({
        data: { indicative: true, id_sharing_operation: 7, n_devices: 2, n_meters: 3, absent: [] },
        error_code: 0,
      });
      const late = httpMock.expectOne((r) => r.url === `${base}/operations/7/series`);
      fixture.componentInstance.selectScope(null);
      httpMock
        .expectOne((r) => r.url === `${base}/series`)
        .flush({ data: seriesBody({ points: [] }), error_code: 0 });
      late.flush({
        data: seriesBody({
          points: [{ bucket: '2026-09-01T10:00:00Z', n_devices: 2, export_wh: 999 }],
        }),
        error_code: 0,
      });

      expect(fixture.componentInstance.series()?.points).toEqual([]);
    });

    it('says why the sharing chart is empty below k', async () => {
      const fixture = await render();
      settle({
        summary: summary({ bucket: '2026-09-01T10:00:00Z' }),
        operations: [solar],
        series: {
          points: [{ bucket: '2026-09-01T10:00:00Z', n_devices: 2, production_wh: 50 }],
          suppressed_buckets: 1,
        },
      });
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(
        el.querySelector('[data-testid="live-dashboard__sharing-empty"]')?.textContent,
      ).toContain('LIVE_DATA.ABSENT.BELOW_K_THRESHOLD');
    });
  });
});
