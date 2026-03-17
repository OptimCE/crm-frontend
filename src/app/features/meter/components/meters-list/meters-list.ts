import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MeterPartialQuery, PartialMeterDTO } from '../../../../shared/dtos/meter.dtos';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Pagination } from '../../../../core/dtos/api.response';
import { MeterService } from '../../../../shared/services/meter.service';
import { Router } from '@angular/router';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MeterDataStatus } from '../../../../shared/types/meter.types';
import { MeterCreation } from '../meter-creation/meter-creation';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { Table, TableLazyLoadEvent, TableModule, TablePageEvent } from 'primeng/table';
import { AddressPipe } from '../../../../shared/pipes/address/address-pipe';
import { Button } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { MemberPartialPipe } from '../../../../shared/pipes/member-partial/member-partial-pipe';
import { HeaderPage } from '../../../../layout/header-page/header-page';
import { InputGroup } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { DebouncedPInputComponent } from '../../../../shared/components/debounced-p-input/debounced-p-input.component';

@Component({
  selector: 'app-meters-list',
  standalone: true,
  imports: [
    TableModule,
    AddressPipe,
    MemberPartialPipe,
    Button,
    TagModule,
    FormsModule,
    TranslatePipe,
    Select,
    HeaderPage,
    InputGroup,
    InputGroupAddonModule,
    DebouncedPInputComponent,
  ],
  templateUrl: './meters-list.html',
  styleUrl: './meters-list.css',
  providers: [DialogService],
})
export class MetersList {
  private metersService = inject(MeterService);
  private routing = inject(Router);
  private dialogService = inject(DialogService);
  private snackbar = inject(SnackbarNotification);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  ref?: DynamicDialogRef | null;

  readonly metersPartialList = signal<PartialMeterDTO[]>([]);
  readonly filter = signal<MeterPartialQuery>({ page: 1, limit: 10 });
  readonly paginationInfo = signal<Pagination>(new Pagination(1, 10, 0, 1));
  readonly currentPageReportTemplate = signal('');
  readonly loading = signal(true);

  // Filter signals
  readonly searchField = signal<string>('EAN');
  readonly searchText = signal<string>('');
  readonly statusFilter = signal<MeterDataStatus | null>(null);
  readonly hasActiveFilters = computed(() => !!this.searchText() || this.statusFilter() !== null);
  readonly firstRow = computed(
    () => (this.paginationInfo().page - 1) * this.paginationInfo().limit,
  );
  readonly showPaginator = computed(() => this.paginationInfo().total_pages > 1);

  searchFieldOptions = [
    { label: 'METER.INFORMATIONS.EAN_LABEL', value: 'EAN' },
    { label: 'METER.INFORMATIONS.METER_NUMBER_LABEL', value: 'meter_number' },
    { label: 'COMMON.ADDRESS', value: 'street' },
  ];

  statusOptions = [
    {
      label: 'METER.STATUS.ACTIVE_LABEL',
      value: MeterDataStatus.ACTIVE,
      severity: 'success' as const,
    },
    {
      label: 'METER.STATUS.INACTIVE_LABEL',
      value: MeterDataStatus.INACTIVE,
      severity: 'danger' as const,
    },
    {
      label: 'METER.STATUS.WAITING_GRD_LABEL',
      value: MeterDataStatus.WAITING_GRD,
      severity: 'warn' as const,
    },
    {
      label: 'METER.STATUS.WAITING_MANAGER_LABEL',
      value: MeterDataStatus.WAITING_MANAGER,
      severity: 'warn' as const,
    },
  ];

  constructor() {
    this.destroyRef.onDestroy(() => this.ref?.destroy());
    this.updatePaginationTranslation();
  }

  updatePaginationTranslation(): void {
    const pagination = this.paginationInfo();
    this.translate
      .get('METER.LIST.PAGE_REPORT_TEMPLATE_METER_LABEL', {
        page: pagination.page,
        total_pages: pagination.total_pages,
        total: pagination.total,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translatedText: string) => {
        this.currentPageReportTemplate.set(translatedText);
      });
  }

  loadMeters(): void {
    this.loading.set(true);
    this.metersService
      .getMetersList(this.filter())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response) {
            this.metersPartialList.set(response.data as PartialMeterDTO[]);
            this.paginationInfo.set(response.pagination);
            this.updatePaginationTranslation();
          } else {
            console.error('Error fetching meters partial list');
          }
          this.loading.set(false);
        },
        error: (_error) => {
          this.loading.set(false);
          console.error('Error fetching meters partial list');
        },
      });
  }

  applyFilters(): void {
    const current: MeterPartialQuery = { page: 1, limit: this.filter().limit };
    const text = this.searchText();
    if (text) {
      const field = this.searchField();
      if (field === 'EAN') {
        current.EAN = text;
      } else if (field === 'meter_number') {
        current.meter_number = text;
      } else if (field === 'street') {
        current.street = text;
      }
    }
    const status = this.statusFilter();
    if (status !== null) {
      current.status = status;
    }
    this.filter.set(current);
    this.loadMeters();
  }

  onSearchTextChange(query: string): void {
    this.searchText.set(query);
    this.applyFilters();
  }

  onSearchFieldChange(): void {
    if (this.searchText()) {
      this.applyFilters();
    }
  }

  onStatusFilterChange(status: MeterDataStatus | null): void {
    this.statusFilter.set(status);
    this.applyFilters();
  }

  onRowClick(meter: PartialMeterDTO): void {
    void this.routing.navigate(['/meters/' + meter.EAN]);
  }

  onAddMeter(): void {
    this.ref = this.dialogService.open(MeterCreation, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('METER.LIST.ADD_METER_HEADER') as string,
    });
    if (this.ref) {
      this.ref.onClose.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((response) => {
        if (response) {
          this.snackbar.openSnackBar(
            this.translate.instant('METER.LIST.METER_ADDED_SUCCESSFULLY_LABEL') as string,
            VALIDATION_TYPE,
          );
          this.loadMeters();
        }
      });
    }
  }

  lazyLoadMeters($event: TableLazyLoadEvent): void {
    const current: MeterPartialQuery = { ...this.filter() };
    if ($event.first !== undefined && $event.rows !== undefined) {
      current.page = $event.rows ? $event.first / $event.rows + 1 : 1;
    }
    if (current.page < 1) {
      current.page = 1;
    }
    this.filter.set(current);
    this.loadMeters();
  }

  pageChange($event: TablePageEvent): void {
    const current: MeterPartialQuery = { ...this.filter() };
    current.page = ($event.first ?? 0) / ($event.rows ?? 10) + 1;
    this.filter.set(current);
    this.loadMeters();
  }

  clear(table: Table): void {
    table.clear();
    this.searchText.set('');
    this.searchField.set('EAN');
    this.statusFilter.set(null);
    this.filter.set({ page: 1, limit: 10 });
    this.loadMeters();
  }

  protected readonly MeterStatus = MeterDataStatus;
}
