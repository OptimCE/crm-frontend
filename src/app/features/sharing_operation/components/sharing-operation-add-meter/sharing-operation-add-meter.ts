import { Component, inject, OnInit } from '@angular/core';
import { AddressPipe } from '../../../../shared/pipes/address/address-pipe';
import { Button } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PaginatorModule } from 'primeng/paginator';
import { FilterMetadata, PrimeTemplate } from 'primeng/api';
import { Table, TableLazyLoadEvent, TableModule, TablePageEvent } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { DatePicker } from 'primeng/datepicker';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { MeterPartialQuery, PartialMeterDTO } from '../../../../shared/dtos/meter.dtos';
import { Pagination } from '../../../../core/dtos/api.response';
import { SharingOperationService } from '../../../../shared/services/sharing_operation.service';
import { MeterService } from '../../../../shared/services/meter.service';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { MeterDataStatus } from '../../../../shared/types/meter.types';
import { AddMeterToSharingOperationDTO } from '../../../../shared/dtos/sharing_operation.dtos';

interface SharingOperationAddMeterDialogData {
  id: number;
}

@Component({
  selector: 'app-sharing-operation-add-meter',
  standalone: true,
  imports: [
    AddressPipe,
    Button,
    InputTextModule,
    PaginatorModule,
    PrimeTemplate,
    TableModule,
    TagModule,
    ReactiveFormsModule,
    TranslatePipe,
    FormsModule,
    Select,
    DatePicker,
  ],
  templateUrl: './sharing-operation-add-meter.html',
  styleUrl: './sharing-operation-add-meter.css',
  providers: [ErrorMessageHandler],
})
export class SharingOperationAddMeter implements OnInit {
  private sharingOperationService = inject(SharingOperationService);
  private metersService = inject(MeterService);
  private config = inject(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);
  private translate = inject(TranslateService);
  id: number;
  metersPartialList: PartialMeterDTO[] = [];
  addressFilter = {
    streetName: '',
    postcode: '',
    cityName: '',
  };
  paginationMetersInfo: Pagination = new Pagination(1, 10, 0, 1);
  statutCategory: { value: MeterDataStatus; label: string }[] = [];
  selectedMeters?: PartialMeterDTO[];
  minDate: Date = new Date();
  dateSelected: Date | null = null;
  currentPageReportTemplate: string = '';

  constructor() {
    const data = this.config.data as SharingOperationAddMeterDialogData;
    this.id = data.id;
  }

  ngOnInit(): void {
    this.setupStatusCategory();
  }
  updatePaginationTranslation(): void {
    this.translate
      .get('SHARING_OPERATION.ADD_METER.PAGE_REPORT_TEMPLATE_METER_LABEL', {
        page: this.paginationMetersInfo.page,
        total_pages: this.paginationMetersInfo.total_pages,
        total: this.paginationMetersInfo.total,
      })
      .subscribe((translatedText: string) => {
        this.currentPageReportTemplate = translatedText;
      });
  }

  setupStatusCategory(): void {
    this.translate
      .get([
        'SHARING_OPERATION.ADD_METER.METER.STATUS.ACTIVATED_LABEL',
        'SHARING_OPERATION.ADD_METER.METER.STATUS.DEACTIVATED_LABEL',
        'SHARING_OPERATION.ADD_METER.METER.STATUS.WAITING_FOR_GRD_ACCEPTANCE_LABEL',
        'SHARING_OPERATION.ADD_METER.METER.STATUS.WAITING_FOR_MANAGER_ACCEPTANCE_LABEL',
      ])
      .subscribe((translation: Record<string, string>) => {
        this.statutCategory = [
          {
            value: MeterDataStatus.ACTIVE,
            label: translation['SHARING_OPERATION.ADD_METER.METER.STATUS.ACTIVATED_LABEL'],
          },
          {
            value: MeterDataStatus.INACTIVE,
            label: translation['SHARING_OPERATION.ADD_METER.METER.STATUS.DEACTIVATED_LABEL'],
          },
          {
            value: MeterDataStatus.WAITING_GRD,
            label:
              translation[
                'SHARING_OPERATION.ADD_METER.METER.STATUS.WAITING_FOR_GRD_ACCEPTANCE_LABEL'
              ],
          },
          {
            value: MeterDataStatus.WAITING_MANAGER,
            label:
              translation[
                'SHARING_OPERATION.ADD_METER.METER.STATUS.WAITING_FOR_MANAGER_ACCEPTANCE_LABEL'
              ],
          },
        ];
      });
  }

  loadMeters(
    filter?: Record<string, FilterMetadata | FilterMetadata[] | undefined>,
    _page?: number,
  ): void {
    const params: MeterPartialQuery = {
      page: 1,
      limit: 10,
      not_sharing_operation_id: this.id,
    };
    // Check for address
    if (
      !(
        this.addressFilter.streetName === '' &&
        this.addressFilter.postcode === '' &&
        this.addressFilter.cityName === ''
      )
    ) {
      // Il y a un filtre d'adresse
      if (this.addressFilter.streetName !== '') {
        params.street = this.addressFilter.streetName;
      }
      if (this.addressFilter.postcode !== '') {
        params.postcode = parseInt(this.addressFilter.postcode);
      }
      if (this.addressFilter.cityName !== '') {
        params.city = this.addressFilter.cityName;
      }
    }
    if (filter) {
      Object.entries(filter).forEach(([key, meta]) => {
        const filterMeta = Array.isArray(meta) ? meta[0] : meta;
        if (
          filterMeta &&
          filterMeta.value !== undefined &&
          filterMeta.value !== null &&
          filterMeta.value !== ''
        ) {
          if (key === 'statut') {
            params.status = filterMeta.value as MeterDataStatus;
          } else if (key === 'EAN') {
            params.EAN = filterMeta.value as string;
          } else if (key === 'meter_number') {
            params.meter_number = filterMeta.value as string;
          }
        }
      });
    }
    this.metersService.getMetersList({ ...params }).subscribe({
      next: (response) => {
        if (response) {
          this.metersPartialList = response.data as PartialMeterDTO[];
          this.paginationMetersInfo = response.pagination;
          this.updatePaginationTranslation();
        } else {
          console.error('Error fetching meters partial list');
        }
      },
      error: (_error) => {
        console.error('Error fetching meters partial list');
      },
    });
  }

  lazyLoadMeters($event: TableLazyLoadEvent): void {
    let page = 0;
    if ($event.first && $event.rows) {
      page = $event.first / $event.rows + 1;
    }
    this.loadMeters($event.filters, page >= 1 ? page : 1);
  }

  clear(table: Table<PartialMeterDTO>): void {
    table.clear();
    this.addressFilter = {
      streetName: '',
      postcode: '',
      cityName: '',
    };
  }

  pageChange($event: TablePageEvent): void {
    const page = $event.first / $event.rows + 1;
    this.loadMeters(undefined, page);
  }

  onValidate(): void {
    if (
      this.dateSelected === null ||
      this.dateSelected === undefined ||
      this.selectedMeters === null ||
      this.selectedMeters === undefined ||
      this.selectedMeters.length === 0
    ) {
      return;
    }
    const metersToAdd: AddMeterToSharingOperationDTO = {
      date: this.dateSelected,
      ean_list: this.selectedMeters.map((meter) => meter.EAN),
      id_sharing: this.id,
    };

    this.sharingOperationService.addMeterToSharing(metersToAdd).subscribe((response) => {
      if (response) {
        this.ref.close(true);
      } else {
        console.error('Error adding meters to sharing operation');
        this.ref.close(false);
      }
    });
  }

  protected readonly MeterStatus = MeterDataStatus;
}
