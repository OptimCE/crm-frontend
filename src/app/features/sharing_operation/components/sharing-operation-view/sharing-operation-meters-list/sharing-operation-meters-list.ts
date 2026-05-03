import { Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Table, TableLazyLoadEvent, TableModule, TablePageEvent } from 'primeng/table';
import { PartialMeterDTO } from '../../../../../shared/dtos/meter.dtos';
import { Pagination } from '../../../../../core/dtos/api.response';
import {
  PatchMeterToSharingOperationDTO,
  SharingOperationMetersQuery,
  SharingOperationMetersQueryType,
} from '../../../../../shared/dtos/sharing_operation.dtos';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SharingOperationService } from '../../../../../shared/services/sharing_operation.service';
import { Button } from 'primeng/button';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { AddressPipe } from '../../../../../shared/pipes/address/address-pipe';
import { Toast } from 'primeng/toast';
import { ConfirmPopup } from 'primeng/confirmpopup';
import { DatePicker } from 'primeng/datepicker';
import { Ripple } from 'primeng/ripple';
import { MeterDataStatus } from '../../../../../shared/types/meter.types';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { ErrorMessageHandler } from '../../../../../shared/services-ui/error.message.handler';
import { Router } from '@angular/router';
import { SharingOperationMeterEventService } from '../sharing-operation.meter.subjet';
import { InputGroup } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { DebouncedPInputComponent } from '../../../../../shared/components/debounced-p-input/debounced-p-input.component';
import { toLocalDateString } from '../../../../../shared/utils/date.utils';

