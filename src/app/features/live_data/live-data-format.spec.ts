import de from '../../../assets/i18n/de.json';
import en from '../../../assets/i18n/en.json';
import fr from '../../../assets/i18n/fr.json';
import nl from '../../../assets/i18n/nl.json';
import {
  AbsentReason,
  DeviceHealth,
  LiveDeviceStatus,
  LiveResolution,
  LiveSeriesPoint,
  LiveSummary,
  RollupFreshness,
} from '../../shared/dtos/live-data.dtos';
import {
  HEALTH_ORDER,
  LIVE_CHART_COLORS,
  LIVE_WINDOWS,
  MeterOptionSource,
  REJECT_REASONS,
  absentReason,
  absentReasonLabelKey,
  bucketLabel,
  buildMeterOptions,
  chartEmptyKey,
  deviceStatusLabelKey,
  fleetBanner,
  formatMinutes,
  formatW,
  formatWh,
  gridWithheldForPrivacy,
  ISOLATED_POINT_RADIUS,
  hasAnyExport,
  hasAnyImport,
  hasAnyProduction,
  healthLabelKey,
  healthSeverity,
  isKnownRejectReason,
  isolatedPointRadii,
  meterAddressLine,
  needsAttention,
  offtakeChartLines,
  offtakeEmptyKey,
  productionChartLines,
  rejectHintKey,
  rejectReasonLabelKey,
  sharedYMax,
  sharingCoverage,
  sharingEmptyKey,
  sharingStackSegments,
  toKwh,
} from './live-data-format';

const LOCALES: Record<string, unknown> = { en, fr, nl, de };

function summary(overrides: Partial<LiveSummary> = {}): LiveSummary {
  return {
    indicative: true,
    n_devices: 0,
    n_devices_online: 0,
    n_devices_never_seen: 0,
    n_devices_silent: 0,
    signal: 'neutral',
    rollup_freshness: RollupFreshness.FRESH,
    absent: [],
    ...overrides,
  };
}

/**
 * `Intl` groups French thousands with a NARROW no-break space (U+202F) and some
 * locales with U+00A0. Both are correct and neither is typeable in an assertion,
 * so they are compared as a plain space.
 */
function spaced(value: string | null): string | null {
  return value === null ? null : value.replace(/[\u202f\u00a0]/g, ' ');
}

/** Walk a dot path, returning undefined rather than throwing on a gap. */
function at(dict: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (node, key) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined,
      dict,
    );
}

describe('energy formatting', () => {
  it('renders an absent value as an em dash, never as zero', () => {
    // The whole reason the backend omits a term rather than nulling it. A `0`
    // here would turn "we are not telling you" into "the community produced
    // nothing", which is a claim nobody made.
    expect(formatWh(undefined, 'en')).toBe('—');
    expect(formatW(undefined, 'fr')).toBe('—');
    expect(formatWh(0, 'en')).toBe('0 Wh');
  });

  it('promotes to kWh and MWh', () => {
    expect(formatWh(950, 'en')).toBe('950 Wh');
    expect(formatWh(1500, 'en')).toBe('1.50 kWh');
    expect(formatWh(2_500_000, 'en')).toBe('2.50 MWh');
  });

  it("writes the decimal separator of the reader's language", () => {
    // BUG: `toFixed` always wrote a POINT. In French, Dutch and German "1.50 kWh"
    // reads as one and a half THOUSAND.
    expect(formatWh(1500, 'fr')).toBe('1,50 kWh');
    expect(formatWh(1500, 'nl')).toBe('1,50 kWh');
    expect(formatWh(2_500_000, 'de')).toBe('2,50 MWh');
    expect(formatW(1500, 'fr')).toBe('1,50 kW');
    expect(formatW(1500, 'en')).toBe('1.50 kW');
  });

  it("groups thousands the reader's way", () => {
    expect(spaced(formatWh(1_234_567_000, 'fr'))).toBe('1 234,57 MWh');
    expect(formatWh(1_234_567_000, 'de')).toBe('1.234,57 MWh');
    expect(formatWh(1_234_567_000, 'en')).toBe('1,234.57 MWh');
  });

  it('writes whole minutes, in the reader language, and nothing at all for no value', () => {
    // The Ops tab once rendered "null minutes": a missing age must render as
    // nothing, and a present one as a whole, localised number.
    expect(formatMinutes(4.4, 'fr')).toBe('4');
    expect(spaced(formatMinutes(1234.6, 'fr'))).toBe('1 235');
    expect(formatMinutes(1234.6, 'en')).toBe('1,235');
    expect(formatMinutes(0.2, 'fr')).toBe('1');
    expect(formatMinutes(null, 'fr')).toBeNull();
    expect(formatMinutes(undefined, 'fr')).toBeNull();
  });

  it('keeps an absent chart point as a gap, not a zero', () => {
    // chart.js draws `null` as a break in the line and `0` as a point on the
    // axis. Closing the gap would draw a picture of data that does not exist.
    expect(toKwh(undefined)).toBeNull();
    expect(toKwh(0)).toBe(0);
    expect(toKwh(1500)).toBe(1.5);
  });
});

