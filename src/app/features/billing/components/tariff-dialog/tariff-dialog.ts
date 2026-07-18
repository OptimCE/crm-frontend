import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';

import { ApiResponse } from '../../../../core/dtos/api.response';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import {
  TariffIn,
  TariffKind,
  TariffScope,
  TariffSegment,
} from '../../../../shared/dtos/billing.dtos';
import { BillingService } from '../../../../shared/services/billing.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { toApiDate } from '../../billing-format';

interface TariffDialogData {
  operationId: number;
}

interface SelectOption {
  label: string;
  value: number;
}

@Component({
  selector: 'app-tariff-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, Button, DatePicker, InputText, Select],
  templateUrl: './tariff-dialog.html',
})
export class TariffDialog implements OnInit {
  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig<TariffDialogData>);
  private readonly service = inject(BillingService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  private readonly dialogData = this.config.data as TariffDialogData | undefined;
  private readonly operationId = this.dialogData?.operationId ?? 0;

  readonly submitting = signal<boolean>(false);
  readonly formError = signal<string | null>(null);

  readonly TariffScope = TariffScope;

  kindOptions: SelectOption[] = [];
  scopeOptions: SelectOption[] = [];
  segmentOptions: SelectOption[] = [];

  readonly form = new FormGroup({
    kind: new FormControl<TariffKind>(TariffKind.CONSUMER_SELLING, { nonNullable: true }),
    scope: new FormControl<TariffScope>(TariffScope.GLOBAL, { nonNullable: true }),
    scope_segment: new FormControl<TariffSegment | null>(null),
    scope_ean: new FormControl<string>('', { nonNullable: true }),
    price_per_kwh: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d+(\.\d+)?$/)],
    }),
    valid_from: new FormControl<Date | null>(null, { validators: [Validators.required] }),
    valid_to: new FormControl<Date | null>(null),
    label: new FormControl<string>('', { nonNullable: true }),
  });

  readonly scope = signal<TariffScope>(TariffScope.GLOBAL);
  readonly isSegment = computed(() => this.scope() === TariffScope.SEGMENT);
  readonly isEan = computed(() => this.scope() === TariffScope.EAN);

  ngOnInit(): void {
    const t = (key: string): string => this.translate.instant(key) as string;
    this.kindOptions = [
      { label: t('BILLING.TARIFF_KIND.CONSUMER_SELLING'), value: TariffKind.CONSUMER_SELLING },
      { label: t('BILLING.TARIFF_KIND.PRODUCER_BUYBACK'), value: TariffKind.PRODUCER_BUYBACK },
    ];
    this.scopeOptions = [
      { label: t('BILLING.TARIFF_SCOPE.GLOBAL'), value: TariffScope.GLOBAL },
      { label: t('BILLING.TARIFF_SCOPE.SEGMENT'), value: TariffScope.SEGMENT },
      { label: t('BILLING.TARIFF_SCOPE.EAN'), value: TariffScope.EAN },
    ];
    this.segmentOptions = [
      { label: t('BILLING.TARIFF_SEGMENT.RESIDENTIAL'), value: TariffSegment.RESIDENTIAL },
      { label: t('BILLING.TARIFF_SEGMENT.PROFESSIONAL'), value: TariffSegment.PROFESSIONAL },
      { label: t('BILLING.TARIFF_SEGMENT.INDUSTRIAL'), value: TariffSegment.INDUSTRIAL },
    ];

    this.form.controls.scope.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.scope.set(value));
  }

  submit(): void {
    this.formError.set(null);
    this.form.markAllAsTouched();

    const raw = this.form.getRawValue();
    if (this.form.controls.price_per_kwh.invalid || !raw.valid_from) {
      this.formError.set(this.translate.instant('BILLING.TARIFF_DIALOG.ERRORS.REQUIRED') as string);
      return;
    }
    if (raw.scope === TariffScope.SEGMENT && raw.scope_segment == null) {
      this.formError.set(
        this.translate.instant('BILLING.TARIFF_DIALOG.ERRORS.SEGMENT_REQUIRED') as string,
      );
      return;
    }
    if (raw.scope === TariffScope.EAN && !raw.scope_ean.trim()) {
      this.formError.set(
        this.translate.instant('BILLING.TARIFF_DIALOG.ERRORS.EAN_REQUIRED') as string,
      );
      return;
    }
    if (raw.valid_to && raw.valid_from && raw.valid_to < raw.valid_from) {
      this.formError.set(
        this.translate.instant('BILLING.TARIFF_DIALOG.ERRORS.VALIDITY_ORDER') as string,
      );
      return;
    }

    const body: TariffIn = {
      kind: raw.kind,
      scope: raw.scope,
      price_per_kwh: raw.price_per_kwh.trim(),
      valid_from: toApiDate(raw.valid_from) as string,
      valid_to: toApiDate(raw.valid_to),
      label: raw.label.trim() || null,
    };
    if (raw.scope === TariffScope.SEGMENT) body.scope_segment = raw.scope_segment;
    if (raw.scope === TariffScope.EAN) body.scope_ean = raw.scope_ean.trim();

    this.submitting.set(true);
    this.service
      .createTariff(this.operationId, body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackbar.openSnackBar(
            this.translate.instant('BILLING.TARIFFS.CREATED') as string,
            VALIDATION_TYPE,
          );
          this.ref.close(true);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.errorHandler.handleError(
            error instanceof ApiResponse ? (error.data as string) : null,
          );
        },
      });
  }

  close(): void {
    this.ref.close(false);
  }
}