@Component({
  selector: 'app-sharing-operation-meters-list',
  imports: [
    TableModule,
    Button,
    TranslatePipe,
    FormsModule,
    Select,
    Tag,
    AddressPipe,
    Toast,
    ConfirmPopup,
    DatePicker,
    Ripple,
    InputGroup,
    InputGroupAddonModule,
    DebouncedPInputComponent,
  ],
  templateUrl: './sharing-operation-meters-list.html',
  styleUrl: './sharing-operation-meters-list.css',
  providers: [DialogService, ConfirmationService, MessageService, ErrorMessageHandler],
})
export class SharingOperationMetersList implements OnInit {
  readonly id_sharing = input.required<number>();
  readonly type = input.required<SharingOperationMetersQueryType>();
  private destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);
  private sharingOperationService = inject(SharingOperationService);
  private errorHandler = inject(ErrorMessageHandler);
  private confirmationService = inject(ConfirmationService);
  private routing = inject(Router);
  private meterEventService = inject(SharingOperationMeterEventService);

  readonly metersPartialList = signal<PartialMeterDTO[]>([]);
  readonly loading = signal<boolean>(true);
  readonly pagination = signal<Pagination>({ total: 0, total_pages: 0, page: 0, limit: 0 });
  readonly filter = signal<Omit<SharingOperationMetersQuery, 'type'>>({
    page: 1,
    limit: 10,
  });
  readonly currentPageReportTemplate = signal<string>('');
  readonly textChangeStatusMeter = signal<string>('');
  readonly dateStartMeter = signal<Date | string | null>(null);
  readonly minDate = signal<Date>(new Date());

  // Filter signals
  readonly searchField = signal<string>('EAN');
  readonly searchText = signal<string>('');
  readonly statusFilter = signal<MeterDataStatus | null>(null);
  // PAST tab range filter (start_date_from .. end_date_to).
  readonly pastStartDate = signal<Date | null>(null);
  readonly pastEndDate = signal<Date | null>(null);
  // FUTURE tab snapshot date.
  readonly futureAt = signal<Date | null>(null);
  readonly hasActiveFilters = computed(
    () =>
      !!this.searchText() ||
      this.statusFilter() !== null ||
      this.pastStartDate() !== null ||
      this.pastEndDate() !== null ||
      this.futureAt() !== null,
  );
  readonly today = computed(() => toLocalDateString(new Date()));
  readonly QueryType = SharingOperationMetersQueryType;
  readonly firstRow = computed(() => (this.pagination().page - 1) * this.pagination().limit);
  readonly showPaginator = computed(() => this.pagination().total_pages > 1);

  searchFieldOptions = [
    { label: 'SHARING_OPERATION.VIEW.METER.INFORMATIONS.EAN_LABEL', value: 'EAN' },
    {
      label: 'SHARING_OPERATION.VIEW.METER.INFORMATIONS.METER_NUMBER_LABEL',
      value: 'meter_number',
    },
    { label: 'SHARING_OPERATION.VIEW.ADDRESS.STREET_NAME_LABEL', value: 'street' },
    { label: 'SHARING_OPERATION.VIEW.ADDRESS.CITY_LABEL', value: 'city' },
  ];

  statusOptions = [
    {
      label: 'SHARING_OPERATION.VIEW.METER.STATUS.ACTIVATED_LABEL',
      value: MeterDataStatus.ACTIVE,
      severity: 'success' as const,
    },
    {
      label: 'SHARING_OPERATION.VIEW.METER.STATUS.DEACTIVATED_LABEL',
      value: MeterDataStatus.INACTIVE,
      severity: 'danger' as const,
    },
    {
      label: 'SHARING_OPERATION.VIEW.METER.STATUS.WAITING_FOR_GRD_ACCEPTANCE_LABEL',
      value: MeterDataStatus.WAITING_GRD,
      severity: 'warn' as const,
    },
    {
      label: 'SHARING_OPERATION.VIEW.METER.STATUS.WAITING_FOR_MANAGER_ACCEPTANCE_LABEL',
      value: MeterDataStatus.WAITING_MANAGER,
      severity: 'warn' as const,
    },
  ];

  ngOnInit(): void {
    this.meterEventService.meterAdded$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((): void => this.loadMetersSharingOperation());
  }

  private loadMetersSharingOperation(): void {
    this.loading.set(true);
    this.sharingOperationService
      .getSharingOperationMetersList(this.id_sharing(), this.type(), this.filter())
      .subscribe({
        next: (response) => {
          if (response) {
            this.metersPartialList.set(response.data as PartialMeterDTO[]);
            this.pagination.set(response.pagination);
            this.updatePaginationTranslation();
            this.loading.set(false);
          }
        },
        error: (error: { data?: unknown }) => {
          this.errorHandler.handleError(error.data ?? null);
          this.loading.set(false);
        },
      });
  }

  applyFilters(): void {
    const current: Omit<SharingOperationMetersQuery, 'type'> = {
      page: 1,
      limit: this.filter().limit,
    };
    const text = this.searchText();
    if (text) {
      const field = this.searchField();
      if (field === 'EAN') current.EAN = text;
      else if (field === 'meter_number') current.meter_number = text;
      else if (field === 'street') current.street = text;
      else if (field === 'city') current.city = text;
    }
    const status = this.statusFilter();
    if (status !== null) current.status = status;
    // PAST tab range filter — only meaningful when type === PAST.
    if (this.type() === SharingOperationMetersQueryType.PAST) {
      const from = this.pastStartDate();
      const to = this.pastEndDate();
      if (from) current.start_date_from = toLocalDateString(from);
      if (to) current.end_date_to = toLocalDateString(to);
    }
    // FUTURE tab snapshot date — only meaningful when type === FUTURE.
    if (this.type() === SharingOperationMetersQueryType.FUTURE) {
      const at = this.futureAt();
      if (at) current.future_at = toLocalDateString(at);
    }
    this.filter.set(current);
    this.loadMetersSharingOperation();
  }

  onSearchTextChange(query: string): void {
    this.searchText.set(query);
    this.applyFilters();
  }

  onSearchFieldChange(): void {
    if (this.searchText()) this.applyFilters();
  }

  onStatusFilterChange(status: MeterDataStatus | null): void {
    this.statusFilter.set(status);
    this.applyFilters();
  }

  protected lazyLoadMeter($event: TableLazyLoadEvent): void {
    const current: Omit<SharingOperationMetersQuery, 'type'> = { ...this.filter() };
    if ($event.first !== undefined && $event.rows !== undefined) {
      current.page = $event.rows ? $event.first / $event.rows + 1 : 1;
    }
    if (current.page < 1) current.page = 1;
    this.filter.set(current);
    this.loadMetersSharingOperation();
  }

  updatePaginationTranslation(): void {
    this.translate
      .get('SHARING_OPERATION.VIEW.METER.PAGE_REPORT_TEMPLATE_METER_LABEL', {
        page: this.pagination().page,
        total_pages: this.pagination().total_pages,
        total: this.pagination().total,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translatedText: string) => {
        this.currentPageReportTemplate.set(translatedText);
      });
  }

  protected pageChange($event: TablePageEvent): void {
    const current: Omit<SharingOperationMetersQuery, 'type'> = { ...this.filter() };
    if ($event.rows) {
      current.page = ($event.first ?? 0) / $event.rows + 1;
    }
    this.filter.set(current);
    this.loadMetersSharingOperation();
  }

  clear(table: Table): void {
    table.clear();
    this.searchText.set('');
    this.searchField.set('EAN');
    this.statusFilter.set(null);
    this.pastStartDate.set(null);
    this.pastEndDate.set(null);
    this.futureAt.set(null);
    this.filter.set({ page: 1, limit: 10 });
    this.loadMetersSharingOperation();
  }

  openMeterChangeStatusPopup(event: Event, meter: PartialMeterDTO, action: number): void {
    event.stopPropagation();
    if (action == 1) {
      this.textChangeStatusMeter.set(
        this.translate.instant(
          'SHARING_OPERATION.VIEW.METER.CHANGE_STATUS_METER_STARTING_LABEL',
        ) as string,
      );
    } else if (action == 2) {
      this.textChangeStatusMeter.set(
        this.translate.instant(
          'SHARING_OPERATION.VIEW.METER.CHANGE_STATUS_METER_ENDING_LABEL',
        ) as string,
      );
    } else if (action == 3) {
      this.textChangeStatusMeter.set(
        this.translate.instant(
          'SHARING_OPERATION.VIEW.METER.CHANGE_STATUS_METER_WAITING_LABEL',
        ) as string,
      );
    }
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      acceptIcon: 'pi pi-check',
      rejectIcon: 'pi pi-times',
      acceptLabel: this.translate.instant('COMMON.ACTIONS.VALIDATE') as string,
      rejectLabel: this.translate.instant('COMMON.ACTIONS.CANCEL') as string,
      accept: () => {
        if (action == 1) {
          this.approveMeter(meter);
        } else if (action == 2) {
          this.removeMeter(meter);
        } else if (action == 3) {
          this.putMeterToWaiting(meter);
        }
      },
    });
  }

  private resolvePickedDate(value: Date | string | null): string {
    if (!value) return toLocalDateString(new Date());
    return toLocalDateString(value instanceof Date ? value : new Date(value));
  }

  approveMeter(meter: PartialMeterDTO): void {
    const patchedMeterStatus: PatchMeterToSharingOperationDTO = {
      date: this.resolvePickedDate(this.dateStartMeter()),
      id_meter: meter.EAN,
      id_sharing: this.id_sharing(),
      status: MeterDataStatus.ACTIVE,
    };

    this.sharingOperationService
      .patchMeterStatus(patchedMeterStatus)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response) {
            this.loadMetersSharingOperation();
          }
        },
        error: (error: { data?: unknown }) => {
          this.errorHandler.handleError(error.data ?? null);
        },
      });

    this.dateStartMeter.set(null);
  }

  removeMeter(meter: PartialMeterDTO): void {
    const patchedMeterStatus: PatchMeterToSharingOperationDTO = {
      date: this.resolvePickedDate(this.dateStartMeter()),
      id_meter: meter.EAN,
      id_sharing: this.id_sharing(),
      status: MeterDataStatus.INACTIVE,
    };
    this.sharingOperationService
      .patchMeterStatus(patchedMeterStatus)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response) {
            this.loadMetersSharingOperation();
          }
        },
        error: (error: { data?: unknown }) => {
          this.errorHandler.handleError(error.data ?? null);
        },
      });

    this.dateStartMeter.set(null);
  }

  putMeterToWaiting(meter: PartialMeterDTO): void {
    const patchedMeterStatus: PatchMeterToSharingOperationDTO = {
      date: this.resolvePickedDate(this.dateStartMeter()),
      id_meter: meter.EAN,
      id_sharing: this.id_sharing(),
      status: MeterDataStatus.WAITING_GRD,
    };
    this.sharingOperationService
      .patchMeterStatus(patchedMeterStatus)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response) {
            this.loadMetersSharingOperation();
          }
        },
        error: (error: { data?: unknown }) => {
          this.errorHandler.handleError(error.data ?? null);
        },
      });

    this.dateStartMeter.set(null);
  }

  /**
   * True when the row's MeterData has not yet started — only such rows can be hard-deleted.
   */
  isFutureRow(meter: PartialMeterDTO): boolean {
    return !!meter.start_date && meter.start_date > this.today();
  }

  /**
   * Hard-delete a never-started future row: removes the MeterData record and reopens the
   * predecessor record's end_date if it was closed by this row's creation.
   */
  hardDeleteMeter(event: Event, meter: PartialMeterDTO): void {
    event.stopPropagation();
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      acceptIcon: 'pi pi-check',
      rejectIcon: 'pi pi-times',
      acceptLabel: this.translate.instant('COMMON.ACTIONS.VALIDATE') as string,
      rejectLabel: this.translate.instant('COMMON.ACTIONS.CANCEL') as string,
      message: this.translate.instant(
        'SHARING_OPERATION.VIEW.METER.HARD_DELETE_CONFIRM_LABEL',
      ) as string,
      accept: () => {
        this.sharingOperationService
          .deleteMeterFromSharingOperation(this.id_sharing(), {
            id_meter: meter.EAN,
            id_sharing: this.id_sharing(),
            hard_delete: true,
          })
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (response) => {
              if (response) {
                this.loadMetersSharingOperation();
              }
            },
            error: (error: { data?: unknown }) => {
              this.errorHandler.handleError(error.data ?? null);
            },
          });
      },
    });
  }

  onRowClick(meter: PartialMeterDTO): void {
    void this.routing.navigate(['/meters/' + meter.EAN]);
  }

  public MeterStatus = MeterDataStatus;
}
