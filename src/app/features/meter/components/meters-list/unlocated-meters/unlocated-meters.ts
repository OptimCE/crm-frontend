import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import {
  AddressAutocomplete,
  AddressPicked,
} from '../../../../../shared/components/address-autocomplete/address-autocomplete';
import {
  prefixedAddressNames,
  readAddressFields,
} from '../../../../../shared/components/address-autocomplete/address-field-source';
import {
  AddressPickStore,
  withPickedGeo,
} from '../../../../../shared/components/address-autocomplete/address-pick-store';
import { MeterPartialQuery, PartialMeterDTO } from '../../../../../shared/dtos/meter.dtos';
import { MeterService } from '../../../../../shared/services/meter.service';
import { ErrorMessageHandler } from '../../../../../shared/services-ui/error.message.handler';

/** The map's active filters, so the dialog repairs what the map is missing. */
export interface UnlocatedMetersDialogData {
  query: MeterPartialQuery;
}

const PAGE_SIZE = 50;

/**
 * Fix the addresses behind the map's "N meters have no coordinates yet" strip.
 *
 * One meter at a time, with the picker: the point is to drain the counter, so
 * saving advances to the next row rather than closing.
 *
 * It reuses `AddressAutocomplete` and five plain inputs rather than the
 * `MeterUpdate` dialog. `MeterUpdate` is `DynamicDialogConfig`-driven, needs a
 * full `MetersDTO`, and closes its own ref on submit — nesting one per meter
 * would defeat the whole "repair many" shape.
 */
@Component({
  selector: 'app-unlocated-meters',
  standalone: true,
  imports: [ReactiveFormsModule, InputText, Button, TranslatePipe, AddressAutocomplete],
  templateUrl: './unlocated-meters.html',
  styleUrl: './unlocated-meters.css',
  providers: [ErrorMessageHandler],
})
export class UnlocatedMeters {
  private readonly meterService = inject(MeterService);
  private readonly config = inject(DynamicDialogConfig);
  private readonly ref = inject(DynamicDialogRef);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  readonly meters = signal<PartialMeterDTO[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly repairedCount = signal(0);
  /** Index into {@link meters}; the first row is selected on open. */
  readonly selectedIndex = signal(0);

  readonly selected = computed(() => this.meters()[this.selectedIndex()] ?? null);
  readonly total = computed(() => this.meters().length);
  readonly isEmpty = computed(() => !this.loading() && this.total() === 0);

  readonly addressForm = new FormGroup({
    address_street: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    address_number: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    address_supplement: new FormControl('', { nonNullable: true }),
    address_postcode: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    address_city: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly addressSource = computed(() => ({
    group: this.addressForm,
    names: prefixedAddressNames('address'),
  }));
  protected readonly addressPick = new AddressPickStore();

  constructor() {
    this.load();
  }

  private load(): void {
    const data = this.config.data as UnlocatedMetersDialogData | undefined;
    // Carry the map's own filters through: the strip's count is computed over
    // them, so a dialog that ignored them would fix meters that were never on
    // screen and the visible number would not move.
    //
    // `located: false` is wider than "has no coordinate" — it also picks up the
    // commune-centroid pins, which is most of an existing database and the whole
    // reason this dialog is worth opening.
    const query: MeterPartialQuery = {
      ...(data?.query ?? {}),
      located: false,
      page: 1,
      limit: PAGE_SIZE,
    };

    this.meterService
      .getMetersList(query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.meters.set(Array.isArray(response.data) ? response.data : []);
          this.loading.set(false);
          this.selectRow(0);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorHandler.handleError(error);
        },
      });
  }

  selectRow(index: number): void {
    this.selectedIndex.set(index);
    const meter = this.meters()[index];
    this.addressPick.clear();
    this.addressForm.reset({
      address_street: meter?.address.street ?? '',
      address_number: meter?.address.number ?? '',
      address_supplement: meter?.address.supplement ?? '',
      address_postcode: meter?.address.postcode ?? '',
      address_city: meter?.address.city ?? '',
    });
  }

  protected onAddressPicked(event: AddressPicked): void {
    this.addressForm.patchValue({
      address_street: event.fields.street,
      address_number: event.fields.number,
      address_postcode: event.fields.postcode,
      address_city: event.fields.city,
    });
    this.addressPick.remember(event);
  }

  save(): void {
    const meter = this.selected();
    if (!meter || this.addressForm.invalid || this.saving()) {
      return;
    }
    this.saving.set(true);
    const value = this.addressForm.getRawValue();

    this.meterService
      .updateMeterAddress({
        EAN: meter.EAN,
        address: withPickedGeo(
          {
            street: value.address_street,
            number: value.address_number,
            postcode: value.address_postcode,
            city: value.address_city,
            supplement: value.address_supplement || undefined,
          },
          this.addressPick.geoFor(readAddressFields(this.addressSource())),
        ),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.repairedCount.update((n) => n + 1);
          this.dropCurrentAndAdvance();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.errorHandler.handleError(error);
        },
      });
  }

  skip(): void {
    const next = this.selectedIndex() + 1;
    this.selectRow(next < this.total() ? next : 0);
  }

  /**
   * A repaired meter leaves the queue immediately.
   *
   * Removing it locally rather than refetching keeps the operator's place: a
   * refetch would renumber every row under them mid-repair.
   */
  private dropCurrentAndAdvance(): void {
    const index = this.selectedIndex();
    this.meters.update((rows) => rows.filter((_, i) => i !== index));
    const remaining = this.total();
    this.selectRow(remaining === 0 ? 0 : Math.min(index, remaining - 1));
  }

  close(): void {
    // Report whether anything changed, so the caller only refetches the map when
    // there is something new to draw.
    this.ref.close(this.repairedCount() > 0);
  }
}
