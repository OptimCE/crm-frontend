import { Component, computed, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Table, TableLazyLoadEvent, TableModule, TablePageEvent } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { Select } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputGroup } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { MeService } from '../../../../../../../shared/services/me.service';
import { MeMetersPartialQuery, MePartialMeterDTO } from '../../../../../../../shared/dtos/me.dtos';
import { MeterDataStatus } from '../../../../../../../shared/types/meter.types';
import { ErrorMessageHandler } from '../../../../../../../shared/services-ui/error.message.handler';
import { AddressPipe } from '../../../../../../../shared/pipes/address/address-pipe';
import { Pagination } from '../../../../../../../core/dtos/api.response';
import { DebouncedPInputComponent } from '../../../../../../../shared/components/debounced-p-input/debounced-p-input.component';
import { ViewToggle } from '../../../../../../../shared/components/view-toggle/view-toggle';
import { MetersMap } from '../../../../../../meter/components/meters-list/meters-map/meters-map';
import type { MapViewMode } from '../../../../../../../shared/components/map/map.types';
import type { MeterMapQuery } from '../../../../../../../shared/dtos/meter.dtos';

@Component({
  selector: 'app-meters-user',
  imports: [
    TranslatePipe,
    TableModule,
    TagModule,
    Select,
    FormsModule,
    Button,
    AddressPipe,
    InputGroup,
    InputGroupAddonModule,
    DebouncedPInputComponent,
    ViewToggle,
    MetersMap,
  ],
  templateUrl: './meters.component.html',
  styleUrl: './meters.component.css',
  providers: [ErrorMessageHandler],
})
export class MetersComponent {
  private meService = inject(MeService);
  private errorHandler = inject(ErrorMessageHandler);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);

  readonly metersPartialList = signal<MePartialMeterDTO[]>([]);

  statusCategory = [
    MeterDataStatus.ACTIVE,
    MeterDataStatus.INACTIVE,
    MeterDataStatus.WAITING_GRD,
    MeterDataStatus.WAITING_MANAGER,
  ];

  readonly searchField = signal<string>('community_name');
  readonly searchText = signal<string>('');
  readonly statusFilter = signal<MeterDataStatus | null>(null);

  searchFieldOptions = [
    { label: 'PROFILE.METERS.COMMUNITY_LABEL', value: 'community_name' },
    { label: 'METER.INFORMATIONS.EAN_LABEL', value: 'EAN' },
    { label: 'METER.INFORMATIONS.METER_NUMBER_LABEL', value: 'meter_number' },
  ];

  readonly hasActiveFilters = computed(() => !!this.searchText() || this.statusFilter() !== null);

  readonly paginationInfo = signal<Pagination>({ page: 1, limit: 10, total: 0, total_pages: 1 });
  readonly filter = signal<MeMetersPartialQuery>({ page: 1, limit: 10 });

  /**
   * List or map. Local state rather than a `?view=` param, unlike /meters and
   * /communities/public: this is a tab inside the profile page, whose own tab
   * selection already owns the query string, and a member with two meters gains
   * little from a shareable map link.
   */
  readonly view = signal<MapViewMode>('list');

  /** Filters for the map, without pagination — the map is capped, not paged. */
  readonly mapQuery = computed<MeterMapQuery>(() => {
    const { page: _page, limit: _limit, community_name: _community, ...rest } = this.filter();
    return rest;
  });

  /**
   * Resolved through a view query: the clear button sits in the toolbar shared
   * by both views, while `#dt` only exists inside the list branch.
   */
  private readonly table = viewChild<Table>('dt');
  readonly currentPageReportTemplate = signal<string>('');
  readonly firstRow = computed(
    () => (this.paginationInfo().page - 1) * this.paginationInfo().limit,
  );
  readonly showPaginator = computed(() => this.paginationInfo().total_pages > 1);

  constructor() {
    this.updatePaginationTranslation();
  }

  updatePaginationTranslation(): void {
    this.translate
      .get('PROFILE.METERS.PAGE_REPORT_TEMPLATE_LABEL', {
        page: this.paginationInfo().page,
        total_pages: this.paginationInfo().total_pages,
        total: this.paginationInfo().total,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translatedText: string) => {
        this.currentPageReportTemplate.set(translatedText);
      });
  }

  applyFilters(): void {
    const current: MeMetersPartialQuery = { page: 1, limit: this.filter().limit };

    const text = this.searchText();
    if (text) {
      const field = this.searchField();
      if (field === 'community_name') current.community_name = text;
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
    this.meService
      .getMeters(this.filter())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response) {
            this.metersPartialList.set(response.data as MePartialMeterDTO[]);
            this.paginationInfo.set(response.pagination);
            this.updatePaginationTranslation();
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
    const current: MeMetersPartialQuery = { ...this.filter() };

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
    const current: MeMetersPartialQuery = { ...this.filter() };
    current.page = ($event.first ?? 0) / ($event.rows ?? 10) + 1;
    this.filter.set(current);
    this.loadMeters();
  }

  clear(): void {
    this.table()?.clear();
    this.searchText.set('');
    this.statusFilter.set(null);
    this.searchField.set('community_name');
    this.filter.set({ page: 1, limit: 10 });
    this.loadMeters();
  }

  onRowClick(meter: MePartialMeterDTO): void {
    void this.router.navigate(['/users/me/meters', meter.EAN]);
  }

  protected readonly MeterDataStatus = MeterDataStatus;
}
