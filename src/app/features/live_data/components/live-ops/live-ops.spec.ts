import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService, TranslationObject } from '@ngx-translate/core';
import { vi } from 'vitest';

import fr from '../../../../../assets/i18n/fr.json';
import { environments } from '../../../../../environments/environments';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { LiveOps } from './live-ops';

const base = `${environments.apiUrl}/live`;

/**
 * The payload as the backend sends it. Untyped ON PURPOSE: the first case below
 * is a shape the SPA's types say cannot happen - explicit `null`s - and it is
 * exactly the shape the backend DID send, which is how "il y a null minutes"
 * shipped. A fixture typed by the SPA's own DTO could never have caught it.
 */
function ops(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    indicative: true,
    n_devices: 0,
    by_health: {},
    rollup_freshness: 'never',
    dead_letters_24h: 0,
    n_devices_readings_rejected_24h: 0,
    devices: [],
    ...overrides,
  };
}

describe('LiveOps', () => {
  let httpMock: HttpTestingController;

  /**
   * The REAL French strings, not the loader-less keys: the bug was in the
   * rendered sentence, and a key with its parameters dropped cannot show it.
   */
  function render(payload: Record<string, unknown>): ComponentFixture<LiveOps> {
    TestBed.configureTestingModule({
      imports: [LiveOps, TranslateModule.forRoot()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ErrorMessageHandler, useValue: { handleError: vi.fn() } },
      ],
    });
    const translate = TestBed.inject(TranslateService);
    // Cast: the PRIMENG block carries a number (`firstDayOfWeek`), which the
    // strict TranslationObject type does not admit. The strings are what matter.
    translate.setTranslation('fr', fr as unknown as TranslationObject);
    translate.use('fr');
    httpMock = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(LiveOps);
    fixture.detectChanges();
    httpMock.expectOne(`${base}/ops/health`).flush({ data: payload, error_code: 0 });
    fixture.detectChanges();
    return fixture;
  }

  function el(fixture: ComponentFixture<LiveOps>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function byTestId(fixture: ComponentFixture<LiveOps>, id: string): HTMLElement | null {
    return el(fixture).querySelector(`[data-testid="${id}"]`);
  }

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  describe('rollup freshness', () => {
    it.each([
      [
        'explicit nulls, as the backend used to send them',
        { newest_rollup_bucket: null, rollup_age_minutes: null, rollup_lag_minutes: null },
      ],
      ['absent keys, as it sends them now', {}],
    ])('says nothing has been computed yet for %s', (_label, shape) => {
      // BUG: "Chiffres recalculés il y a null minutes". The template tested
      // `!== undefined`, `null` passed, and ngx-translate interpolates null as
      // the text "null".
      const fixture = render(ops(shape));

      expect(byTestId(fixture, 'live-ops__rollup-never')).not.toBeNull();
      expect(byTestId(fixture, 'live-ops__rollup-age')).toBeNull();
      expect(el(fixture).textContent).not.toContain('null');
    });

    it('does not blame the scheduler for a fleet that went quiet', () => {
      // BUG: the age shown was the NEWEST DATA's, not the last recompute's. A
      // quiet fleet stops producing buckets while every tick runs, so the page
      // turned red after 90 minutes of nothing and blamed the rollups.
      const fixture = render(
        ops({
          newest_rollup_bucket: '2026-09-29T05:00:00Z',
          rollup_age_minutes: 300,
          rollup_freshness: 'fresh',
          rollup_lag_minutes: 4.4,
        }),
      );

      expect(byTestId(fixture, 'live-ops__rollup-stale')).toBeNull();
      const age = byTestId(fixture, 'live-ops__rollup-age');
      expect(age?.textContent).toContain('il y a 4 minutes');
      expect(age?.textContent).not.toContain('300');
    });

    it('says so when the scheduler has stopped, with how long it has been', () => {
      const fixture = render(
        ops({
          newest_rollup_bucket: '2026-09-29T05:00:00Z',
          rollup_age_minutes: 130,
          rollup_freshness: 'stale',
          rollup_lag_minutes: 125,
        }),
      );

      const stale = byTestId(fixture, 'live-ops__rollup-stale');
      expect(stale).not.toBeNull();
      expect(stale?.textContent).toContain('125 minutes');
    });

    it('is neutral when there is nothing left to recompute', () => {
      // No bucket inside the 48 h window: the tick has nothing to rewrite, so how
      // long ago it last did says nothing about the scheduler. Never red.
      const fixture = render(
        ops({
          newest_rollup_bucket: '2026-09-20T05:00:00Z',
          rollup_age_minutes: 13_000,
          rollup_freshness: 'idle',
        }),
      );

      expect(byTestId(fixture, 'live-ops__rollup-idle')).not.toBeNull();
      expect(byTestId(fixture, 'live-ops__rollup-stale')).toBeNull();
    });
  });

  describe('the fleet', () => {
    it('never counts a revoked device as needing attention', () => {
      // BUG: revoked devices kept a health state - silent, a day after
      // revocation - and inflated this count for ever.
      const fixture = render(ops({ n_devices: 3, by_health: { revoked: 2, ok: 1 } }));

      expect(byTestId(fixture, 'live-ops__attention-count')?.textContent?.trim()).toBe('0');
      expect(byTestId(fixture, 'live-ops__tag--revoked')).not.toBeNull();
    });

    it('does not call an ingest outage "every device is reporting normally"', () => {
      // UNKNOWN is not per-device attention - the collector is down - so the
      // attention count is 0. That made the page say all was well.
      const fixture = render(ops({ n_devices: 3, by_health: { unknown: 3 } }));

      expect(byTestId(fixture, 'live-ops__all-well')).toBeNull();
      expect(byTestId(fixture, 'live-ops__ingest-down')).not.toBeNull();
    });

    it.each([
      ['a fleet that is entirely revoked', { revoked: 2 }],
      ['a deployment whose devices have never reported', { never_seen: 3 }],
    ])('raises neither banner for %s', (_label, byHealth) => {
      const fixture = render(ops({ n_devices: 3, by_health: byHealth }));

      expect(byTestId(fixture, 'live-ops__all-well')).toBeNull();
      expect(byTestId(fixture, 'live-ops__ingest-down')).toBeNull();
    });

    it('says all is well when it is', () => {
      // The positive control for the three above.
      const fixture = render(ops({ n_devices: 3, by_health: { ok: 3 } }));

      expect(byTestId(fixture, 'live-ops__all-well')).not.toBeNull();
      expect(byTestId(fixture, 'live-ops__ingest-down')).toBeNull();
    });
  });

  describe('what could not be stored', () => {
    it('counts devices whose individual readings were rejected', () => {
      // A rejected READING leaves no dead letter - the rest of its batch was
      // stored - so a capacity mismatch clipping every sunny peak read as
      // "every message was stored".
      const fixture = render(ops({ n_devices: 3, n_devices_readings_rejected_24h: 2 }));

      const line = byTestId(fixture, 'live-ops__readings-rejected');
      expect(line).not.toBeNull();
      expect(line?.textContent).toContain('2');
    });

    it('says when no reading was rejected', () => {
      const fixture = render(ops({ n_devices: 3 }));

      expect(byTestId(fixture, 'live-ops__readings-rejected')).toBeNull();
      expect(byTestId(fixture, 'live-ops__readings-rejected-none')).not.toBeNull();
    });
  });
});
