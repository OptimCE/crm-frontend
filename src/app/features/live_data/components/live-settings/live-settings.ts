import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputNumber } from 'primeng/inputnumber';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { ToggleSwitch } from 'primeng/toggleswitch';

import { ApiResponse } from '../../../../core/dtos/api.response';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { LiveSettings as LiveSettingsDto } from '../../../../shared/dtos/live-data.dtos';
import { LiveDataService } from '../../../../shared/services/live-data.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error.utils';

/** Mirrors `ck_community_live_settings_k_floor`. A k of 1 is not a privacy setting. */
const K_FLOOR = 3;
const K_CEILING = 1000;

/**
 * Screen 4 of 4: who may see what.
 *
 * ---------------------------------------------------------------------------
 * A `PUT` IS A FULL REPLACEMENT, AND THE FORM IS LOADED FROM THE SERVER FIRST.
 *
 * The backend's `PUT /settings` is `INSERT … ON CONFLICT DO UPDATE` with
 * `extra="forbid"` — it replaces all three fields. So this form must never
 * submit a value it did not load: posting a default for a field the manager did
 * not touch silently reverts whatever someone else set.
 *
 * `is_default: true` means no row exists yet, and the banner says so. The GET
 * deliberately does NOT create one — a GET that writes breaks on a read replica,
 * audits a manager who merely opened a panel, and freezes today's platform
 * default into a row so a later change never reaches them.
 * ---------------------------------------------------------------------------
 *
 * `p-toggleswitch` rather than `p-checkbox` for the two booleans, deliberately:
 * a non-binary PrimeNG checkbox models an ARRAY, and these controls would then
 * hand the backend `[]` where it expects `false`.
 */
@Component({
  selector: 'app-live-settings',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    Button,
    Card,
    InputNumber,
    Message,
    Skeleton,
    ToggleSwitch,
  ],
  templateUrl: './live-settings.html',
})
export class LiveSettings implements OnInit {
  private readonly service = inject(LiveDataService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal<boolean>(true);
  /** The GET failed, so the form is not shown - see `load`. */
  readonly loadFailed = signal<boolean>(false);
  readonly saving = signal<boolean>(false);
  readonly isDefault = signal<boolean>(false);

  protected readonly K_FLOOR = K_FLOOR;
  protected readonly K_CEILING = K_CEILING;

  readonly form = new FormGroup({
    members_see_production: new FormControl<boolean>(true, { nonNullable: true }),
    members_see_aggregate: new FormControl<boolean>(true, { nonNullable: true }),
    k: new FormControl<number>(5, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(K_FLOOR), Validators.max(K_CEILING)],
    }),
  });

  ngOnInit(): void {
    this.load();
  }

  /** Also the retry button's handler. */
  protected load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.service
      .settings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: ApiResponse<LiveSettingsDto>) => {
          const data = response.data;
          this.form.setValue({
            members_see_production: data.members_see_production,
            members_see_aggregate: data.members_see_aggregate,
            k: data.k,
          });
          this.isDefault.set(data.is_default);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          // NOT the form. It still holds its initial values (both switches on,
          // k = 5), and a save replaces all three fields: a manager who only
          // changed k would silently re-open what the community had closed.
          this.loadFailed.set(true);
          this.loading.set(false);
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }

  save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loadFailed()) return;

    const raw = this.form.getRawValue();
    this.saving.set(true);
    this.service
      .updateSettings({
        members_see_production: raw.members_see_production,
        members_see_aggregate: raw.members_see_aggregate,
        // `p-inputNumber` renders an empty field as 0 and can hand back null on
        // a cleared input; the backend would then answer 422 for a value the
        // manager never typed. Clamping here keeps the failure at the widget
        // rather than at the API.
        k: Math.min(Math.max(Number(raw.k) || K_FLOOR, K_FLOOR), K_CEILING),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: ApiResponse<LiveSettingsDto>) => {
          this.saving.set(false);
          this.isDefault.set(response.data.is_default);
          this.snackbar.openSnackBar(
            this.translate.instant('LIVE_DATA.SETTINGS.SAVED') as string,
            VALIDATION_TYPE,
          );
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }
}
