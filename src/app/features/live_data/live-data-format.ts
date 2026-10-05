import { AddressDTO } from '../../shared/dtos/address.dtos';
import {
  AbsentReason,
  AbsentTerm,
  DeviceHealth,
  LiveDevice,
  LiveOperation,
  LiveDeviceStatus,
  LiveResolution,
  LiveSeries,
  LiveSeriesPoint,
  LiveSummary,
} from '../../shared/dtos/live-data.dtos';

/**
 * Pure presentation helpers for the live-data annex. No Angular, no HTTP - so
 * the rules below are unit-testable without a fixture, and
 * `live-data-format.spec.ts` is where the i18n parity assertion lives.
 */

// ---------------------------------------------------------------------------
// Energy
// ---------------------------------------------------------------------------

/**
 * A number in the reader's language, with exactly `digits` decimals.
 *
 * `locale` is the app's language (`fr`, `en`, `nl`, `de`), passed by the caller
 * rather than read here so this stays pure - and REQUIRED, so no caller can
 * quietly fall back to the decimal point every figure here once had. French,
 * Dutch and German write "1,50"; "1.50" reads to them as one and a half
 * THOUSAND.
 */
export function formatNumber(value: number, locale: string, digits: number): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/**
 * Watt-hours to a human string, promoting to kWh and MWh.
 *
 * `undefined` renders as an em dash, NEVER as `0`. The backend omits a term it
 * will not answer rather than nulling it, precisely so this distinction
 * survives to the screen: "we are not telling you" and "the community consumed
 * nothing" are different sentences, and only one of them is true.
 */
export function formatWh(value: number | undefined, locale: string): string {
  return formatScaled(value, locale, 'Wh');
}

/** Watts, same rule. */
export function formatW(value: number | undefined, locale: string): string {
  return formatScaled(value, locale, 'W');
}

