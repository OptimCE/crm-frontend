/**
 * DTOs for the live-data annex (monorepo/live-data).
 *
 * Field names are kept snake_case to mirror the backend payloads verbatim (same
 * convention as billing.dtos.ts / news.dtos.ts). Enum values match the backend
 * IntEnums in live-data/shared/const.py.
 *
 * ---------------------------------------------------------------------------
 * EVERY ENERGY FIELD IS OPTIONAL, AND THAT IS THE CONTRACT - NOT LAZINESS.
 *
 * `/summary` and `/series` are served with `response_model_exclude_none=True`,
 * so a term the backend will not answer is ABSENT FROM THE JSON rather than
 * null. Three different situations produce an absent term and the payload's
 * `absent[]` list says which:
 *
 *   below_k_threshold          the bucket has fewer than k members, so the
 *                              grid-exchange terms are withheld
 *   not_measured               this hardware cannot see it (a P1 port on a site
 *                              that also consumes cannot see production)
 *   no_consumption_in_phase_1  the term does not exist yet
 *
 * So `import_wh === undefined` must never be rendered as 0. A chart library
 * plots `null` as zero, which is why the backend omits the key instead of
 * nulling it, and why these types use `?` rather than `| null`.
 *
 * `/ops/health` and `/devices/{id}/diagnostics` are `exclude_none` too, so the
 * same `?` holds there. They were not, once: every unanswered field arrived as
 * `null`, a check written `!== undefined` let it through, and the Ops tab read
 * "recomputed null minutes ago". Test for PRESENCE with `!= null`, never with
 * `!== undefined`, and a server that regresses stays harmless.
 * ---------------------------------------------------------------------------
 *
 * EVERY PAYLOAD CARRIES `indicative: true`, stamped server-side. Live data is
 * never the basis for an allocation key or an invoice - the DSO's data is - and
 * every view that shows these numbers has to say so.
 */

/** live-data/shared/const.py DeviceType. Phase 1 enrols production only. */
export enum LiveDeviceType {
  PRODUCTION = 1,
  CONSUMPTION = 2,
}

/** live-data/shared/const.py DeviceStatus. */
export enum LiveDeviceStatus {
  PENDING = 1,
  ACTIVE = 2,
  REVOKED = 3,
}

/**
 * live-data/domain/device_health.py DeviceHealth.
 *
 * `REPORTING_ZEROS` is the one worth knowing about: connected, publishing on
 * schedule, and every register reads zero. It is what a meter whose P1 port the
 * grid operator has not activated looks like, and it is indistinguishable from
 * a healthy device on every other signal.
 */
export enum DeviceHealth {
  OK = 'ok',
  NEVER_SEEN = 'never_seen',
  SILENT = 'silent',
  OFFLINE = 'offline',
  REPORTING_ZEROS = 'reporting_zeros',
  UNKNOWN = 'unknown',
  /** Revoked on purpose: listed for its history, never in need of attention. */
  REVOKED = 'revoked',
}

/**
 * live-data/domain/rollup_freshness.py RollupFreshness - whether the SCHEDULER
 * keeps up. Not the age of the newest data: a quiet fleet stops producing
 * buckets while every tick runs, and reading that age as staleness is how the
 * Ops tab blamed the rollups every quiet evening.
 */
export enum RollupFreshness {
  /** Nothing has been rolled up yet. */
  NEVER = 'never',
  FRESH = 'fresh',
  /** The one red state: stored readings are waiting, or no tick has run. */
  STALE = 'stale',
  /** Nothing left in the 48 h window to recompute. Never red. */
  IDLE = 'idle',
}

/** live-data/domain/windows.py Resolution. */
export enum LiveResolution {
  QUARTER = 'quarter',
  HOUR = 'hour',
  DAY = 'day',
}

/** live-data/domain/kanon.py AbsentReason. */
export enum AbsentReason {
  BELOW_K_THRESHOLD = 'below_k_threshold',
  NO_CONSUMPTION_IN_PHASE_1 = 'no_consumption_in_phase_1',
  NOT_MEASURED = 'not_measured',
  /** Measured, but no hour has closed yet: a community in its first hour. */
  NO_CLOSED_HOUR_YET = 'no_closed_hour_yet',
}

/**
 * `error_code` values the SPA branches on (live-data/shared/custom_errors.py).
 * Renumbering either on the backend silently turns its branch into a generic
 * failure here.
 */
