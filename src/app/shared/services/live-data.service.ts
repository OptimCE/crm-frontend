import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  EMPTY,
  MonoTypeOperatorFunction,
  Observable,
  Subject,
  catchError,
  tap,
  throwError,
} from 'rxjs';

import { environments } from '../../../environments/environments';
import { ApiResponse } from '../../core/dtos/api.response';
import {
  LiveDevice,
  LiveDeviceCreate,
  LiveEnrollmentToken,
  LiveErrorCode,
  LiveForecast,
  LiveForecastMethod,
  LiveMemberOperation,
  LiveMemberSeries,
  LiveOperation,
  LiveOperationSummary,
  LiveOpsHealth,
  LiveSeries,
  LiveSeriesQuery,
  LiveSettings,
  LiveSettingsUpdate,
  LiveSummary,
  LiveVersion,
} from '../dtos/live-data.dtos';
import { extractApiErrorCode } from '../utils/api-error.utils';
import { ServiceBase } from './service.base';

const CACHE_PREFIX = 'live-data';

/** Query params with the undefined entries dropped - HttpParams has no use for them. */
function definedParams(query: LiveSeriesQuery): Record<string, string> {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined),
  ) as Record<string, string>;
}

/**
 * Turn a 403 NOT_SUBSCRIBED into a quiet completion plus a call to `onLost`.
 *
 * A module-level function rather than a method on purpose: the service spec
 * walks `LiveDataService.prototype` and calls every method it finds, so a
 * helper living there would be "called" as if it were an endpoint.
 *
 * Every other failure - including a 403 AGGREGATE_NOT_VISIBLE, which the
 * dashboard renders as a banner - passes through untouched.
 */
function gateSubscription<T>(onLost: () => void): MonoTypeOperatorFunction<T> {
  return catchError((error: unknown) => {
    if (
      error instanceof HttpErrorResponse &&
      error.status === 403 &&
      extractApiErrorCode(error) === LiveErrorCode.NOT_SUBSCRIBED
    ) {
      onLost();
      // Complete with no value and no error, so no caller can raise a toast or
      // a banner for it: the hub owns the one reaction.
      return EMPTY;
    }
    return throwError(() => error);
  });
}

/**
 * HTTP access to the live-data annex. The KrakenD gateway prepends `/live` and
 * injects x-user-id / x-user-orgs from the JWT; the community-context + bearer
 * interceptors add X-Community-ID / auth.
 *
 * ---------------------------------------------------------------------------
 * THE TELEMETRY READS DELIBERATELY BYPASS `cachedGet`.
 *
 * `ServiceBase.cachedGet` memoises under a five-minute TTL, which is right for
 * reference data and wrong for everything on this annex's dashboard. A view that
 * polls every 60 s through it would be served the same cached body for five
 * minutes and then jump - so the poll would do nothing except look like it was
 * working, which is worse than not polling at all.
 *
 * Measurements arrive every 15 minutes and the rollup tick runs every 15
 * minutes, so `summary`, `series` and `opsHealth` go straight to `http.get`.
 *
 * `devices`, `settings`, `forecastMethods` and `version` DO use the cache: they
 * change when a manager changes them, and every mutation below invalidates the
 * whole `live-data:` prefix.
 * ---------------------------------------------------------------------------
 *
 * A 1003 NEVER REACHES A CALLER. Every method is piped through
 * `gateSubscription`: when the community's Live Data subscription is switched
 * off mid-session, the call completes empty, `subscriptionLost$` emits, and
 * `LiveDataHub` leaves the route. Without it the dashboard's 60 s poll swallowed
 * the 403 and kept polling a module that no longer exists for this community.
 */
@Injectable({ providedIn: 'root' })
export class LiveDataService extends ServiceBase {
  private readonly apiAddress: string;

  private readonly lost = new Subject<void>();
  /** Emits once per refused call; consumers that need a single reaction `take(1)`. */
  readonly subscriptionLost$: Observable<void> = this.lost.asObservable();
  /** Also drops the cached devices/settings, so a return visit asks the backend again. */
  private readonly onLost = (): void => {
    this.cache.invalidate(CACHE_PREFIX);
    this.lost.next();
  };

  constructor() {
    super();
    this.apiAddress = environments.apiUrl + '/live';
  }

  // --- The aggregate reads. Uncached; see the class docstring. -------------