function formatScaled(value: number | undefined, locale: string, unit: string): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${formatNumber(value / 1_000_000, locale, 2)} M${unit}`;
  if (abs >= 1_000) return `${formatNumber(value / 1_000, locale, 2)} k${unit}`;
  return `${formatNumber(Math.round(value), locale, 0)} ${unit}`;
}

/**
 * Minutes as a whole, localised number - or `null` when there is none, so the
 * template renders NOTHING rather than the word "null" (which is what
 * ngx-translate makes of a null parameter). Never below 1: "0 minutes ago"
 * reads as a fault, and the age is then under a minute.
 */
export function formatMinutes(minutes: number | null | undefined, locale: string): string | null {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return null;
  return formatNumber(Math.max(1, Math.round(minutes)), locale, 0);
}

/** Wh → kWh for a chart dataset. Keeps `undefined` as a GAP, not a zero. */
export function toKwh(value: number | undefined): number | null {
  if (value === undefined || value === null || Number.isNaN(value)) return null;
  return Number((value / 1000).toFixed(3));
}

// ---------------------------------------------------------------------------
// Absent terms
// ---------------------------------------------------------------------------

/** The reason a named term is missing, or undefined when it is not missing. */
export function absentReason(absent: AbsentTerm[], term: string): string | undefined {
  return absent.find((entry) => entry.term === term)?.reason;
}

/**
 * Keyed by the wire value, not by the enum, and with an explicit fallback.
 *
 * The backend is versioned separately from this app. A reason it adds tomorrow
 * arrives here as a string this build has never seen, and the honest answer is a
 * generic "not available" rather than a crash or a blank — so the lookup is over
 * `string` and the default is a real key.
 */
const ABSENT_REASON_KEYS: Record<string, string> = {
  [AbsentReason.BELOW_K_THRESHOLD]: 'LIVE_DATA.ABSENT.BELOW_K_THRESHOLD',
  [AbsentReason.NOT_MEASURED]: 'LIVE_DATA.ABSENT.NOT_MEASURED',
  [AbsentReason.NO_CONSUMPTION_IN_PHASE_1]: 'LIVE_DATA.ABSENT.NO_CONSUMPTION_IN_PHASE_1',
  [AbsentReason.NO_CLOSED_HOUR_YET]: 'LIVE_DATA.ABSENT.NO_CLOSED_HOUR_YET',
};

export function absentReasonLabelKey(reason: string): string {
  return ABSENT_REASON_KEYS[reason] ?? 'LIVE_DATA.ABSENT.UNKNOWN';
}

/**
 * Whether the grid terms were withheld for PRIVACY on this payload.
 *
 * Distinguished from "not measured" on purpose: the first is a statement about
 * the community's size and has a remedy a manager understands (more members),
 * the second is a statement about the hardware and does not.
 */
export function gridWithheldForPrivacy(summary: LiveSummary): boolean {
  return absentReason(summary.absent, 'import_wh') === String(AbsentReason.BELOW_K_THRESHOLD);
}

// ---------------------------------------------------------------------------
// Device health
// ---------------------------------------------------------------------------

export type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary';

/**
 * `p-tag` severity per device state.
 *
 * `reporting_zeros` is DANGER, not warning, and that is the whole reason this is
 * a hand-written map rather than a generic "bad = warn". A device that is
 * connected and sending looks healthy on every other signal; it is the state
 * that most needs to shout, because the meter has never measured anything and
 * nobody has noticed.
 */
const HEALTH_SEVERITIES: Record<string, TagSeverity> = {
  [DeviceHealth.OK]: 'success',
  [DeviceHealth.REPORTING_ZEROS]: 'danger',
  [DeviceHealth.SILENT]: 'danger',
  [DeviceHealth.NEVER_SEEN]: 'warn',
  [DeviceHealth.OFFLINE]: 'warn',
  [DeviceHealth.UNKNOWN]: 'secondary',
  [DeviceHealth.REVOKED]: 'secondary',
};

export function healthSeverity(health: string): TagSeverity {
  return HEALTH_SEVERITIES[health] ?? 'secondary';
}

const HEALTH_KEYS: Record<string, string> = {
  [DeviceHealth.OK]: 'LIVE_DATA.HEALTH.OK',
  [DeviceHealth.NEVER_SEEN]: 'LIVE_DATA.HEALTH.NEVER_SEEN',
  [DeviceHealth.SILENT]: 'LIVE_DATA.HEALTH.SILENT',
  [DeviceHealth.OFFLINE]: 'LIVE_DATA.HEALTH.OFFLINE',
  [DeviceHealth.REPORTING_ZEROS]: 'LIVE_DATA.HEALTH.REPORTING_ZEROS',
  [DeviceHealth.UNKNOWN]: 'LIVE_DATA.HEALTH.UNKNOWN',
  [DeviceHealth.REVOKED]: 'LIVE_DATA.HEALTH.REVOKED',
};

export function healthLabelKey(health: string): string {
  return HEALTH_KEYS[health] ?? 'LIVE_DATA.HEALTH.UNKNOWN';
}

/**
 * Ordered worst-first, so the fleet summary reads as a triage list. REVOKED sits
 * with the states that need nothing, just before OK.
 */
export const HEALTH_ORDER: readonly string[] = [
  DeviceHealth.REPORTING_ZEROS,
  DeviceHealth.SILENT,
  DeviceHealth.NEVER_SEEN,
  DeviceHealth.OFFLINE,
  DeviceHealth.UNKNOWN,
  DeviceHealth.REVOKED,
  DeviceHealth.OK,
];

/** States that need nothing from an operator. See `needsAttention`. */
const NO_ATTENTION: ReadonlySet<string> = new Set([
  DeviceHealth.OK,
  DeviceHealth.UNKNOWN,
  DeviceHealth.REVOKED,
]);

/**
 * True for a state an operator should act on.
 *
 * An UNKNOWN state is NOT actionable: it means the ingest path itself is down,
 * so nothing can be concluded about the device and flagging forty of them would
 * bury the one signal that matters. Nor is REVOKED: the device was switched off
 * on purpose and can never report again - counting it, as this once did, kept
 * every revoked device "to check" for ever.
 */
export function needsAttention(health: string): boolean {
  return !NO_ATTENTION.has(health);
}

/**
 * The one banner over the fleet breakdown, if any.
 *
 * `ingest-down` whenever a device is UNKNOWN - the backend only says so when the
 * whole fleet went quiet at once, i.e. the collector. It used to be "all well":
 * UNKNOWN needs no per-device attention, so the attention count was zero.
 *
 * `all-well` only when something is actually reporting and nothing needs a
 * look. A fleet that is entirely revoked, or has never reported, is neither.
 */
export function fleetBanner(byHealth: Record<string, number>): 'ingest-down' | 'all-well' | null {
  const count = (state: string): number => byHealth[state] ?? 0;
  if (count(DeviceHealth.UNKNOWN) > 0) return 'ingest-down';
  const attention = Object.keys(byHealth)
    .filter(needsAttention)
    .reduce((total, state) => total + count(state), 0);
  return count(DeviceHealth.OK) > 0 && attention === 0 ? 'all-well' : null;
}

// ---------------------------------------------------------------------------
// Rejected readings
// ---------------------------------------------------------------------------

/**
 * Every reason the backend can reject a message or a reading with.
 *
 * Mirrors `live-data/domain/reasons.py::RejectReason`, both scopes: the
 * protocol is frozen at v1, so this list changes only with a protocol version.
 * `last_reject_reason` can carry any of them.
 */
export const REJECT_REASONS: readonly string[] = [
  // MESSAGE scope - nothing from the message was stored.
  'schema_invalid',
  'unknown_field',
  'batch_too_large',
  'duplicate_ts_in_batch',
  'device_unknown',
  'device_revoked',
  'community_mismatch',
  // MEASUREMENT scope - that reading was dropped, the rest of its batch stored.
  'ts_in_future',
  'ts_too_old',
  'ts_not_aligned',
  'negative_energy',
  'over_device_ceiling',
  'implausible_production',
];

export function isKnownRejectReason(reason: string): boolean {
  return REJECT_REASONS.includes(reason);
}

/**
 * Keyed by the wire value, with a real fallback key: the worker is deployed
 * separately, and a reason it adds tomorrow must render as "unrecognised", not
 * as a raw i18n path.
 */
export function rejectReasonLabelKey(reason: string): string {
  return isKnownRejectReason(reason)
    ? `LIVE_DATA.REJECT_REASON.${reason.toUpperCase()}`
    : 'LIVE_DATA.REJECT_REASON.UNKNOWN';
}

const HINT_WINDOW_MS = 24 * 3_600_000;

/**
 * The explanation shown under a device whose production readings are being
 * rejected as implausible - while it is recent.
 *
 * `implausible_production` fires above the declared kVA or during the night
 * window. The first is the likely one: a `capacity_kva` smaller than the real
 * inverter drops exactly the sunny peaks, and the chart just looks overcast.
 * A missing timestamp - a consumption device's is withheld - still shows it.
 */
export function rejectHintKey(
  reason: string | undefined,
  rejectedAt: string | undefined,
  nowMs: number,
): string | null {
  if (reason !== 'implausible_production') return null;
  if (rejectedAt) {
    const at = Date.parse(rejectedAt);
    if (!Number.isNaN(at) && nowMs - at > HINT_WINDOW_MS) return null;
  }
  return 'LIVE_DATA.DEVICES.REJECT_CAPACITY_HINT';
}

const DEVICE_STATUS_KEYS: Record<number, string> = {
  [LiveDeviceStatus.PENDING]: 'LIVE_DATA.DEVICE_STATUS.PENDING',
  [LiveDeviceStatus.ACTIVE]: 'LIVE_DATA.DEVICE_STATUS.ACTIVE',
  [LiveDeviceStatus.REVOKED]: 'LIVE_DATA.DEVICE_STATUS.REVOKED',
};

export function deviceStatusLabelKey(status: LiveDeviceStatus): string {
  return DEVICE_STATUS_KEYS[status] ?? 'LIVE_DATA.DEVICE_STATUS.PENDING';
}

const DEVICE_STATUS_SEVERITIES: Record<number, TagSeverity> = {
  [LiveDeviceStatus.ACTIVE]: 'success',
  [LiveDeviceStatus.PENDING]: 'warn',
  [LiveDeviceStatus.REVOKED]: 'secondary',
};

export function deviceStatusSeverity(status: LiveDeviceStatus): TagSeverity {
  return DEVICE_STATUS_SEVERITIES[status] ?? 'secondary';
}

// ---------------------------------------------------------------------------
// Meter options for a new device
// ---------------------------------------------------------------------------

/**
 * What the picker needs from a CRM meter. Narrower than `PartialMeterDTO` (which
 * is assignable to it), so a spec need not invent a meter number or a status.
 */
export interface MeterOptionSource {
  EAN: string;
  address?: Partial<
    Pick<AddressDTO, 'street' | 'number' | 'supplement' | 'postcode' | 'city'>
  > | null;
  holder?: { name?: string | null } | null;
}

export interface LiveMeterOption {
  /** The select's value, and exactly what `POST /devices` receives. */
  readonly ean: string;
  /**
   * `EAN · address · holder` - the filter haystack AND the option's
   * `aria-label` (PrimeNG copies the option label onto the `<li>`), so it
   * always STARTS with the EAN: the e2e scenarios select on `aria-label^=EAN`.
   */
  readonly label: string;
  readonly address: string | null;
  readonly holder: string | null;
  /** `address · holder`, the muted second line; null when the CRM gave neither. */
  readonly detail: string | null;
  /** A PENDING or ACTIVE device already holds this EAN. */
  readonly disabled: boolean;
}

const OPTION_SEPARATOR = ' · ';

function clean(value: string | null | undefined): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

/**
 * `street number [supplement], postcode city` as plain text, or null when
 * nothing is known.
 *
 * Not `AddressPipe`: that returns HTML, and it drops the supplement - which is
 * precisely what tells apart several meters in the same building.
 */
export function meterAddressLine(address: MeterOptionSource['address']): string | null {
  if (!address) return null;
  const street = [address.street, address.number, address.supplement]
    .map(clean)
    .filter(Boolean)
    .join(' ');
  const place = [address.postcode, address.city].map(clean).filter(Boolean).join(' ');
  return [street, place].filter(Boolean).join(', ') || null;
}

/**
 * The community's active meters as picker options.
 *
 * Disabled is `!== REVOKED`, not `in [PENDING, ACTIVE]`: the backend's own test
 * is `status != REVOKED` (live-data/api/live/repository.py), so a status this
 * build has never seen blocks here exactly as it would on the server. Built from
 * a Set of the EANs still held rather than an EAN -> status map, because one
 * EAN can carry a REVOKED device AND a newer PENDING one, and a map would keep
 * whichever came last.
 *
 * The list is ADVICE: `POST /devices` still answers 409 / 422.
 */
export function buildMeterOptions(
  meters: readonly MeterOptionSource[],
  devices: readonly Pick<LiveDevice, 'ean' | 'status'>[],
): LiveMeterOption[] {
  const taken = new Set(
    devices
      .filter((device) => device.status !== LiveDeviceStatus.REVOKED)
      .map((device) => clean(device.ean)),
  );
  const seen = new Set<string>();
  const options: LiveMeterOption[] = [];
  for (const meter of meters) {
    const ean = clean(meter.EAN);
    if (!ean || seen.has(ean)) continue;
    seen.add(ean);
    const address = meterAddressLine(meter.address);
    const holder = clean(meter.holder?.name) || null;
    const detail =
      [address, holder].filter((part): part is string => !!part).join(OPTION_SEPARATOR) || null;
    options.push({
      ean,
      label: detail ? `${ean}${OPTION_SEPARATOR}${detail}` : ean,
      address,
      holder,
      detail,
      disabled: taken.has(ean),
    });
  }
  // Pickable first. Late in a rollout most meters already have a device, and
  // the few that can still be picked would be buried in a list that shows
  // about seven rows. `sort` is stable, so each half keeps the CRM's EAN order.
  return options.sort((a, b) => Number(a.disabled) - Number(b.disabled));
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

/**
 * The three windows the dashboard offers, and the resolution each uses.
 *
 * 24 h at quarter-hour is 96 points, 7 d at hour is 168, 30 d at day is 30 -
 * all far inside the backend's caps, so the range selector can never produce a
 * 422 for being too large.
 */
export interface LiveWindow {
  readonly labelKey: string;
  readonly resolution: LiveResolution;
  readonly days: number;
}

export const LIVE_WINDOWS: readonly LiveWindow[] = [
  { labelKey: 'LIVE_DATA.WINDOW.DAY', resolution: LiveResolution.QUARTER, days: 1 },
  { labelKey: 'LIVE_DATA.WINDOW.WEEK', resolution: LiveResolution.HOUR, days: 7 },
  { labelKey: 'LIVE_DATA.WINDOW.MONTH', resolution: LiveResolution.DAY, days: 30 },
];

/**
 * The label a chart axis shows for a bucket.
 *
 * Deliberately NOT `toLocaleString()` on the raw ISO string: a `day` bucket is
 * the instant of Brussels midnight, which in UTC is 22:00 or 23:00 of the
 * PREVIOUS day. Rendering that in the browser's own zone would label 1 July as
 * "30 June" for every reader west of Brussels, which is every reader in the UK
 * and a good part of the fleet's future.
 */
export function bucketLabel(bucket: string, resolution: string, locale: string): string {
  // `String(...)` on the enum member, not a cast on `resolution`: the wire
  // value really is a loose string - the backend may add a resolution this
  // build has never heard of - and casting it to the enum would tell the
  // type-checker a lie to silence a rule that is right.
  const date = new Date(bucket);
  if (Number.isNaN(date.getTime())) return bucket;
  const zone = { timeZone: 'Europe/Brussels' } as const;
  if (resolution === String(LiveResolution.DAY)) {
    return date.toLocaleDateString(locale, { ...zone, day: '2-digit', month: '2-digit' });
  }
  if (resolution === String(LiveResolution.HOUR)) {
    return date.toLocaleString(locale, {
      ...zone,
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
    });
  }
  return date.toLocaleTimeString(locale, { ...zone, hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

function isPresent(value: number | undefined | null): boolean {
  return value !== undefined && value !== null && !Number.isNaN(value);
}

/**
 * Whether a series has any production to draw.
 *
 * A series of points that all have `production_wh` absent is not an empty chart
 * - it is a chart of nothing, which renders as a flat line at zero and reads as
 * "the community produced nothing". The dashboard shows the absent reason
 * instead.
 */
export function hasAnyProduction(points: LiveSeriesPoint[]): boolean {
  return points.some((point) => isPresent(point.production_wh));
}

/** Any bucket whose export was published. 0 counts: a night is data. */
export function hasAnyExport(points: LiveSeriesPoint[]): boolean {
  return points.some((point) => isPresent(point.export_wh));
}

/** Any bucket whose import (grid offtake) was published. 0 counts. */
export function hasAnyImport(points: LiveSeriesPoint[]): boolean {
  return points.some((point) => isPresent(point.import_wh));
}

/**
 * One line of a live chart, already in kWh.
 *
 * `values` holds `null` wherever the term is absent from a bucket, so chart.js
 * draws a GAP there; `absentKey` is what the tooltip says about such a bucket.
 */
export interface EnergyLine {
  readonly labelKey: string;
  readonly values: (number | null)[];
  readonly color: string;
  readonly fill: boolean;
  readonly absentKey: string;
}

/**
 * One colour per QUANTITY, never per position: the export line keeps its blue
 * on a community whose production line is missing.
 *
 * Production is the brand green it always was. Export and offtake were checked
 * with the dataviz palette validator against the light surface, all three as
 * one set (all pairs, colour-blind and normal vision, 3:1 contrast). The app
 * has no dark theme (`darkModeSelector: 'none'`), so there is one step each.
 */
export const LIVE_CHART_COLORS = {
  production: '#43a047',
  export: '#2a78d6',
  offtake: '#4a3aa7',
  // D-14. Validated with export and offtake as one set, the two colours it is
  // stacked against (all pairs, colour-blind and normal vision, 3:1 contrast).
  shared: '#eb6834',
} as const;

const WITHHELD_KEY = 'LIVE_DATA.CHART.WITHHELD';

/**
 * The lines of the "production and export" chart: each one only when it has a
 * value somewhere.
 *
 * Protocol section 3.4: a P1 meter on a site that also consumes cannot see
 * production, and `production_wh` is then null by design - "OptimCE's views say
 * export, not production". So a community of prosumers gets an Export line and
 * no Production line, rather than an empty chart that reads "nothing was
 * produced". The export is a GRID term and is withheld below k per bucket; a
 * withheld bucket is a gap, never a zero.
 */
export function productionChartLines(points: LiveSeriesPoint[]): EnergyLine[] {
  const lines: EnergyLine[] = [];
  if (hasAnyProduction(points)) {
    lines.push({
      labelKey: 'LIVE_DATA.CHART.PRODUCTION',
      values: points.map((point) => toKwh(point.production_wh)),
      color: LIVE_CHART_COLORS.production,
      fill: true,
      absentKey: 'LIVE_DATA.ABSENT.NOT_MEASURED',
    });
  }
  if (hasAnyExport(points)) {
    lines.push({
      labelKey: 'LIVE_DATA.CHART.EXPORT',
      values: points.map((point) => toKwh(point.export_wh)),
      color: LIVE_CHART_COLORS.export,
      fill: false,
      absentKey: WITHHELD_KEY,
    });
  }
  return lines;
}

/**
 * The line of the "consumption drawn from the grid" chart.
 *
 * `import_wh`, aggregated by the backend over the whole community and withheld
 * below k exactly like the export. It is NOT `consumption_wh`, which stays
 * absent (deviation 6): on a site with panels, the energy consumed straight
 * from them never crosses the meter. The chart's title and footnote say so.
 */
export function offtakeChartLines(points: LiveSeriesPoint[]): EnergyLine[] {
  if (!hasAnyImport(points)) return [];
  return [
    {
      labelKey: 'LIVE_DATA.CHART.OFFTAKE',
      values: points.map((point) => toKwh(point.import_wh)),
      color: LIVE_CHART_COLORS.offtake,
      fill: false,
      absentKey: WITHHELD_KEY,
    },
  ];
}

type ChartSource = Pick<LiveSeries, 'points' | 'suppressed_buckets'>;

/**
 * Why the "production and export" chart has nothing to draw, or `null` when it
 * has something.
 *
 * Points with neither production nor a published export are a community of net
 * meters below k: say THAT, because "nothing was measured" is false - the
 * readings are there, and the manager's remedy is members, not hardware.
 */
export function chartEmptyKey(series: ChartSource): string | null {
  if (productionChartLines(series.points).length > 0) return null;
  if (series.points.length > 0 && series.suppressed_buckets > 0) {
    return 'LIVE_DATA.CHART.EMPTY_WITHHELD';
  }
  return 'LIVE_DATA.CHART.EMPTY';
}

/** The same question for the offtake chart. */
export function offtakeEmptyKey(series: ChartSource): string | null {
  if (offtakeChartLines(series.points).length > 0) return null;
  if (series.points.length > 0 && series.suppressed_buckets > 0) {
    return 'LIVE_DATA.ABSENT.BELOW_K_THRESHOLD';
  }
  return 'LIVE_DATA.CHART.EMPTY';
}

/** The marker radius, in px, of a value no line segment can reach. */
export const ISOLATED_POINT_RADIUS = 4;

/**
 * Per-point marker radii for a line drawn without markers: 0 everywhere except
 * where a value has a gap (or the edge) on BOTH sides.
 *
 * Such a value has no segment to draw, so with `pointRadius: 0` it is invisible
 * - and it is exactly the common case on a k-gated line: the first hour a
 * community reaches k, between withheld hours. Found 2026-10-04 on the 7-day
 * view, where the first published export bucket drew nothing at all.
 */
export function isolatedPointRadii(values: (number | null)[]): number[] {
  return values.map((value, index) => {
    if (value === null) return 0;
    const before = index === 0 ? null : values[index - 1];
    const after = index === values.length - 1 ? null : values[index + 1];
    return before === null && after === null ? ISOLATED_POINT_RADIUS : 0;
  });
}

/**
 * The largest value either chart draws, in kWh - or undefined when there is none.
 *
 * Both charts take it as their y-axis maximum, so the export and the offtake can
 * be compared by eye. Scaled independently, a 2 kWh offtake would be drawn as
 * tall as a 10 kWh export.
 */
export function sharedYMax(points: LiveSeriesPoint[]): number | undefined {
  let max: number | undefined;
  for (const point of points) {
    for (const value of [point.production_wh, point.export_wh, point.import_wh]) {
      const kwh = toKwh(value);
      if (kwh !== null && (max === undefined || kwh > max)) max = kwh;
    }
  }
  return max;
}

// ---------------------------------------------------------------------------
// Sharing inside the operations (D-14)
// ---------------------------------------------------------------------------

/** One segment of the stacked sharing chart, already in kWh. */
export interface StackSegment {
  readonly labelKey: string;
  readonly values: (number | null)[];
  readonly color: string;
  /** Segments with the same stack are drawn on top of each other. */
  readonly stack: 'offtake' | 'injection';
}

/**
 * The stacked chart's four segments: two stacks per bucket.
 *
 *   offtake   = covered by the community (shared) + supplied by the supplier
 *   injection = shared in the community (shared)  + rest sent to the grid
 *
 * The SAME shared energy is both the consumed and the injected part - it is one
 * quantity seen from both sides, so it has one colour. A bucket missing any of
 * the three inputs (withheld below k) is a gap in all four, never a zero; and
 * the remainders are clamped at 0, because the estimate is computed per
 * quarter-hour and rounding must never draw a negative segment.
 *
 * Empty when nothing in the series carries a shared figure at all.
 */
export function sharingStackSegments(points: LiveSeriesPoint[]): StackSegment[] {
  if (!points.some((point) => isPresent(point.shared_wh))) return [];
  const known = (point: LiveSeriesPoint): boolean =>
    isPresent(point.shared_wh) && isPresent(point.import_wh) && isPresent(point.export_wh);
  const values = (pick: (point: LiveSeriesPoint) => number): (number | null)[] =>
    points.map((point) => (known(point) ? toKwh(pick(point)) : null));
  const shared = values((point) => point.shared_wh ?? 0);
  return [
    {
      labelKey: 'LIVE_DATA.SHARING.OFFTAKE_SHARED',
      values: shared,
      color: LIVE_CHART_COLORS.shared,
      stack: 'offtake',
    },
    {
      labelKey: 'LIVE_DATA.SHARING.OFFTAKE_SUPPLIER',
      values: values((point) => Math.max(0, (point.import_wh ?? 0) - (point.shared_wh ?? 0))),
      color: LIVE_CHART_COLORS.offtake,
      stack: 'offtake',
    },
    {
      labelKey: 'LIVE_DATA.SHARING.INJECTION_SHARED',
      values: shared,
      color: LIVE_CHART_COLORS.shared,
      stack: 'injection',
    },
    {
      labelKey: 'LIVE_DATA.SHARING.INJECTION_GRID',
      values: values((point) => Math.max(0, (point.export_wh ?? 0) - (point.shared_wh ?? 0))),
      color: LIVE_CHART_COLORS.export,
      stack: 'injection',
    },
  ];
}

/** Why the stacked chart has nothing to draw, or `null` when it has. */
export function sharingEmptyKey(series: ChartSource): string | null {
  if (sharingStackSegments(series.points).length > 0) return null;
  if (series.points.length > 0 && series.suppressed_buckets > 0) {
    return 'LIVE_DATA.ABSENT.BELOW_K_THRESHOLD';
  }
  return 'LIVE_DATA.CHART.EMPTY';
}

/**
 * The coverage line under the estimate: monitored devices out of the ACTIVE
 * meters, for one operation or - `scope` null - summed over every operation.
 * An estimate over 2 of 9 meters says little about the other 7, so it is said.
 */
export function sharingCoverage(
  operations: readonly LiveOperation[],
  scope: number | null,
): { devices: number; meters: number } {
  const counted = scope === null ? operations : operations.filter((op) => op.id === scope);
  return counted.reduce(
    (total, op) => ({ devices: total.devices + op.n_devices, meters: total.meters + op.n_meters }),
    { devices: 0, meters: 0 },
  );
}