export enum LiveErrorCode {
  /**
   * errors.subscription.NOT_SUBSCRIBED — the router-level `require_feature` gate
   * on every authenticated route: the community's Live Data subscription is off.
   */
  NOT_SUBSCRIBED = 1003,
  /**
   * errors.live.AGGREGATE_NOT_VISIBLE — members only; MANAGER and ADMIN always
   * pass (api/live/visibility.py).
   */
  AGGREGATE_NOT_VISIBLE = 2440,
}

export interface AbsentTerm {
  term: string;
  reason: AbsentReason | string;
}

export interface LiveSummary {
  indicative: true;
  /**
   * The most recent CLOSED hour - recomputed after it ended - and absent until
   * one exists. Not the hour in progress: the card says "last full hour".
   */
  bucket?: string;
  /** ALWAYS published when known, at any k - production is not subject to it. */
  production_wh?: number;
  /** Withheld below the k threshold. See the file header. */
  import_wh?: number;
  export_wh?: number;
  /**
   * The ESTIMATED energy shared inside the community's sharing operations
   * (D-14): per quarter-hour LEAST(export, import) of each operation's monitored
   * meters, summed. Withheld with the grid terms.
   */
  shared_wh?: number;
  /** Derived as `wh * 3600 / interval_s`, never read from the payload's power_w. */
  power_w?: number;
  n_devices: number;
  n_devices_online: number;
  n_devices_never_seen: number;
  n_devices_silent: number;
  n_members?: number;
  /**
   * Deviation 6 permits exactly one value. With no consumption term, "the sun is
   * shining" is not "now is a good time to run the washing machine", and a green
   * light meaning the first WILL be read as the second.
   */
  signal: 'neutral';
  /**
   * The same verdict `/ops/health` carries, so the dashboard's stale banner and
   * the Ops tab agree whatever range the chart shows. A string this build does
   * not know renders neutral.
   */
  rollup_freshness: RollupFreshness | string;
  /** The age the verdict rests on, in minutes. Absent for `never` and `idle`. */
  rollup_lag_minutes?: number;
  absent: AbsentTerm[];
}

export interface LiveSeriesPoint {
  bucket: string;
  production_wh?: number;
  import_wh?: number;
  export_wh?: number;
  /** Estimated, among monitored meters; withheld with the grid terms (D-14). */
  shared_wh?: number;
  n_devices: number;
}

export interface LiveSeries {
  indicative: true;
  resolution: LiveResolution | string;
  start: string;
  end: string;
  points: LiveSeriesPoint[];
  /**
   * Buckets whose GRID terms were withheld. The bucket itself is still in
   * `points` carrying its production - suppression is per bucket and per term,
   * not per request.
   */
  suppressed_buckets: number;
  truncated: boolean;
  cap: number;
  absent: AbsentTerm[];
}

/**
 * A sharing operation with live data, for the manager (D-14). `n_devices` of its
 * `n_meters` ACTIVE meters are monitored: the coverage of the shared estimate.
 */
export interface LiveOperation {
  id: number;
  name: string;
  n_devices: number;
  n_meters: number;
}

export interface LiveOperationSummary {
  indicative: true;
  id_sharing_operation: number;
  bucket?: string;
  production_wh?: number;
  import_wh?: number;
  export_wh?: number;
  shared_wh?: number;
  n_devices: number;
  n_members?: number;
  n_meters: number;
  absent: AbsentTerm[];
}

/** An operation the caller holds an ACTIVE meter in (`/mine/operations`). */
export interface LiveMemberOperation {
  id: number;
  name: string;
}

/**
 * One bucket of a member's own operation. Production, and - where the meters
 * cannot see it - the export, under k. The backend type cannot carry import or
 * the shared estimate, and neither can this one.
 */
export interface LiveMemberPoint {
  bucket: string;
  production_wh?: number;
  export_wh?: number;
  n_devices: number;
}

export interface LiveMemberSeries {
  indicative: true;
  id_sharing_operation: number;
  resolution: LiveResolution | string;
  start: string;
  end: string;
  points: LiveMemberPoint[];
  suppressed_buckets: number;
  truncated: boolean;
  cap: number;
  absent: AbsentTerm[];
}

export interface LiveSettings {
  members_see_production: boolean;
  members_see_aggregate: boolean;
  k: number;
  /** True when no row exists and these are the platform defaults. */
  is_default: boolean;
}