describe('absent terms', () => {
  it('finds the reason a term is missing', () => {
    const data = summary({
      absent: [{ term: 'import_wh', reason: AbsentReason.BELOW_K_THRESHOLD }],
    });
    expect(absentReason(data.absent, 'import_wh')).toBe('below_k_threshold');
    expect(absentReason(data.absent, 'production_wh')).toBeUndefined();
  });

  it('distinguishes withheld-for-privacy from not-measured', () => {
    // Different sentences with different remedies: one is about the community's
    // size, the other about the hardware.
    const withheld = summary({
      absent: [{ term: 'import_wh', reason: AbsentReason.BELOW_K_THRESHOLD }],
    });
    const unmeasured = summary({
      absent: [{ term: 'import_wh', reason: AbsentReason.NOT_MEASURED }],
    });
    expect(gridWithheldForPrivacy(withheld)).toBe(true);
    expect(gridWithheldForPrivacy(unmeasured)).toBe(false);
  });

  it('gives an unknown reason a real key rather than the raw string', () => {
    // The backend is versioned separately. A reason it adds tomorrow must not
    // render `some_new_reason` to the user.
    expect(absentReasonLabelKey('something_this_build_has_never_seen')).toBe(
      'LIVE_DATA.ABSENT.UNKNOWN',
    );
  });
});

describe('device health', () => {
  it('flags a device that is connected and sending zeros as DANGER', () => {
    // The state that most needs to shout. It looks healthy on every other
    // signal, and it is what a meter whose P1 port the grid operator has not
    // activated looks like.
    expect(healthSeverity(DeviceHealth.REPORTING_ZEROS)).toBe('danger');
  });

  it('does not ask an operator to act on an ingest outage', () => {
    // UNKNOWN means the collection path itself is down, so nothing can be
    // concluded about any device — flagging forty of them would bury the one
    // signal that matters.
    expect(needsAttention(DeviceHealth.UNKNOWN)).toBe(false);
    expect(needsAttention(DeviceHealth.OK)).toBe(false);
    expect(needsAttention(DeviceHealth.REPORTING_ZEROS)).toBe(true);
    expect(needsAttention(DeviceHealth.SILENT)).toBe(true);
  });

  it('orders the states worst-first', () => {
    expect(HEALTH_ORDER[0]).toBe(DeviceHealth.REPORTING_ZEROS);
    expect(HEALTH_ORDER.at(-1)).toBe(DeviceHealth.OK);
    expect(new Set(HEALTH_ORDER).size).toBe(Object.keys(DeviceHealth).length);
  });

  it('falls back rather than rendering a state this build does not know', () => {
    expect(healthSeverity('some_future_state')).toBe('secondary');
    expect(healthLabelKey('some_future_state')).toBe('LIVE_DATA.HEALTH.UNKNOWN');
  });

  it('never asks anyone to act on a revoked device', () => {
    // BUG: a revoked device kept the health its last report implied - silent,
    // a day later - and counted as needing attention for ever.
    expect(needsAttention(DeviceHealth.REVOKED)).toBe(false);
    expect(healthSeverity(DeviceHealth.REVOKED)).toBe('secondary');
    expect(HEALTH_ORDER).toContain(DeviceHealth.REVOKED);
  });
});

describe('the fleet banner', () => {
  it('reports an ingest outage as one, not as "all well"', () => {
    // UNKNOWN is not per-device attention, so the attention count is zero - and
    // the page used to say every device was reporting normally.
    expect(fleetBanner({ unknown: 3 })).toBe('ingest-down');
    expect(fleetBanner({ unknown: 1, ok: 2 })).toBe('ingest-down');
  });

  it('says all is well only when something is actually reporting', () => {
    expect(fleetBanner({ ok: 3 })).toBe('all-well');
    expect(fleetBanner({ ok: 1, revoked: 2 })).toBe('all-well');
    expect(fleetBanner({ revoked: 2 })).toBeNull();
    expect(fleetBanner({ never_seen: 3 })).toBeNull();
    expect(fleetBanner({ ok: 2, silent: 1 })).toBeNull();
    expect(fleetBanner({})).toBeNull();
  });
});

