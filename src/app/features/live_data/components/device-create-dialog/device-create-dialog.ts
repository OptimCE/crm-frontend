import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { catchError, defaultIfEmpty, forkJoin, map, of } from 'rxjs';

import { ApiResponse } from '../../../../core/dtos/api.response';
import {
  LiveDevice,
  LiveDeviceCreate,
  LiveDeviceType,
  LiveEnrollmentToken,
} from '../../../../shared/dtos/live-data.dtos';
import { LiveDataService } from '../../../../shared/services/live-data.service';
import { MeterService } from '../../../../shared/services/meter.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { MeterDataStatus } from '../../../../shared/types/meter.types';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error.utils';
import { LiveMeterOption, buildMeterOptions } from '../../live-data-format';

/**
 * One generous page - the same ceiling as `MEMBERS_PAGE_LIMIT` elsewhere. The
 * backend default of 10 would silently cut the list; an overflow past this is
 * REPORTED under the select, never silent.
 */
const METERS_PAGE_LIMIT = 500;

/**
 * Create a device and mint its first enrolment code.
 *
 * Closes with the `LiveEnrollmentToken` rather than with `true`, because the
 * code is shown ONCE and is never recoverable — so the parent opens the token
 * dialog straight away instead of leaving the installer to find a second button
 * for it. Closing with `true` means the device exists but its first code could
 * not be issued: the parent reloads, and the row's own button issues one.
 * Closing with `false` is a cancel, matching the house contract.
 *
 * ---------------------------------------------------------------------------
 * THE EAN IS PICKED, NOT TYPED.
 *
 * The community's ACTIVE meters (CRM `GET /meters/?status=1`) are exactly what
 * `POST /devices` accepts (live-data/ports/crm_read.py `_METER_SQL`): same
 * community, `meter_data.status = 1`, today inside the window. A meter that a
 * pending or active device already holds is listed but disabled.
 *
 * Both are ADVICE. Caches, another manager, and the CRM's and live-data's
 * different "today" around midnight can all make the server refuse a listed
 * meter, so the 409 / 422 handling in `submit()` stays.
 * ---------------------------------------------------------------------------
 *
 * `pure_injection` IS A CHECKBOX WITH A PARAGRAPH ATTACHED, AND IT HAS TO BE.
 *
 * Protocol section 3.4: a smart meter's P1 port sees only the exchange with the
 * grid. On a site where nothing consumes, the export IS the production. On a
 * site that also consumes, production is invisible and `production_wh` must be
 * null.
 *
 * So ticking this box on a site that consumes does not produce an error — it
 * produces a community production figure that is silently too low, for ever, in
 * a way indistinguishable from a cloudy month. The help text is the guard.
 * ---------------------------------------------------------------------------
 *
 * `binary="true"` on the checkbox is not decoration: a non-binary PrimeNG
 * checkbox models an ARRAY, and the form control would hand the backend `[]`
 * instead of `false`.
 */
@Component({
  selector: 'app-device-create-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, Button, Checkbox, InputText, Select, Tag],
  templateUrl: './device-create-dialog.html',
})
export class DeviceCreateDialog implements OnInit {
  private readonly ref = inject(DynamicDialogRef);
  private readonly service = inject(LiveDataService);
  private readonly meterService = inject(MeterService);
  private readonly translate = inject(TranslateService);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  readonly submitting = signal<boolean>(false);
  readonly formError = signal<string | null>(null);

  readonly metersLoading = signal<boolean>(true);
  readonly metersError = signal<boolean>(false);
  /** The device list could not be read: every meter looks free, and the server's 409 is the guard. */
  readonly devicesUnknown = signal<boolean>(false);
  readonly meterOptions = signal<LiveMeterOption[]>([]);
  readonly truncated = signal<{ shown: number; total: number } | null>(null);

  readonly form = new FormGroup({
    name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    // DISABLED until the meters arrive - through the control, never a
    // `[disabled]` binding beside `formControlName` (Angular warns, and the two
    // writers can disagree). A disabled control does NOT count towards
    // `form.invalid`: see `submit()`.
    ean: new FormControl<string>(
      { value: '', disabled: true },
      { nonNullable: true, validators: [Validators.required] },
    ),
    pure_injection: new FormControl<boolean>(false, { nonNullable: true }),
  });