export type LiveSettingsUpdate = Omit<LiveSettings, 'is_default'>;

export interface LiveDevice {
  indicative: true;
  device_id: string;
  name: string;
  type: LiveDeviceType;
  status: LiveDeviceStatus;
  ean: string;
  pure_injection: boolean;
  /**
   * kVA - the AC inverter/connection ceiling, NOT the DC panel peak (kWc). A PV
   * array is routinely oversized against its inverter, so this is a bound to
   * clip against and never a capacity to trust. Display it with its unit.
   */
  capacity_kva?: number;
  connector_name?: string;
  connector_version?: string;
  enrolled_at?: string;
  created_at: string;
}

export interface LiveDeviceCreate {
  name: string;
  ean: string;
  type?: LiveDeviceType;
  pure_injection: boolean;
}

export interface LiveEnrollmentToken {
  /** Shown ONCE. There is no endpoint that reads it back. */
  token: string;
  expires_at: string;
  /**
   * The token as an inline SVG data URI, rendered SERVER-SIDE. Bind it straight
   * to an `<img [src]>` - there is deliberately no QR library in this project,
   * and a URL carrying a credential would land in nginx's and KrakenD's access
   * logs.
   */
  qr_svg: string;
}

export interface LiveDeviceStatusRow {
  indicative: true;
  device_id: string;
  name: string;
  type: LiveDeviceType;
  status: LiveDeviceStatus;
  ean: string;
  connector_name?: string;
  connector_version?: string;
  health: DeviceHealth | string;
  /** An i18n KEY, e.g. `LIVE.HINT.P1_NOT_ENABLED`. Run it through `translate`. */
  hint: string;
  online?: boolean;
  /** `no_telegram`, `parse_error`, `port_closed`, `source_unreachable`, `ok`. */
  diag?: string;
  diag_since?: string;
  /**
   * ABSENT for a consumption device, deliberately. "This member's device has
   * been offline for three days" is an occupancy signal, so the timestamps are
   * coarsened away while the state itself - which is actionable - is not.
   */
  last_seen_at?: string;
  last_measurement_at?: string;
  last_reject_reason?: string;
  last_reject_at?: string;
  energy_recent_wh?: number;
}

export interface LiveOpsHealth {
  indicative: true;
  n_devices: number;
  /** Keyed by `DeviceHealth`. A state this build does not know renders as itself. */
  by_health: Record<string, number>;
  /**
   * The newest bucket and its age: how new the DATA is. NOT the scheduler's
   * health - a quiet fleet ages it while every tick runs. Not rendered.
   */
  newest_rollup_bucket?: string;
  rollup_age_minutes?: number;
  /** Whether the scheduler keeps up. Every device can be healthy while it is dead. */
  rollup_freshness: RollupFreshness | string;
  /** The age that verdict rests on, in minutes. Absent for `never` and `idle`. */
  rollup_lag_minutes?: number;
  rollup_computed_at?: string;
  rollup_pending_since?: string;
  /** Whole MESSAGES that could not be stored. */
  dead_letters_24h: number;
  /**
   * Devices whose individual READINGS were rejected in the last 24 h - which
   * leave no dead letter, because the rest of the batch was stored. A lower
   * bound: only each device's last rejection is kept.
   */
  n_devices_readings_rejected_24h: number;
  devices: LiveDeviceStatusRow[];
}

export interface LiveForecastPoint {
  bucket: string;
  wh: number;
}

export interface LiveForecast {
  indicative: true;
  /** Empty in phase 1, with `reason` saying why. Never a 404 and never a bare []. */
  buckets: LiveForecastPoint[];
  reason?: string;
  method?: string;
  method_version?: string;
}

export interface LiveForecastMethod {
  name: string;
  description: string;
  version: string;
  supports: number[];
  required_weather_variables: string[];
  input_schema: Record<string, unknown>;
}

export interface LiveVersion {
  service: string;
  protocol_version: number;
  schema_version: number;
}

export interface LiveSeriesQuery {
  resolution?: LiveResolution;
  /**
   * MUST be snapped to the requested grid. An unsnapped bound is a 422, not a
   * silent correction: free-form bounds are the differencing attack, and
   * snapping them server-side would answer every request in it.
   */
  from?: string;
  to?: string;
}
