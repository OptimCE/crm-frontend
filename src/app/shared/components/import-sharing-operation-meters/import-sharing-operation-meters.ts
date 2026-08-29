import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { Button } from 'primeng/button';
import { TranslatePipe } from '@ngx-translate/core';
import { Tag } from 'primeng/tag';
import { FormsModule } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';
import { DatePicker } from 'primeng/datepicker';
import { Select } from 'primeng/select';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { AddressPipe } from '../../pipes/address/address-pipe';
import { SharingOperationService } from '../../services/sharing_operation.service';
import {
  SharingOperationMetersQuery,
  SharingOperationMetersQueryType,
  SharingOperationPartialDTO,
} from '../../dtos/sharing_operation.dtos';
import { isConsumerMeter, PartialMeterDTO } from '../../dtos/meter.dtos';
import { Pagination } from '../../../core/dtos/api.response';
import { MeterDataStatus } from '../../types/meter.types';
import { toLocalDateString } from '../../utils/date.utils';
import { ErrorMessageHandler } from '../../services-ui/error.message.handler';

/**
 * Dialog input.
 *
 * When `idSharing` is provided the operation is fixed (the dialog was opened from that
 * operation's page). When it is omitted the dialog lets the user pick one of the community's
 * operations first — that is the entry point used from the allocation-key creation page.
 */
export interface ImportSharingOperationMetersData {
  idSharing?: number;
}

/**
 * Page size used when a whole list is wanted in one request — the operations dropdown, and the
 * "select all" action that has to reach beyond the visible page.
 */
const FETCH_ALL_LIMIT = 9999;

/**
 * Picks the meters registered in a sharing operation on a given date, and returns their EANs.
 *
 * The date drives an `AT_DATE` snapshot query, whose bounds are inclusive on both sides — a meter
 * leaving the operation on the chosen date is still part of it that day.
 *
 * Consumers (meters with no injection status) are pre-ticked, since an allocation key allocates
 * energy to consumers; injection points are listed but left unticked. The user can adjust freely.
 *
 * Closes with `string[]` of selected EANs, or `null` when cancelled.
 */
@Component({
  selector: 'app-import-sharing-operation-meters',
  imports: [
    TableModule,
    Button,
    TranslatePipe,
    FormsModule,
    Tag,
    AddressPipe,
    CheckboxModule,
    DatePicker,
    Select,
  ],
  templateUrl: './import-sharing-operation-meters.html',
  styleUrl: './import-sharing-operation-meters.css',
  providers: [ErrorMessageHandler],
})
export class ImportSharingOperationMeters implements OnInit {
  private sharingOperationService = inject(SharingOperationService);
  private ref = inject(DynamicDialogRef);
  private config = inject(DynamicDialogConfig);
  private errorHandler = inject(ErrorMessageHandler);
  private destroyRef = inject(DestroyRef);

  private readonly fixedIdSharing = (this.config.data as ImportSharingOperationMetersData | null)
    ?.idSharing;

  /** True when the dialog has to ask which operation to import from. */
  readonly needsOperationChoice = this.fixedIdSharing === undefined;

  readonly operations = signal<SharingOperationPartialDTO[]>([]);
  readonly loadingOperations = signal<boolean>(false);
  readonly selectedOperationId = signal<number | null>(this.fixedIdSharing ?? null);

  readonly date = signal<Date>(new Date());

  readonly meters = signal<PartialMeterDTO[]>([]);
  readonly loading = signal<boolean>(false);
  readonly pagination = signal<Pagination>(new Pagination(1, 10, 0, 0));
  readonly filter = signal<Omit<SharingOperationMetersQuery, 'type'>>({ page: 1, limit: 10 });

  /** Currently ticked EANs. Replaced (never mutated) so the signal actually notifies. */
  readonly selectedEans = signal<ReadonlySet<string>>(new Set<string>());

  /**
   * EANs already shown to the user at least once.
   *
   * Pre-ticking only ever applies to rows the user has not seen yet, so paginating back and forth
   * never re-ticks something they deliberately unticked. Cleared whenever the snapshot changes.
   */
  private seenEans = new Set<string>();

  ngOnInit(): void {
    if (this.needsOperationChoice) {
      this.loadOperations();
    } else {
      this.loadMeters();
    }
  }