  ngOnInit(): void {
    this.loadMeters();
  }

  /**
   * Meters and devices, read ONCE per opening.
   *
   * The devices are read `fresh`: the cache is cleared only by this tab's own
   * writes, and a device another manager revoked would otherwise keep its meter
   * greyed out - unpickable - for up to five minutes.
   */
  private loadMeters(): void {
    forkJoin({
      meters: this.meterService.getMetersList({
        page: 1,
        limit: METERS_PAGE_LIMIT,
        status: MeterDataStatus.ACTIVE,
      }),
      devices: this.service.listDevices({ fresh: true }).pipe(
        map((response) => (Array.isArray(response.data) ? response.data : null)),
        // A devices failure must not block picking: the server's 409 still guards.
        catchError(() => of(null)),
        // `gateSubscription` turns a 403 NOT_SUBSCRIBED into EMPTY, and
        // `forkJoin` completes WITHOUT emitting when any source is empty - the
        // picker would spin for ever.
        defaultIfEmpty(null),
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ meters, devices }) => {
          this.metersLoading.set(false);
          // `PartialMeterDTO[] | string`: a string is the backend's message,
          // not an empty community.
          if (!Array.isArray(meters.data)) {
            this.metersError.set(true);
            return;
          }
          const options = buildMeterOptions(meters.data, devices ?? []);
          this.meterOptions.set(options);
          this.devicesUnknown.set(devices === null);
          const total = meters.pagination?.total ?? meters.data.length;
          this.truncated.set(
            total > meters.data.length ? { shown: meters.data.length, total } : null,
          );
          // Enabled even when every option is disabled: the open list then
          // says WHY, one tag per meter.
          if (options.length > 0) this.form.controls.ean.enable();
        },
        error: () => {
          this.metersLoading.set(false);
          this.metersError.set(true);
        },
      });
  }

  submit(): void {
    this.formError.set(null);
    this.form.markAllAsTouched();
    const raw = this.form.getRawValue();
    // `form.invalid` alone is not enough: while loading, failed or empty, the
    // EAN control is disabled and so excluded from the form's validity.
    if (this.form.invalid || !raw.ean) {
      this.formError.set(this.translate.instant('LIVE_DATA.CREATE.ERRORS.REQUIRED') as string);
      return;
    }

    const body: LiveDeviceCreate = {
      name: raw.name.trim(),
      ean: raw.ean.trim(),
      // Phase 1 enrols production sites only (deviation 6). Sent explicitly
      // rather than left to the backend default so the payload says what it
      // means.
      type: LiveDeviceType.PRODUCTION,
      pure_injection: raw.pure_injection,
    };

    this.submitting.set(true);
    this.service
      .createDevice(body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: ApiResponse<LiveDevice>) => this.issueFirstToken(response.data.device_id),
        error: (error: unknown) => {
          this.submitting.set(false);
          // The backend re-checks whatever the list said (another manager, a
          // stale cache, a meter closed since): 409 DUPLICATE_EAN (2405) when a
          // pending or active device already holds the EAN - checked first -
          // and 422 EAN_NOT_FOUND (2404) when no active meter of this community
          // has it. Show its message rather than a generic failure.
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }

  /**
   * Creating a device does not enrol it: `POST /devices` mints the row, and the
   * first code comes from `POST /devices/{id}/token`. Two calls, because for a
   * consumption device the code goes to the MEMBER rather than to the
   * administrator — keeping it off the creation response makes that split the
   * default rather than something to remember.
   */
  private issueFirstToken(deviceId: string): void {
    this.service
      .issueToken(deviceId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: ApiResponse<LiveEnrollmentToken>) => {
          this.submitting.set(false);
          this.ref.close(response.data);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          // The DEVICE exists, so this is not a cancel. It used to close with
          // `false`, which the parent reads as one: no reload, no message, and
          // the new device stayed invisible while the picker already greyed
          // its meter out. Say what failed, and close with `true` so the list
          // reloads; the row's own button issues the code.
          this.errorHandler.handleError(extractApiErrorMessage(error));
          this.ref.close(true);
        },
      });
  }

  close(): void {
    this.ref.close(false);
  }
}
