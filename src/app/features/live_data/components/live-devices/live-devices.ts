import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';

import { ApiResponse } from '../../../../core/dtos/api.response';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import {
  DeviceHealth,
  LiveDeviceStatus,
  LiveDeviceStatusRow,
  LiveDeviceType,
  LiveEnrollmentToken,
  LiveOpsHealth,
} from '../../../../shared/dtos/live-data.dtos';
import { LiveDataService } from '../../../../shared/services/live-data.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { TimeAgoPipe } from '../../../../shared/pipes/time-ago/time-ago-pipe';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error.utils';
import {
  deviceStatusLabelKey,
  deviceStatusSeverity,
  healthLabelKey,
  healthSeverity,
  isKnownRejectReason,
  needsAttention,
  rejectHintKey,
  rejectReasonLabelKey,
} from '../../live-data-format';
import { DeviceCreateDialog } from '../device-create-dialog/device-create-dialog';
import { DeviceTokenDialog } from '../device-token-dialog/device-token-dialog';
import { LocaleDatePipe } from '../../../../shared/pipes/locale-format/locale-format-pipes';

/**
 * Screen 2 of 4: the devices, and what each of them is actually doing.
 *
 * ---------------------------------------------------------------------------
 * READS `/ops/health`, NOT `/devices`.
 *
 * `GET /devices` returns the device rows alone — name, EAN, status, connector.
 * It cannot say whether a device is reporting, because that lives in
 * `device_last` and in the rollups.
 *
 * `GET /ops/health` returns the same devices already joined to their state, with
 * the health classification and its hint key resolved server-side. Using it here
 * means this screen and the fleet-status screen cannot disagree about whether a
 * device is silent — which they would, eventually, if each computed it.
 *
 * The consequence to keep in mind: a device revoked long ago still appears,
 * because its measurements are still in the table and still need an owner.
 * ---------------------------------------------------------------------------
 *
 * THE LAST REJECTION IS RENDERED TOO, because nothing else would show it.
 *
 * A reading dropped from an otherwise stored batch - a timestamp off its
 * quarter, production above the declared kVA - leaves no dead letter, so the
 * Ops card's message count never moves. `last_reject_reason` is the only trace,
 * and it was in the payload and rendered nowhere. A capacity mismatch clips
 * exactly the sunny peaks this way, and the chart just looks overcast.
 *
 * THE P1 HINT IS RENDERED INLINE, NOT BEHIND A CLICK.
 *
 * Section 11.2 calls the grid operator not having activated the meter's P1 port
 * the single most likely cause of a silent device, and it is the one an
 * installer cannot diagnose on site — the hardware is fine, the wiring is fine,
 * and the port is closed. A hint that needs a click to reveal is a hint nobody
 * reads at 03:00.
 */
