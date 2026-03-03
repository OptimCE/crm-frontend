import { Component, inject, Input, OnDestroy, OnInit, signal } from '@angular/core';
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
import { InputText } from 'primeng/inputtext';
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
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-sharing-operation-meters-list',
  imports: [
    TableModule,
    Button,
    TranslatePipe,
    InputText,
    FormsModule,
    Select,
    Tag,
    AddressPipe,
    Toast,
    ConfirmPopup,
    DatePicker,
    Ripple,
  ],
  templateUrl: './sharing-operation-meters-list.html',
  styleUrl: './sharing-operation-meters-list.css',
  providers: [DialogService, ConfirmationService, MessageService, ErrorMessageHandler],
})
export class SharingOperationMetersList implements OnInit, OnDestroy {
  @Input() id_sharing!: number;
  @Input() type!: SharingOperationMetersQueryType;
  private destroy$ = new Subject<void>();
  private translate = inject(TranslateService);
  private sharingOperationService = inject(SharingOperationService);
  private errorHandler = inject(ErrorMessageHandler);
  private confirmationService = inject(ConfirmationService);
  private routing = inject(Router);
  private meterEventService = inject(SharingOperationMeterEventService);
  metersPartialList = signal<PartialMeterDTO[]>([]);
  loading = signal<boolean>(true);
  pagination = signal<Pagination>({ total: 0, total_pages: 0, page: 0, limit: 0 });
  filter = signal<SharingOperationMetersQuery>({
    page: 1,
    limit: 10,
    type: SharingOperationMetersQueryType.NOW,
  });
  currentPageReportTemplate: string = '';
  addressFilter = {
    streetName: '',
    postcode: '',
    cityName: '',
  };
  textChangeStatusMeter!: string;
  dateStartMeter: Date | string | null = null;
  minDate = new Date();
  statutCategory: { value: MeterDataStatus; label: string }[] = [];

  ngOnInit(): void {
    this.setupStatusCategory();
    this.filter.set({
      page: 1,
      limit: 10,
      type: this.type,
    });
    this.meterEventService.meterAdded$
      .pipe(takeUntil(this.destroy$))
      .subscribe((): void => this.loadMetersSharingOperation());
  }

  setupStatusCategory(): void {
    this.translate
      .get([
        'SHARING_OPERATION.VIEW.METER.STATUS.ACTIVATED_LABEL',
        'SHARING_OPERATION.VIEW.METER.STATUS.DEACTIVATED_LABEL',
        'SHARING_OPERATION.VIEW.METER.STATUS.WAITING_FOR_GRD_ACCEPTANCE_LABEL',
        'SHARING_OPERATION.VIEW.METER.STATUS.WAITING_FOR_MANAGER_ACCEPTANCE_LABEL',
        'SHARING_OPERATION.VIEW.CHART.X_TITLE_DATE',
        'SHARING_OPERATION.VIEW.CHART.Y_TITLE_CONSUMPTION',
        'SHARING_OPERATION.VIEW.CHART.CONSUMPTION_SHARED_LABEL',
        'SHARING_OPERATION.VIEW.CHART.CONSUMPTION_NET_LABEL',
        'SHARING_OPERATION.VIEW.CHART.INJECTION_NET_LABEL',
        'SHARING_OPERATION.VIEW.CHART.INJECTION_SHARED_LABEL',
        'SHARING_OPERATION.VIEW.METER.ADD_METERS_HEADER',
        'SHARING_OPERATION.VIEW.METER.METER_ADDED_SUCCESSFULLY_LABEL',
        'SHARING_OPERATION.VIEW.KEY.MODIFY_KEY_HEADER',
        'SHARING_OPERATION.VIEW.KEY.KEY_MODIFIED_SUCCESSFULLY_LABEL',
        'SHARING_OPERATION.VIEW.METER.CHANGE_STATUS_METER_STARTING_LABEL',
        'SHARING_OPERATION.VIEW.METER.CHANGE_STATUS_METER_ENDING_LABEL',
        'SHARING_OPERATION.VIEW.METER.CHANGE_STATUS_METER_WAITING_LABEL',
        'SHARING_OPERATION.VIEW.CONSUMPTION_MONITORING.UPLOAD_SUCCESS_LABEL',
      ])
      .subscribe((translation: Record<string, string>) => {
        this.statutCategory = [
          {
            value: MeterDataStatus.ACTIVE,
            label: translation['SHARING_OPERATION.VIEW.METER.STATUS.ACTIVATED_LABEL'],
          },
          {
            value: MeterDataStatus.INACTIVE,
            label: translation['SHARING_OPERATION.VIEW.METER.STATUS.DEACTIVATED_LABEL'],
          },
          {
            value: MeterDataStatus.WAITING_GRD,
            label:
              translation['SHARING_OPERATION.VIEW.METER.STATUS.WAITING_FOR_GRD_ACCEPTANCE_LABEL'],
          },
          {
            value: MeterDataStatus.WAITING_MANAGER,
            label:
              translation[
                'SHARING_OPERATION.VIEW.METER.STATUS.WAITING_FOR_MANAGER_ACCEPTANCE_LABEL'
              ],
          },
        ];
      });
  }

