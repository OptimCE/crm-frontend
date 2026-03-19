import { Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Table, TableLazyLoadEvent, TableModule, TablePageEvent } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { Select } from 'primeng/select';
import { InputGroup } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { MeterPartialQuery, PartialMeterDTO } from '../../../../../../../shared/dtos/meter.dtos';
import { Pagination } from '../../../../../../../core/dtos/api.response';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { MeterService } from '../../../../../../../shared/services/meter.service';
import { Router } from '@angular/router';
import { SnackbarNotification } from '../../../../../../../shared/services-ui/snackbar.notifcation.service';
import { MeterDataStatus } from '../../../../../../../shared/types/meter.types';
import { MeterCreation } from '../../../../../../meter/components/meter-creation/meter-creation';
import { VALIDATION_TYPE } from '../../../../../../../core/dtos/notification';
import { AddressPipe } from '../../../../../../../shared/pipes/address/address-pipe';
import { ErrorMessageHandler } from '../../../../../../../shared/services-ui/error.message.handler';
import { DebouncedPInputComponent } from '../../../../../../../shared/components/debounced-p-input/debounced-p-input.component';

@Component({
  selector: 'app-member-view-meter-tab',
  imports: [
    Button,
    TranslatePipe,
    TableModule,
    TagModule,
    Select,
    FormsModule,
    AddressPipe,
    InputGroup,
    InputGroupAddonModule,
    DebouncedPInputComponent,
  ],
  templateUrl: './member-view-meter-tab.html',
  styleUrl: './member-view-meter-tab.css',
  providers: [DialogService, ErrorMessageHandler],
})
export class MemberViewMeterTab implements OnInit {
  private meterService = inject(MeterService);
  private translate = inject(TranslateService);
  private routing = inject(Router);
  private dialogService = inject(DialogService);
  private snackbar = inject(SnackbarNotification);
  private errorHandler = inject(ErrorMessageHandler);
  private destroyRef = inject(DestroyRef);
  readonly id = input.required<number>();

  readonly filter = signal<MeterPartialQuery>({ page: 1, limit: 10 });
  readonly paginationMetersInfo = signal<Pagination>(new Pagination(1, 10, 0, 1));
  readonly metersPartialList = signal<PartialMeterDTO[]>([]);
  readonly currentPageReportTemplate = signal<string>('');
  ref?: DynamicDialogRef | null;

  // Signal-based filter state
  readonly searchField = signal<string>('EAN');
  readonly searchText = signal<string>('');
  readonly statusFilter = signal<MeterDataStatus | null>(null);
  readonly hasActiveFilters = computed(() => !!this.searchText() || this.statusFilter() !== null);

  searchFieldOptions = [
    { label: 'MEMBER.VIEW.METERS.ADDRESS_LABEL', value: 'street' },
    { label: 'MEMBER.VIEW.METERS.EAN_LABEL', value: 'EAN' },
    { label: 'MEMBER.VIEW.METERS.METER_NUMBER_LABEL', value: 'meter_number' },
  ];

  statusCategory = [
    MeterDataStatus.ACTIVE,
    MeterDataStatus.INACTIVE,
    MeterDataStatus.WAITING_GRD,
    MeterDataStatus.WAITING_MANAGER,
  ];

  // Pagination computed signals
  readonly firstRow = computed(
    () => (this.paginationMetersInfo().page - 1) * this.paginationMetersInfo().limit,
  );
  readonly showPaginator = computed(() => this.paginationMetersInfo().total_pages > 1);

  constructor() {
    this.destroyRef.onDestroy(() => this.ref?.destroy());
  }

  ngOnInit(): void {
    this.filter.set({ page: 1, limit: 10, holder_id: this.id() });
    this.updateMeterPaginationTranslation();
  }

  applyFilters(): void {
    const current: MeterPartialQuery = {
      page: 1,
      limit: this.filter().limit,
      holder_id: this.id(),
    };

    const text = this.searchText();
    if (text) {
      const field = this.searchField();
      if (field === 'street') current.street = text;
      else if (field === 'EAN') current.EAN = text;
      else if (field === 'meter_number') current.meter_number = text;
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

  loadMeters(): void {
    this.meterService
      .getMetersList(this.filter())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response) {
            this.metersPartialList.set(response.data as PartialMeterDTO[]);
            this.paginationMetersInfo.set(response.pagination);
            this.updateMeterPaginationTranslation();
          } else {
            this.errorHandler.handleError(response);
          }
        },
        error: (error) => {
          this.errorHandler.handleError(error);
        },
      });
  }

  lazyLoadMeters($event: TableLazyLoadEvent): void {
    const current: MeterPartialQuery = { ...this.filter() };

    if ($event.first !== undefined && $event.rows !== undefined) {
      if ($event.rows) {
        current.page = $event.first / $event.rows + 1;
      } else {
        current.page = 1;
      }
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

  updateMeterPaginationTranslation(): void {
    this.translate
      .get('MEMBER.VIEW.METERS.PAGE_REPORT_TEMPLATE_METER_LABEL', {
        page: this.paginationMetersInfo().page,
        total_pages: this.paginationMetersInfo().total_pages,
        total: this.paginationMetersInfo().total,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translatedText: string) => {
        this.currentPageReportTemplate.set(translatedText);
      });
  }

  clear(table: Table): void {
    table.clear();
    this.searchText.set('');
    this.statusFilter.set(null);
    this.searchField.set('EAN');
    this.filter.set({ page: 1, limit: 10, holder_id: this.id() });
    this.loadMeters();
  }

  onRowClick(meter: PartialMeterDTO): void {
    void this.routing.navigate(['/members/meter/' + meter.EAN]);
  }

  toAddMeter(): void {
    this.ref = this.dialogService.open(MeterCreation, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      width: '700px',
      header: this.translate.instant('MEMBER.VIEW.METERS.ADD_A_METER_HEADER') as string,
      data: {
        holder_id: this.id(),
      },
    });
    if (this.ref) {
      this.ref.onClose.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((response) => {
        if (response) {
          this.snackbar.openSnackBar(
            this.translate.instant('MEMBER.VIEW.METERS.METER_ADDED_SUCCESSFULLY_LABEL') as string,
            VALIDATION_TYPE,
          );
          this.loadMeters();
        }
      });
    }
  }

  protected readonly MeterDataStatus = MeterDataStatus;
}