describe('rejected readings', () => {
  it('mirrors every reason the backend can reject with', () => {
    // live-data/domain/reasons.py, both scopes. The protocol is frozen at v1, so
    // this list only changes with a protocol version - and then it must.
    expect([...REJECT_REASONS].sort()).toEqual(
      [
        'schema_invalid',
        'unknown_field',
        'batch_too_large',
        'duplicate_ts_in_batch',
        'device_unknown',
        'device_revoked',
        'community_mismatch',
        'ts_in_future',
        'ts_too_old',
        'ts_not_aligned',
        'negative_energy',
        'over_device_ceiling',
        'implausible_production',
      ].sort(),
    );
  });

  it('gives an unknown reason a real key, and says it is unknown', () => {
    expect(rejectReasonLabelKey('implausible_production')).toBe(
      'LIVE_DATA.REJECT_REASON.IMPLAUSIBLE_PRODUCTION',
    );
    expect(rejectReasonLabelKey('a_reason_from_the_future')).toBe(
      'LIVE_DATA.REJECT_REASON.UNKNOWN',
    );
    expect(isKnownRejectReason('ts_too_old')).toBe(true);
    expect(isKnownRejectReason('a_reason_from_the_future')).toBe(false);
  });

  it('explains implausible production while it is recent, and only then', () => {
    const now = Date.parse('2026-09-29T12:00:00Z');
    const hint = 'LIVE_DATA.DEVICES.REJECT_CAPACITY_HINT';
    expect(rejectHintKey('implausible_production', '2026-09-29T11:00:00Z', now)).toBe(hint);
    // A consumption device's timestamp is withheld: the hint still applies.
    expect(rejectHintKey('implausible_production', undefined, now)).toBe(hint);
    expect(rejectHintKey('implausible_production', '2026-09-20T11:00:00Z', now)).toBeNull();
    expect(rejectHintKey('ts_too_old', '2026-09-29T11:00:00Z', now)).toBeNull();
    expect(rejectHintKey(undefined, undefined, now)).toBeNull();
  });
});

describe('bucket labels', () => {
  it('labels a day bucket by its BRUSSELS date, not the browser zone', () => {
    // A day bucket is the instant of Brussels midnight, which in UTC is 22:00 or
    // 23:00 of the PREVIOUS day. Formatting it in the reader's own zone would
    // label 1 July as "30 June" for everyone west of Brussels.
    const julyFirstLocalMidnight = '2026-06-30T22:00:00Z';
    expect(bucketLabel(julyFirstLocalMidnight, LiveResolution.DAY, 'en-GB')).toBe('01/07');
  });

  it('the naive reading would disagree', () => {
    // NEGATIVE CONTROL. Without it the assertion above passes for any timezone,
    // including UTC, and asserts nothing about Brussels.
    const julyFirstLocalMidnight = '2026-06-30T22:00:00Z';
    const naive = new Date(julyFirstLocalMidnight).toLocaleDateString('en-GB', {
      timeZone: 'UTC',
      day: '2-digit',
      month: '2-digit',
    });
    expect(naive).toBe('30/06');
  });

  it('returns the raw value for an unparseable bucket rather than NaN', () => {
    expect(bucketLabel('not-a-date', LiveResolution.HOUR, 'en')).toBe('not-a-date');
  });
});

const B1 = '2026-10-04T08:45:00Z';
const B2 = '2026-10-04T09:00:00Z';

describe('series emptiness', () => {
  it('treats a series whose production is entirely absent as empty', () => {
    // Rendered, such a series is a flat line at zero — which reads as "the
    // community produced nothing" rather than "nothing was measured".
    expect(hasAnyProduction([{ bucket: '2026-01-01T00:00:00Z', n_devices: 1 }])).toBe(false);
    expect(
      hasAnyProduction([{ bucket: '2026-01-01T00:00:00Z', n_devices: 1, production_wh: 0 }]),
    ).toBe(true);
  });

  it('counts a zero export or import as published, and an absent one as not', () => {
    const night: LiveSeriesPoint = { bucket: B1, n_devices: 1, export_wh: 0, import_wh: 0 };
    expect(hasAnyExport([night])).toBe(true);
    expect(hasAnyImport([night])).toBe(true);
    expect(hasAnyExport([{ bucket: B1, n_devices: 1 }])).toBe(false);
    expect(hasAnyImport([{ bucket: B1, n_devices: 1 }])).toBe(false);
  });
});

/** A prosumer community: net meters, so no production term at all (protocol 3.4). */
const PROSUMERS: LiveSeriesPoint[] = [
  { bucket: B1, n_devices: 3, import_wh: 46, export_wh: 55 },
  { bucket: B2, n_devices: 3, import_wh: 564.9, export_wh: 362.3 },
];

