import { Component, inject, OnInit, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Table, TableLazyLoadEvent, TableModule, TablePageEvent } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { Select } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { MeService } from '../../../../../../../shared/services/me.service';
import { MeMetersPartialQuery, MePartialMeterDTO } from '../../../../../../../shared/dtos/me.dtos';
import { MeterDataStatus } from '../../../../../../../shared/types/meter.types';
import { ErrorMessageHandler } from '../../../../../../../shared/services-ui/error.message.handler';
import { AddressPipe } from '../../../../../../../shared/pipes/address/address-pipe';

@Component({
  selector: 'app-meters-user',
  imports: [TranslatePipe, TableModule, TagModule, Select, FormsModule, Button, AddressPipe],
  templateUrl: './meters.component.html',
  styleUrl: './meters.component.css',
  providers: [ErrorMessageHandler],
})
export class MetersComponent implements OnInit {
  private meService = inject(MeService);
  private errorHandler = inject(ErrorMessageHandler);
  private translate = inject(TranslateService);

  metersPartialList = signal<MePartialMeterDTO[]>([]);

  statusCategory = [
    MeterDataStatus.ACTIVE,
    MeterDataStatus.INACTIVE,
    MeterDataStatus.WAITING_GRD,
    MeterDataStatus.WAITING_MANAGER,
  ];

  paginationInfo = {
    page: 1,
    limit: 10,
    total: 0,
    total_pages: 1,
  };
  filter = signal<MeMetersPartialQuery>({ page: 1, limit: 10 });
  currentPageReportTemplate: string = '';

  ngOnInit(): void {
    this.updatePaginationTranslation();
  }

  updatePaginationTranslation(): void {
    this.translate
      .get('PROFILE.METERS.PAGE_REPORT_TEMPLATE_LABEL', {
        page: this.paginationInfo.page,
        total_pages: this.paginationInfo.total_pages,
        total: this.paginationInfo.total,
      })
      .subscribe((translatedText: string) => {
        this.currentPageReportTemplate = translatedText;
      });
  }

  loadMeters(): void {
    this.meService.getMeters(this.filter()).subscribe({
      next: (response) => {
        if (response) {
          this.metersPartialList.set(response.data as MePartialMeterDTO[]);
          this.paginationInfo = response.pagination;
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

    if ($event.filters) {
      const communityFilter = $event.filters['community'];
      if (communityFilter && !Array.isArray(communityFilter) && communityFilter.value) {
        current.community_name = communityFilter.value as string;
      } else {
        delete current.community_name;
      }

      const eanFilter = $event.filters['EAN'];
      if (eanFilter && !Array.isArray(eanFilter) && eanFilter.value) {
        current.EAN = eanFilter.value as string;
      } else {
        delete current.EAN;
      }

      const meterNumberFilter = $event.filters['meter_number'];
      if (meterNumberFilter && !Array.isArray(meterNumberFilter) && meterNumberFilter.value) {
        current.meter_number = meterNumberFilter.value as string;
      } else {
        delete current.meter_number;
      }

      const statusFilter = $event.filters['status'];
      if (statusFilter && !Array.isArray(statusFilter) && statusFilter.value !== undefined) {
        current.status = statusFilter.value as MeterDataStatus;
      } else {
        delete current.status;
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

  clear(table: Table): void {
    table.clear();
    this.filter.set({ page: 1, limit: 10 });
    this.loadMeters();
  }

  onRowClick(meter: MePartialMeterDTO): void {
    console.log('Row clicked:', meter.EAN);
  }

  protected readonly MeterDataStatus = MeterDataStatus;
}