  private loadMetersSharingOperation(): void {
    this.loading.set(true);
    this.sharingOperationService
      .getSharingOperationMetersList(this.id_sharing, this.filter())
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

  protected lazyLoadMeter($event: TableLazyLoadEvent): void {
    const current: SharingOperationMetersQuery = { ...this.filter() };
    if ($event.first !== undefined && $event.rows !== undefined) {
      if ($event.rows) {
        current.page = $event.first / $event.rows + 1;
      } else {
        current.page = 1;
      }
    }

    if ($event.filters) {
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

      const statutFilter = $event.filters['statut'];
      if (statutFilter && !Array.isArray(statutFilter) && statutFilter.value !== undefined) {
        current.status = statutFilter.value as MeterDataStatus;
      } else {
        delete current.status;
      }
    }

    // Address filters from custom template
    if (this.addressFilter.streetName !== '') {
      current.street = this.addressFilter.streetName;
    } else {
      delete current.street;
    }
    if (this.addressFilter.postcode !== '') {
      current.postcode = parseInt(this.addressFilter.postcode);
    } else {
      delete current.postcode;
    }
    if (this.addressFilter.cityName !== '') {
      current.city = this.addressFilter.cityName;
    } else {
      delete current.city;
    }

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
      .subscribe((translatedText: string) => {
        this.currentPageReportTemplate = translatedText;
      });
  }

  protected pageChange($event: TablePageEvent): void {
    const current: SharingOperationMetersQuery = { ...this.filter() };
    if ($event.rows) {
      current.page = ($event.first ?? 0) / $event.rows + 1;
    }
    this.filter.set(current);
    this.loadMetersSharingOperation();
  }

  clear(table: Table): void {
    table.clear();
    this.addressFilter = {
      streetName: '',
      postcode: '',
      cityName: '',
    };
    this.filter.set({
      page: 1,
      limit: 10,
      type: this.type,
    });
    this.loadMetersSharingOperation();
  }

  openMeterChangeStatusPopup(event: Event, meter: PartialMeterDTO, action: number): void {
    event.stopPropagation();
    if (action == 1) {
      this.textChangeStatusMeter = this.translate.instant(
        'SHARING_OPERATION.VIEW.METER.CHANGE_STATUS_METER_STARTING_LABEL',
      ) as string;
    } else if (action == 2) {
      this.textChangeStatusMeter = this.translate.instant(
        'SHARING_OPERATION.VIEW.METER.CHANGE_STATUS_METER_ENDING_LABEL',
      ) as string;
    } else if (action == 3) {
      this.textChangeStatusMeter = this.translate.instant(
        'SHARING_OPERATION.VIEW.METER.CHANGE_STATUS_METER_WAITING_LABEL',
      ) as string;
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

  approveMeter(meter: PartialMeterDTO): void {
    const patchedMeterStatus: PatchMeterToSharingOperationDTO = {
      date: this.dateStartMeter ? new Date(this.dateStartMeter) : new Date(),
      id_meter: meter.EAN,
      id_sharing: this.id_sharing,
      status: MeterDataStatus.ACTIVE,
    };

    this.sharingOperationService.patchMeterStatus(patchedMeterStatus).subscribe({
      next: (response) => {
        if (response) {
          this.loadMetersSharingOperation();
        }
      },
      error: (error: { data?: unknown }) => {
        this.errorHandler.handleError(error.data ?? null);
      },
    });

    this.dateStartMeter = null;
  }

  removeMeter(meter: PartialMeterDTO): void {
    const patchedMeterStatus: PatchMeterToSharingOperationDTO = {
      date: this.dateStartMeter ? new Date(this.dateStartMeter) : new Date(),
      id_meter: meter.EAN,
      id_sharing: this.id_sharing,
      status: MeterDataStatus.INACTIVE,
    };
    this.sharingOperationService.patchMeterStatus(patchedMeterStatus).subscribe({
      next: (response) => {
        if (response) {
          this.loadMetersSharingOperation();
        }
      },
      error: (error: { data?: unknown }) => {
        this.errorHandler.handleError(error.data ?? null);
      },
    });

    this.dateStartMeter = null;
  }

  putMeterToWaiting(meter: PartialMeterDTO): void {
    const patchedMeterStatus: PatchMeterToSharingOperationDTO = {
      date: this.dateStartMeter ? new Date(this.dateStartMeter) : new Date(),
      id_meter: meter.EAN,
      id_sharing: this.id_sharing,
      status: MeterDataStatus.WAITING_GRD,
    };
    this.sharingOperationService.patchMeterStatus(patchedMeterStatus).subscribe({
      next: (response) => {
        if (response) {
          this.loadMetersSharingOperation();
        }
      },
      error: (error: { data?: unknown }) => {
        this.errorHandler.handleError(error.data ?? null);
      },
    });

    this.dateStartMeter = null;
  }
  onRowClick(meter: PartialMeterDTO): void {
    void this.routing.navigate(['/members/meter/' + meter.EAN]);
  }

  public MeterStatus = MeterDataStatus;
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