/** The same community below k: the grid terms are withheld, production is not there. */
const PROSUMERS_BELOW_K: LiveSeriesPoint[] = [
  { bucket: B1, n_devices: 3 },
  { bucket: B2, n_devices: 3 },
];

describe('production chart lines', () => {
  it('draws the export, and no production line, for a community of prosumers', () => {
    // The reported bug: three prosumers and an empty chart. Their meters cannot
    // see production, and protocol 3.4 says the views show the export instead.
    const lines = productionChartLines(PROSUMERS);
    expect(lines.map((line) => line.labelKey)).toEqual(['LIVE_DATA.CHART.EXPORT']);
    expect(lines[0].values).toEqual([0.055, 0.362]);
    expect(lines[0].color).toBe(LIVE_CHART_COLORS.export);
    expect(lines[0].fill).toBe(false);
  });

  it('draws production first and filled, then the export, for pure-injection sites', () => {
    const lines = productionChartLines([
      { bucket: B1, n_devices: 1, production_wh: 2600, export_wh: 2600, import_wh: 0 },
    ]);
    expect(lines.map((line) => line.labelKey)).toEqual([
      'LIVE_DATA.CHART.PRODUCTION',
      'LIVE_DATA.CHART.EXPORT',
    ]);
    expect(lines[0].fill).toBe(true);
    expect(lines[0].color).toBe(LIVE_CHART_COLORS.production);
    expect(lines[0].absentKey).toBe('LIVE_DATA.ABSENT.NOT_MEASURED');
  });

  it('keeps a withheld bucket as a gap, never a zero, and says why in the tooltip', () => {
    const lines = productionChartLines([
      { bucket: B1, n_devices: 1, production_wh: 500 },
      { bucket: B2, n_devices: 3, production_wh: 700, export_wh: 900 },
    ]);
    expect(lines[0].values).toEqual([0.5, 0.7]);
    expect(lines[1].values).toEqual([null, 0.9]);
    expect(lines[1].absentKey).toBe('LIVE_DATA.CHART.WITHHELD');
  });

  it('draws nothing at all for a prosumer community below k', () => {
    expect(productionChartLines(PROSUMERS_BELOW_K)).toEqual([]);
  });
});

describe('offtake chart lines', () => {
  it('draws the import as the grid offtake, in its own colour', () => {
    const lines = offtakeChartLines(PROSUMERS);
    expect(lines.map((line) => line.labelKey)).toEqual(['LIVE_DATA.CHART.OFFTAKE']);
    expect(lines[0].values).toEqual([0.046, 0.565]);
    expect(lines[0].color).toBe(LIVE_CHART_COLORS.offtake);
    expect(lines[0].absentKey).toBe('LIVE_DATA.CHART.WITHHELD');
  });

  it('draws a consumption-only community, which has no production or export', () => {
    expect(offtakeChartLines([{ bucket: B1, n_devices: 5, import_wh: 300 }])).toHaveLength(1);
  });

  it('draws nothing below k: the offtake is a grid term like the export', () => {
    expect(offtakeChartLines(PROSUMERS_BELOW_K)).toEqual([]);
  });
});

describe('why a chart is empty', () => {
  it('has no reason when there is something to draw', () => {
    expect(chartEmptyKey({ points: PROSUMERS, suppressed_buckets: 0 })).toBeNull();
    expect(offtakeEmptyKey({ points: PROSUMERS, suppressed_buckets: 0 })).toBeNull();
  });

  it('says "nothing measured" for a series with no points', () => {
    expect(chartEmptyKey({ points: [], suppressed_buckets: 0 })).toBe('LIVE_DATA.CHART.EMPTY');
    expect(offtakeEmptyKey({ points: [], suppressed_buckets: 0 })).toBe('LIVE_DATA.CHART.EMPTY');
  });

  it('names net meters below k rather than "nothing measured" on the production chart', () => {
    // The readings ARE there. Telling a manager nothing was measured sends them
    // to the hardware, when the remedy is members.
    expect(chartEmptyKey({ points: PROSUMERS_BELOW_K, suppressed_buckets: 2 })).toBe(
      'LIVE_DATA.CHART.EMPTY_WITHHELD',
    );
  });

  it('gives the privacy reason on the offtake chart below k', () => {
    expect(offtakeEmptyKey({ points: PROSUMERS_BELOW_K, suppressed_buckets: 2 })).toBe(
      'LIVE_DATA.ABSENT.BELOW_K_THRESHOLD',
    );
  });

  it('is not withheld when production is drawn, whatever k suppressed', () => {
    expect(
      chartEmptyKey({
        points: [{ bucket: B1, n_devices: 1, production_wh: 10 }],
        suppressed_buckets: 1,
      }),
    ).toBeNull();
  });
});