  /**
   * The community as of the last CLOSED hour, plus live device counts and the
   * rollup-freshness verdict.
   *
   * Terms may be ABSENT from the response rather than null - see
   * `live-data.dtos.ts`. Never coerce a missing `import_wh` to 0.
   */
  summary(): Observable<ApiResponse<LiveSummary>> {
    return this.http
      .get<ApiResponse<LiveSummary>>(`${this.apiAddress}/summary`)
      .pipe(gateSubscription(this.onLost));
  }

  /**
   * A time series at quarter, hour or day resolution.
   *
   * `from`/`to` must be SNAPPED to the requested grid or the backend answers
   * 422. That is deliberate and must not be worked around here by rounding the
   * bounds before sending them: a client that silently snaps re-opens the
   * differencing attack the refusal exists to close. Send bounds the UI itself
   * produced on the grid, or send none and take the default window.
   */
  series(query: LiveSeriesQuery = {}): Observable<ApiResponse<LiveSeries>> {
    return this.http
      .get<ApiResponse<LiveSeries>>(`${this.apiAddress}/series`, { params: definedParams(query) })
      .pipe(gateSubscription(this.onLost));
  }

  // --- Sharing operations (D-14) -------------------------------------------

  /**
   * The community's operations with a monitored meter, and their coverage.
   * MANAGER. Cached: it changes when devices or CRM memberships change, and the
   * device mutations below invalidate the whole prefix.
   */
  operations(): Observable<ApiResponse<LiveOperation[]>> {
    return this.cachedGet<ApiResponse<LiveOperation[]>>(
      `${CACHE_PREFIX}:operations`,
      `${this.apiAddress}/operations`,
    ).pipe(gateSubscription(this.onLost));
  }

  /** One operation as of its last closed hour, under its own k. MANAGER. */
  operationSummary(id: number): Observable<ApiResponse<LiveOperationSummary>> {
    return this.http
      .get<ApiResponse<LiveOperationSummary>>(`${this.apiAddress}/operations/${id}/summary`)
      .pipe(gateSubscription(this.onLost));
  }

  /** One operation's series, with the shared estimate. Same bound rules as `series`. MANAGER. */
  operationSeries(id: number, query: LiveSeriesQuery = {}): Observable<ApiResponse<LiveSeries>> {
    return this.http
      .get<ApiResponse<LiveSeries>>(`${this.apiAddress}/operations/${id}/series`, {
        params: definedParams(query),
      })
      .pipe(gateSubscription(this.onLost));
  }

  /** The operations the caller holds an ACTIVE meter in. MEMBER; `[]` when none. */
  myOperations(): Observable<ApiResponse<LiveMemberOperation[]>> {
    return this.http
      .get<ApiResponse<LiveMemberOperation[]>>(`${this.apiAddress}/mine/operations`)
      .pipe(gateSubscription(this.onLost));
  }

  /** Production (and, for net meters, export under k) of one of MY operations. */
  myOperationSeries(
    id: number,
    query: LiveSeriesQuery = {},
  ): Observable<ApiResponse<LiveMemberSeries>> {
    return this.http
      .get<ApiResponse<LiveMemberSeries>>(`${this.apiAddress}/mine/operations/${id}/series`, {
        params: definedParams(query),
      })
      .pipe(gateSubscription(this.onLost));
  }

  /** The fleet, its rollup freshness, and what could not be stored. MANAGER. */
  opsHealth(): Observable<ApiResponse<LiveOpsHealth>> {
    return this.http
      .get<ApiResponse<LiveOpsHealth>>(`${this.apiAddress}/ops/health`)
      .pipe(gateSubscription(this.onLost));
  }

  /** One device's state with its hint key. MANAGER. */
  diagnostics(deviceId: string): Observable<ApiResponse<LiveOpsHealth['devices'][number]>> {
    return this.http
      .get<
        ApiResponse<LiveOpsHealth['devices'][number]>
      >(`${this.apiAddress}/devices/${deviceId}/diagnostics`)
      .pipe(gateSubscription(this.onLost));
  }

  // --- Devices -------------------------------------------------------------