  private loadOperations(): void {
    this.loadingOperations.set(true);
    this.sharingOperationService
      .getSharingOperationList({ page: 1, limit: FETCH_ALL_LIMIT })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.operations.set((response?.data as SharingOperationPartialDTO[]) ?? []);
          this.loadingOperations.set(false);
        },
        error: (error: unknown) => {
          this.errorHandler.handleError(error);
          this.loadingOperations.set(false);
        },
      });
  }

  /** The snapshot changed — everything selected so far refers to a different set of meters. */
  private resetSelection(): void {
    this.selectedEans.set(new Set<string>());
    this.seenEans = new Set<string>();
    this.filter.set({ ...this.filter(), page: 1 });
  }

  onOperationChange(id: number): void {
    this.selectedOperationId.set(id);
    this.resetSelection();
    this.loadMeters();
  }

  onDateChange(date: Date | null): void {
    if (!date) return;
    this.date.set(date);
    this.resetSelection();
    this.loadMeters();
  }

  loadMeters(): void {
    const idSharing = this.selectedOperationId();
    if (idSharing === null) return;

    this.loading.set(true);
    this.sharingOperationService
      .getSharingOperationMetersList(idSharing, SharingOperationMetersQueryType.AT_DATE, {
        ...this.filter(),
        at: toLocalDateString(this.date()),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const rows = (response?.data as PartialMeterDTO[]) ?? [];
          this.meters.set(rows);
          this.pagination.set(response.pagination);
          this.preTickUnseenConsumers(rows);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.errorHandler.handleError(error);
          this.loading.set(false);
        },
      });
  }

  /** Tick the consumers among rows the user is seeing for the first time. */
  private preTickUnseenConsumers(rows: PartialMeterDTO[]): void {
    const next = new Set(this.selectedEans());
    let changed = false;
    for (const meter of rows) {
      if (this.seenEans.has(meter.EAN)) continue;
      this.seenEans.add(meter.EAN);
      if (isConsumerMeter(meter)) {
        next.add(meter.EAN);
        changed = true;
      }
    }
    if (changed) this.selectedEans.set(next);
  }

  lazyLoad(event: TableLazyLoadEvent): void {
    const current = { ...this.filter() };
    if (event.first !== undefined && event.rows) {
      current.page = event.first / event.rows + 1;
      current.limit = event.rows;
    }
    const eanFilter = event.filters?.['EAN'];
    if (eanFilter && !Array.isArray(eanFilter) && eanFilter.value) {
      current.EAN = eanFilter.value as string;
    } else {
      delete current.EAN;
    }
    this.filter.set(current);
    this.loadMeters();
  }

  // --- Selection ---

  isSelected(ean: string): boolean {
    return this.selectedEans().has(ean);
  }

  toggleMeter(ean: string): void {
    const next = new Set(this.selectedEans());
    if (!next.delete(ean)) next.add(ean);
    this.selectedEans.set(next);
  }

  isPageFullySelected(): boolean {
    const rows = this.meters();
    return rows.length > 0 && rows.every((m) => this.selectedEans().has(m.EAN));
  }

  togglePage(selectAll: boolean): void {
    const next = new Set(this.selectedEans());
    for (const meter of this.meters()) {
      if (selectAll) next.add(meter.EAN);
      else next.delete(meter.EAN);
    }
    this.selectedEans.set(next);
  }

  /** Ticks every meter matching the current snapshot, not just the visible page. */
  selectAll(): void {
    const idSharing = this.selectedOperationId();
    if (idSharing === null) return;

    this.sharingOperationService
      .getSharingOperationMetersList(idSharing, SharingOperationMetersQueryType.AT_DATE, {
        ...this.filter(),
        at: toLocalDateString(this.date()),
        page: 1,
        limit: FETCH_ALL_LIMIT,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const next = new Set(this.selectedEans());
          for (const meter of (response?.data as PartialMeterDTO[]) ?? []) {
            next.add(meter.EAN);
            this.seenEans.add(meter.EAN);
          }
          this.selectedEans.set(next);
        },
        error: (error: unknown) => this.errorHandler.handleError(error),
      });
  }

  clearAll(): void {
    this.selectedEans.set(new Set<string>());
  }

  /**
   * Translation key for a meter status. Reuses the sharing-operation status labels rather than
   * duplicating them — without this the tag would render the raw enum number.
   */
  getStatusLabel(status: MeterDataStatus): string {
    const map: Record<MeterDataStatus, string> = {
      [MeterDataStatus.ACTIVE]: 'SHARING_OPERATION.VIEW.METER.STATUS.ACTIVATED_LABEL',
      [MeterDataStatus.INACTIVE]: 'SHARING_OPERATION.VIEW.METER.STATUS.DEACTIVATED_LABEL',
      [MeterDataStatus.WAITING_GRD]:
        'SHARING_OPERATION.VIEW.METER.STATUS.WAITING_FOR_GRD_ACCEPTANCE_LABEL',
      [MeterDataStatus.WAITING_MANAGER]:
        'SHARING_OPERATION.VIEW.METER.STATUS.WAITING_FOR_MANAGER_ACCEPTANCE_LABEL',
    };
    return map[status] ?? '';
  }

  getStatusSeverity(status: MeterDataStatus): 'success' | 'danger' | 'warn' | 'info' {
    const map: Record<MeterDataStatus, 'success' | 'danger' | 'warn' | 'info'> = {
      [MeterDataStatus.ACTIVE]: 'success',
      [MeterDataStatus.INACTIVE]: 'danger',
      [MeterDataStatus.WAITING_GRD]: 'warn',
      [MeterDataStatus.WAITING_MANAGER]: 'warn',
    };
    return map[status] ?? 'info';
  }

  protected readonly isConsumerMeter = isConsumerMeter;

  confirm(): void {
    this.ref.close([...this.selectedEans()]);
  }

  cancel(): void {
    this.ref.close(null);
  }
}