describe('isolated point markers', () => {
  it('marks only a value with a gap or an edge on both sides', () => {
    // The first hour a community reaches k sits between withheld hours: without
    // a marker it has no segment and draws nothing at all.
    const r = ISOLATED_POINT_RADIUS;
    expect(isolatedPointRadii([null, 1.4, null])).toEqual([0, r, 0]);
    expect(isolatedPointRadii([null, null, 1.4])).toEqual([0, 0, r]);
    expect(isolatedPointRadii([2])).toEqual([r]);
  });

  it('leaves a drawn line without markers, zero values included', () => {
    expect(isolatedPointRadii([0, 0.5, null, 1, 0])).toEqual([0, 0, 0, 0, 0]);
    expect(isolatedPointRadii([])).toEqual([]);
  });
});

describe('the stacked sharing chart (D-14)', () => {
  const point = (values: Partial<LiveSeriesPoint>): LiveSeriesPoint => ({
    bucket: B1,
    n_devices: 3,
    ...values,
  });

  it('splits the offtake and the injection around the same shared energy', () => {
    const segments = sharingStackSegments([
      point({ import_wh: 300, export_wh: 700, shared_wh: 250 }),
    ]);
    expect(segments.map((s) => [s.stack, s.labelKey, s.values])).toEqual([
      ['offtake', 'LIVE_DATA.SHARING.OFFTAKE_SHARED', [0.25]],
      ['offtake', 'LIVE_DATA.SHARING.OFFTAKE_SUPPLIER', [0.05]],
      ['injection', 'LIVE_DATA.SHARING.INJECTION_SHARED', [0.25]],
      ['injection', 'LIVE_DATA.SHARING.INJECTION_GRID', [0.45]],
    ]);
    // One quantity seen from both sides: one colour.
    expect(segments[0].color).toBe(segments[2].color);
    expect(segments[0].color).toBe(LIVE_CHART_COLORS.shared);
  });

  it('leaves a withheld bucket empty in every segment, never a zero bar', () => {
    const segments = sharingStackSegments([
      point({ import_wh: 100, export_wh: 100, shared_wh: 100 }),
      point({ bucket: B2, production_wh: 40 }),
    ]);
    expect(segments.every((s) => s.values[1] === null)).toBe(true);
  });

  it('never draws a negative remainder', () => {
    const [, supplier, , grid] = sharingStackSegments([
      point({ import_wh: 100, export_wh: 100, shared_wh: 100.0004 }),
    ]);
    expect(supplier.values).toEqual([0]);
    expect(grid.values).toEqual([0]);
  });

  it('draws nothing when no bucket carries a shared figure', () => {
    expect(sharingStackSegments([point({ production_wh: 10 })])).toEqual([]);
  });

  it('gives the privacy reason when the shared figure was withheld', () => {
    expect(sharingEmptyKey({ points: [point({ production_wh: 1 })], suppressed_buckets: 1 })).toBe(
      'LIVE_DATA.ABSENT.BELOW_K_THRESHOLD',
    );
    expect(sharingEmptyKey({ points: [], suppressed_buckets: 0 })).toBe('LIVE_DATA.CHART.EMPTY');
  });

  it('counts the coverage for one operation, or every operation summed', () => {
    const operations = [
      { id: 1, name: 'A', n_devices: 2, n_meters: 5 },
      { id: 2, name: 'B', n_devices: 1, n_meters: 1 },
    ];
    expect(sharingCoverage(operations, null)).toEqual({ devices: 3, meters: 6 });
    expect(sharingCoverage(operations, 2)).toEqual({ devices: 1, meters: 1 });
  });

  it('gives the four quantities four different colours', () => {
    expect(new Set(Object.values(LIVE_CHART_COLORS)).size).toBe(4);
  });
});

describe('shared y-axis maximum', () => {
  it('is the largest of production, export and import, in kWh', () => {
    expect(sharedYMax(PROSUMERS)).toBe(0.565);
    expect(sharedYMax([{ bucket: B1, n_devices: 1, production_wh: 2600, import_wh: 3 }])).toBe(2.6);
  });

  it('is undefined when nothing is drawn, so chart.js picks its own scale', () => {
    expect(sharedYMax(PROSUMERS_BELOW_K)).toBeUndefined();
    expect(sharedYMax([])).toBeUndefined();
  });
});