  /**
   * The community's device rows.
   *
   * `fresh` drops the cached copy first. The cache is cleared only by THIS
   * tab's own successful writes, so a device another manager revoked keeps its
   * meter greyed out in the "Add device" picker for up to five minutes - with no
   * way to pick it, since the free-text EAN is gone and the server is never
   * asked. The picker reads once per opening, so a fresh read costs one request.
   */
  listDevices(options?: { fresh?: boolean }): Observable<ApiResponse<LiveDevice[]>> {
    if (options?.fresh) this.cache.invalidate(`${CACHE_PREFIX}:devices`);
    return this.cachedGet<ApiResponse<LiveDevice[]>>(
      `${CACHE_PREFIX}:devices`,
      `${this.apiAddress}/devices`,
    ).pipe(gateSubscription(this.onLost));
  }

  createDevice(body: LiveDeviceCreate): Observable<ApiResponse<LiveDevice>> {
    return this.http.post<ApiResponse<LiveDevice>>(`${this.apiAddress}/devices`, body).pipe(
      tap(() => this.cache.invalidate(CACHE_PREFIX)),
      gateSubscription(this.onLost),
    );
  }

  /**
   * A fresh enrolment token, SHOWN ONCE.
   *
   * Regenerating is a normal operation rather than an incident: the device
   * password is shown once and is never recoverable, so a lost secret is
   * re-enrolled, not recovered. Issuing invalidates any unconsumed token for
   * this device.
   */
  issueToken(deviceId: string): Observable<ApiResponse<LiveEnrollmentToken>> {
    return this.http
      .post<ApiResponse<LiveEnrollmentToken>>(`${this.apiAddress}/devices/${deviceId}/token`, {})
      .pipe(
        tap(() => this.cache.invalidate(CACHE_PREFIX)),
        gateSubscription(this.onLost),
      );
  }

  /**
   * Revoke a device: disable, clear its retained status, delete the broker
   * client. Immediate and server-side; there is nothing to do on the device
   * itself, and revoking does NOT delete what it already sent.
   */
  revokeDevice(deviceId: string): Observable<ApiResponse<LiveDevice>> {
    return this.http
      .post<ApiResponse<LiveDevice>>(`${this.apiAddress}/devices/${deviceId}/revoke`, {})
      .pipe(
        tap(() => this.cache.invalidate(CACHE_PREFIX)),
        gateSubscription(this.onLost),
      );
  }

  // --- Settings ------------------------------------------------------------

  /**
   * The visibility settings in force.
   *
   * Returns the platform defaults with `is_default: true` when the community has
   * never saved them, and does NOT create a row - so a manager merely opening
   * the panel changes nothing and is not audited for it.
   */
  settings(): Observable<ApiResponse<LiveSettings>> {
    return this.cachedGet<ApiResponse<LiveSettings>>(
      `${CACHE_PREFIX}:settings`,
      `${this.apiAddress}/settings`,
    ).pipe(gateSubscription(this.onLost));
  }

  /** Full replacement, not a patch. Audited with before AND after. */
  updateSettings(body: LiveSettingsUpdate): Observable<ApiResponse<LiveSettings>> {
    return this.http.put<ApiResponse<LiveSettings>>(`${this.apiAddress}/settings`, body).pipe(
      tap(() => this.cache.invalidate(CACHE_PREFIX)),
      gateSubscription(this.onLost),
    );
  }

  // --- The forecast seam ---------------------------------------------------

  /**
   * Empty in phase 1, carrying a NAMED reason - never a 404 and never a bare
   * list. A view must render the reason rather than an empty chart, or the day
   * the first method ships nothing will look different.
   */
  forecast(): Observable<ApiResponse<LiveForecast>> {
    return this.http
      .get<ApiResponse<LiveForecast>>(`${this.apiAddress}/forecast`)
      .pipe(gateSubscription(this.onLost));
  }

  forecastMethods(): Observable<ApiResponse<LiveForecastMethod[]>> {
    return this.cachedGet<ApiResponse<LiveForecastMethod[]>>(
      `${CACHE_PREFIX}:forecast-methods`,
      `${this.apiAddress}/forecast/methods`,
    ).pipe(gateSubscription(this.onLost));
  }

  // --- Diagnostics ---------------------------------------------------------

  /** Protocol and schema versions. Touches no database on the backend. */
  version(): Observable<ApiResponse<LiveVersion>> {
    return this.cachedGet<ApiResponse<LiveVersion>>(
      `${CACHE_PREFIX}:version`,
      `${this.apiAddress}/version`,
    ).pipe(gateSubscription(this.onLost));
  }
}