@Component({
  selector: 'app-live-devices',
  standalone: true,
  imports: [
    LocaleDatePipe,
    TimeAgoPipe,
    TranslatePipe,
    Button,
    ConfirmDialog,
    Message,
    Skeleton,
    Tag,
    Tooltip,
  ],
  providers: [DialogService, ConfirmationService, ErrorMessageHandler],
  templateUrl: './live-devices.html',
})
export class LiveDevices implements OnInit {
  private readonly service = inject(LiveDataService);
  private readonly dialogService = inject(DialogService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  private dialogRef?: DynamicDialogRef | null;

  readonly devices = signal<LiveDeviceStatusRow[]>([]);
  readonly loading = signal<boolean>(true);
  readonly revoking = signal<string | null>(null);

  protected readonly healthSeverity = healthSeverity;
  protected readonly healthLabelKey = healthLabelKey;
  protected readonly deviceStatusLabelKey = deviceStatusLabelKey;
  protected readonly deviceStatusSeverity = deviceStatusSeverity;
  protected readonly needsAttention = needsAttention;
  protected readonly rejectReasonLabelKey = rejectReasonLabelKey;
  protected readonly isKnownRejectReason = isKnownRejectReason;
  protected readonly DeviceHealth = DeviceHealth;
  protected readonly LiveDeviceStatus = LiveDeviceStatus;
  protected readonly LiveDeviceType = LiveDeviceType;

  /** True when at least one device is a consumption meter, so the coarsening
   *  notice is shown only where it applies. */
  readonly hasConsumptionDevice = computed(() =>
    this.devices().some((device) => device.type === LiveDeviceType.CONSUMPTION),
  );

  constructor() {
    this.destroyRef.onDestroy(() => this.dialogRef?.destroy());
  }

  /** The explanation under a device whose production is being rejected. */
  rejectHint(device: LiveDeviceStatusRow): string | null {
    return rejectHintKey(device.last_reject_reason, device.last_reject_at, Date.now());
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.service
      .opsHealth()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: ApiResponse<LiveOpsHealth>) => {
          this.devices.set(Array.isArray(response.data.devices) ? response.data.devices : []);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }

  openCreate(): void {
    const ref = this.dialogService.open(DeviceCreateDialog, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      width: '32rem',
      styleClass: 'responsive-dialog',
      header: this.translate.instant('LIVE_DATA.CREATE.TITLE') as string,
    });
    // `DialogService.open` is typed nullable in PrimeNG 21, so the optional
    // chain below is the house pattern rather than defensive noise — and
    // `ng build` type-checks it where `ngc --noEmit` does not.
    this.dialogRef = ref;
    this.dialogRef?.onClose
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((created: LiveEnrollmentToken | true | false | undefined) => {
        if (!created) return;
        // `true`: the device exists but its first code could not be issued.
        // The dialog already said so; show the new row, whose own button
        // issues the code.
        if (created === true) {
          this.load();
          return;
        }
        this.snackbar.openSnackBar(
          this.translate.instant('LIVE_DATA.DEVICES.CREATED') as string,
          VALIDATION_TYPE,
        );
        this.load();
        // Straight into the token dialog. The code is shown ONCE and is never
        // recoverable, so making the installer find a second button for it is
        // how a device gets created and then never enrolled.
        this.showToken(created);
      });
  }

  issueToken(device: LiveDeviceStatusRow): void {
    this.service
      .issueToken(device.device_id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: ApiResponse<LiveEnrollmentToken>) => {
          this.load();
          this.showToken(response.data);
        },
        error: (error: unknown) => this.errorHandler.handleError(extractApiErrorMessage(error)),
      });
  }

  private showToken(token: LiveEnrollmentToken): void {
    this.dialogRef = this.dialogService.open(DeviceTokenDialog, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      width: '30rem',
      styleClass: 'responsive-dialog',
      header: this.translate.instant('LIVE_DATA.TOKEN.TITLE') as string,
      data: { token },
    });
  }

  confirmRevoke(device: LiveDeviceStatusRow): void {
    this.confirmation.confirm({
      header: this.translate.instant('LIVE_DATA.DEVICES.REVOKE_CONFIRM_HEADER') as string,
      message: this.translate.instant('LIVE_DATA.DEVICES.REVOKE_CONFIRM_MESSAGE') as string,
      acceptLabel: this.translate.instant('COMMON.ACTIONS.VALIDATE') as string,
      rejectLabel: this.translate.instant('COMMON.ACTIONS.CANCEL') as string,
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.revoke(device),
    });
  }

  private revoke(device: LiveDeviceStatusRow): void {
    this.revoking.set(device.device_id);
    this.service
      .revokeDevice(device.device_id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.revoking.set(null);
          this.snackbar.openSnackBar(
            this.translate.instant('LIVE_DATA.DEVICES.REVOKED') as string,
            VALIDATION_TYPE,
          );
          this.load();
        },
        error: (error: unknown) => {
          this.revoking.set(null);
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }
}