describe('query windows', () => {
  it('stays inside the backend caps at every resolution', () => {
    // The backend answers 422 for a window over its cap. These three are the
    // only windows the UI can request, so the selector must not be able to
    // produce one — 96, 168 and 30 points against caps of 2976, 1464 and 731.
    const points: Record<string, number> = { quarter: 96, hour: 168, day: 30 };
    const caps: Record<string, number> = { quarter: 2976, hour: 1464, day: 731 };
    for (const window of LIVE_WINDOWS) {
      expect(points[window.resolution]).toBeLessThanOrEqual(caps[window.resolution]);
    }
  });
});

describe('meter options for a new device', () => {
  // The seeded wind meters of crm-backend/tests/sql/init.sql.
  const W1 = '541448200000000001';
  const W2 = '541448200000000002';
  const W3 = '541448200000000003';
  const W4 = '541448200000000004';

  function meter(EAN: string, overrides: Partial<MeterOptionSource> = {}): MeterOptionSource {
    return {
      EAN,
      address: { street: 'Wind Alley', number: '10', postcode: '1000', city: 'Brussels' },
      holder: { name: 'Wind Producer Alpha' },
      ...overrides,
    };
  }

  function device(
    ean: string,
    status: LiveDeviceStatus,
  ): { ean: string; status: LiveDeviceStatus } {
    return { ean, status };
  }

  it('labels a meter EAN · address · holder', () => {
    const [option] = buildMeterOptions([meter(W1)], []);
    expect(option).toEqual({
      ean: W1,
      label: `${W1} · Wind Alley 10, 1000 Brussels · Wind Producer Alpha`,
      address: 'Wind Alley 10, 1000 Brussels',
      holder: 'Wind Producer Alpha',
      detail: 'Wind Alley 10, 1000 Brussels · Wind Producer Alpha',
      disabled: false,
    });
  });

  it('keeps the supplement, which is what tells meters in one building apart', () => {
    // `AddressPipe` drops it - and returns HTML - which is why it is not reused.
    const address = {
      street: 'Rue de la Station',
      number: '12',
      supplement: 'bte 3',
      postcode: '4000',
      city: 'Liège',
    };
    expect(meterAddressLine(address)).toBe('Rue de la Station 12 bte 3, 4000 Liège');
    expect(buildMeterOptions([meter(W1, { address })], [])[0].label).toBe(
      `${W1} · Rue de la Station 12 bte 3, 4000 Liège · Wind Producer Alpha`,
    );
  });

  it('drops a missing part rather than printing "undefined" or "null"', () => {
    const [noHolder, nullAddress, noAddress, nothing] = buildMeterOptions(
      [
        meter(W1, { holder: undefined }),
        meter(W2, { address: null }),
        meter(W3, { address: undefined, holder: { name: null } }),
        { EAN: W4 },
      ],
      [],
    );
    expect(noHolder.label).toBe(`${W1} · Wind Alley 10, 1000 Brussels`);
    expect(noHolder.holder).toBeNull();
    expect(nullAddress.label).toBe(`${W2} · Wind Producer Alpha`);
    expect(nullAddress.address).toBeNull();
    expect(noAddress.label).toBe(W3);
    expect(noAddress.detail).toBeNull();
    expect(nothing.label).toBe(W4);
    expect(nothing.detail).toBeNull();
    for (const option of [noHolder, nullAddress, noAddress, nothing]) {
      expect(option.label).not.toMatch(/undefined|null/);
    }
    expect(meterAddressLine(null)).toBeNull();
    expect(meterAddressLine({})).toBeNull();
  });

  it('trims blank strings away', () => {
    const [option] = buildMeterOptions(
      [
        meter(` ${W1} `, {
          address: { street: ' Wind Alley ', number: '10', postcode: '1000', city: '  ' },
          holder: { name: '   ' },
        }),
      ],
      [],
    );
    expect(option.ean).toBe(W1);
    expect(option.label).toBe(`${W1} · Wind Alley 10, 1000`);
    expect(option.holder).toBeNull();
  });

  it('disables a meter a PENDING or ACTIVE device holds', () => {
    const options = buildMeterOptions(
      [meter(W1), meter(W2)],
      [device(W1, LiveDeviceStatus.PENDING), device(W2, LiveDeviceStatus.ACTIVE)],
    );
    expect(options.map((option) => option.disabled)).toEqual([true, true]);
  });

  it('leaves a meter whose only device is REVOKED pickable', () => {
    // A revoked device frees its EAN: the backend's partial unique index and
    // its duplicate check both skip REVOKED.
    const [option] = buildMeterOptions([meter(W1)], [device(W1, LiveDeviceStatus.REVOKED)]);
    expect(option.disabled).toBe(false);
  });

  it('disables a meter with a REVOKED device AND a newer PENDING one, in either order', () => {
    // An EAN -> status map would keep whichever row came last and, half the
    // time, offer a meter the server then refuses with a 409.
    for (const devices of [
      [device(W1, LiveDeviceStatus.REVOKED), device(W1, LiveDeviceStatus.PENDING)],
      [device(W1, LiveDeviceStatus.PENDING), device(W1, LiveDeviceStatus.REVOKED)],
    ]) {
      expect(buildMeterOptions([meter(W1)], devices)[0].disabled).toBe(true);
    }
  });

  it('disables on a status this build has never seen, as the server would', () => {
    // live-data blocks on `status != REVOKED`, so an unknown status blocks.
    const [option] = buildMeterOptions([meter(W1)], [device(W1, 4 as LiveDeviceStatus)]);
    expect(option.disabled).toBe(true);
  });

  it('never invents an option for a device whose meter is not listed', () => {
    const options = buildMeterOptions([meter(W1)], [device(W2, LiveDeviceStatus.ACTIVE)]);
    expect(options.map((option) => option.ean)).toEqual([W1]);
  });

  it('lists a meter once, even when the CRM sends it twice', () => {
    const options = buildMeterOptions([meter(W1), meter(W2), meter(W1)], []);
    expect(options.map((option) => option.ean)).toEqual([W1, W2]);
  });

  it('returns nothing for nothing', () => {
    expect(buildMeterOptions([], [])).toEqual([]);
    expect(buildMeterOptions([], [device(W1, LiveDeviceStatus.ACTIVE)])).toEqual([]);
  });

  it('puts pickable meters first, each half in the order the CRM sent', () => {
    const options = buildMeterOptions(
      [meter(W1), meter(W2), meter(W3), meter(W4)],
      [device(W1, LiveDeviceStatus.ACTIVE), device(W3, LiveDeviceStatus.PENDING)],
    );
    expect(options.map((option) => option.ean)).toEqual([W2, W4, W1, W3]);
  });

  it('starts every label with its EAN', () => {
    // The e2e contract: PrimeNG copies the label onto the option `<li>` as its
    // `aria-label`, and live-data-device-enrol, live-data-device-token and
    // live-data-device-revoke all pick a meter by `[aria-label^="<EAN>"]`.
    const options = buildMeterOptions(
      [meter(W1), meter(W2, { address: null }), meter(W3, { holder: null }), { EAN: W4 }],
      [device(W2, LiveDeviceStatus.ACTIVE)],
    );
    expect(options).toHaveLength(4);
    for (const option of options) {
      expect(option.label.startsWith(option.ean)).toBe(true);
    }
  });
});

describe('i18n coverage', () => {
  /**
   * Every key these helpers can return, and every key the BACKEND can return in
   * a device's `hint`.
   *
   * The hint keys are the load-bearing half. `/ops/health` and
   * `/devices/{id}/diagnostics` answer with `hint: "LIVE.HINT.P1_NOT_ENABLED"`
   * and nothing else in the platform renders it — the backend deliberately does
   * NOT translate it, unlike an error message, because this is a paragraph of
   * installer guidance that belongs with the UI. A missing key here prints the
   * raw path under a broken device, with no error anywhere.
   *
   * Mirrors `live-data/domain/device_health.py::HINTS`.
   */
  const HINT_KEYS = [
    'LIVE.HINT.OK',
    'LIVE.HINT.NEVER_SEEN',
    'LIVE.HINT.SILENT',
    'LIVE.HINT.OFFLINE',
    'LIVE.HINT.P1_NOT_ENABLED',
    'LIVE.HINT.INGEST_DOWN',
    'LIVE.HINT.REVOKED',
  ];

  const helperKeys = [
    ...Object.values(DeviceHealth).map(healthLabelKey),
    ...Object.values(AbsentReason).map(absentReasonLabelKey),
    absentReasonLabelKey('unknown-on-purpose'),
    ...REJECT_REASONS.map(rejectReasonLabelKey),
    rejectReasonLabelKey('unknown-on-purpose'),
    'LIVE_DATA.DEVICES.REJECT_CAPACITY_HINT',
    ...[LiveDeviceStatus.PENDING, LiveDeviceStatus.ACTIVE, LiveDeviceStatus.REVOKED].map(
      deviceStatusLabelKey,
    ),
    ...LIVE_WINDOWS.map((window) => window.labelKey),
  ];

  it('has a non-empty string for every key these helpers return, in every locale', () => {
    for (const key of new Set(helperKeys)) {
      for (const [code, dict] of Object.entries(LOCALES)) {
        const value = at(dict, key);
        expect(
          typeof value === 'string' && value.trim().length > 0,
          `${key} is missing from ${code}.json`,
        ).toBe(true);
      }
    }
  });

  it('has a non-empty string for every hint the backend can emit, in every locale', () => {
    for (const key of HINT_KEYS) {
      for (const [code, dict] of Object.entries(LOCALES)) {
        const value = at(dict, key);
        expect(
          typeof value === 'string' && value.trim().length > 0,
          `${key} is missing from ${code}.json`,
        ).toBe(true);
      }
    }
  });

  it('names the grid operator in the P1 hint', () => {
    // Section 11.2 calls this the single most likely cause of a silent meter,
    // and it is the one an installer cannot diagnose on site: the hardware is
    // fine, the wiring is fine, and the port is closed. The hint has to say so
    // or the support call happens anyway.
    expect(at(en, 'LIVE.HINT.P1_NOT_ENABLED')).toContain('grid operator');
    expect(at(fr, 'LIVE.HINT.P1_NOT_ENABLED')).toContain('gestionnaire de réseau');
    expect(at(nl, 'LIVE.HINT.P1_NOT_ENABLED')).toContain('netbeheerder');
    expect(at(de, 'LIVE.HINT.P1_NOT_ENABLED')).toContain('Netzbetreiber');
  });

  it('has the deactivation copy in every locale', () => {
    // Neither key is returned by a helper above: one is the hub's toast when the
    // subscription is switched off mid-session, the other is appended to the
    // unsubscribe confirmation by the catalog's `unsubscribeWarningKey`. A gap
    // prints the raw path in a toast or a confirm dialog, with no error anywhere.
    for (const key of [
      'LIVE_DATA.SUBSCRIPTION_LOST',
      'ANNEXES_SERVICES.LIVE_DATA.UNSUBSCRIBE_WARNING',
    ]) {
      for (const [code, dict] of Object.entries(LOCALES)) {
        const value = at(dict, key);
        expect(
          typeof value === 'string' && value.trim().length > 0,
          `${key} is missing from ${code}.json`,
        ).toBe(true);
      }
    }
  });

  it('has the keys only a template uses, in every locale', () => {
    // No helper returns these, so nothing above would notice one missing - or
    // one filed under a same-named key elsewhere (`NAVBAR.LIVE_DATA`,
    // `ANNEXES_SERVICES.LIVE_DATA`, the `TABS.OPS` string).
    for (const key of [
      'LIVE_DATA.OPS.ROLLUP_IDLE',
      'LIVE_DATA.OPS.REJECTIONS',
      'LIVE_DATA.OPS.READINGS_REJECTED',
      'LIVE_DATA.OPS.READINGS_REJECTED_NONE',
      'LIVE_DATA.OPS.INGEST_DOWN',
      'LIVE_DATA.DEVICES.LAST_REJECT',
      // The "Add device" meter picker. The parity test below cannot catch a
      // key missing from all four files at once.
      'LIVE_DATA.CREATE.EAN_FILTER_PLACEHOLDER',
      'LIVE_DATA.CREATE.EAN_HINT',
      'LIVE_DATA.CREATE.EAN_EMPTY',
      'LIVE_DATA.CREATE.EAN_LOAD_ERROR',
      'LIVE_DATA.CREATE.EAN_TRUNCATED',
      'LIVE_DATA.CREATE.EAN_DEVICES_UNKNOWN',
      'LIVE_DATA.CREATE.EAN_HAS_DEVICE',
    ]) {
      for (const [code, dict] of Object.entries(LOCALES)) {
        const value = at(dict, key);
        expect(
          typeof value === 'string' && value.trim().length > 0,
          `${key} is missing from ${code}.json`,
        ).toBe(true);
      }
    }
  });

  it('keeps both counts in the truncation notice, in every locale', () => {
    // ngx-translate prints a placeholder it cannot fill as the raw `{{…}}`. A
    // renamed one would put "{{shown}}" in front of a manager, with no error.
    for (const [code, dict] of Object.entries(LOCALES)) {
      const value = at(dict, 'LIVE_DATA.CREATE.EAN_TRUNCATED');
      expect(value, code).toContain('{{shown}}');
      expect(value, code).toContain('{{total}}');
    }
  });

  it('defines the same LIVE_DATA keys in every language', () => {
    const flatten = (node: unknown, prefix = ''): string[] => {
      if (!node || typeof node !== 'object') return [prefix];
      return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
        flatten(value, prefix ? `${prefix}.${key}` : key),
      );
    };
    const reference = flatten(at(en, 'LIVE_DATA')).sort();
    expect(reference.length).toBeGreaterThan(50);
    for (const [code, dict] of Object.entries(LOCALES)) {
      expect(flatten(at(dict, 'LIVE_DATA')).sort(), code).toEqual(reference);
    }
  });
});
