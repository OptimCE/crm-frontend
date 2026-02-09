import {Component, inject, OnInit} from '@angular/core';
import {Button, ButtonDirective} from 'primeng/button';
import {Ripple} from 'primeng/ripple';
import {AddressPipe} from '../../../../shared/pipes/address/address-pipe';
import {InputTextModule} from 'primeng/inputtext';
import {ConfirmationService, MessageService, PrimeTemplate} from 'primeng/api';
import {FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {TableModule} from 'primeng/table';
import {TagModule} from 'primeng/tag';
import {ProgressSpinnerModule} from 'primeng/progressspinner';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {DatePipe} from '@angular/common';
import {ToastModule} from 'primeng/toast';
import {SplitButtonModule} from 'primeng/splitbutton';
import {ConfirmPopupModule} from 'primeng/confirmpopup';
import {CardModule} from 'primeng/card';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {ChartModule} from 'primeng/chart';
import {ErrorHandlerComponent} from '../../../../shared/components/error.handler/error.handler.component';
import {CheckboxModule} from 'primeng/checkbox';
import {Drawer} from 'primeng/drawer';
import {Select} from 'primeng/select';
import {DatePicker} from 'primeng/datepicker';
import {DialogService, DynamicDialogRef} from 'primeng/dynamicdialog';
import {ErrorMessageHandler} from '../../../../shared/services-ui/error.message.handler';
import {
  AddConsumptionDataDTO,
  PatchMeterToSharingOperationDTO,
  SharingOpConsumptionDTO,
  SharingOperationDTO
} from '../../../../shared/dtos/sharing_operation.dtos';
import {PartialMeterDTO} from '../../../../shared/dtos/meter.dtos';
import {Pagination} from '../../../../core/dtos/api.response';
import {SharingOperationService} from '../../../../shared/services/sharing_operation.service';
import {MeterService} from '../../../../shared/services/meter.service';
import {SnackbarNotification} from '../../../../shared/services-ui/snackbar.notifcation.service';
import {EventBusService} from '../../../../core/services/event_bus/eventbus.service';
import {MeterDataStatus} from '../../../../shared/types/meter.types';
import {SharingOperationAddMeter} from '../sharing-operation-add-meter/sharing-operation-add-meter';
import {SharingOperationAddKey} from '../sharing-operation-add-key/sharing-operation-add-key';
import {SharingKeyStatus} from '../../../../shared/types/sharing_operation.types';
import {VALIDATION_TYPE} from '../../../../core/dtos/notification';
import {SharingOperationTypePipe} from '../../../../shared/pipes/sharing-operation-type/sharing-operation-type-pipe';

@Component({
  selector: 'app-sharing-operation-view',
  standalone: true,
  imports: [
    Button,
    Ripple,
    AddressPipe,
    ButtonDirective,
    InputTextModule,
    PrimeTemplate,
    ReactiveFormsModule,
    TableModule,
    TagModule,
    FormsModule,
    ProgressSpinnerModule,
    RouterLink,
    DatePipe,
    ToastModule,
    SplitButtonModule,
    ConfirmPopupModule,
    CardModule,
    TranslatePipe,
    ChartModule,
    ErrorHandlerComponent,
    CheckboxModule,
    Drawer,
    Select,
    DatePicker,
    SharingOperationTypePipe,
  ],
  templateUrl: './sharing-operation-view.html',
  styleUrl: './sharing-operation-view.css',
  providers: [DialogService, ConfirmationService, MessageService, ErrorMessageHandler],
})
export class SharingOperationView implements OnInit {
  private translate = inject(TranslateService)
  isLoading: boolean = true;
  id!: number;
  sharingOperation!: SharingOperationDTO;
  metersPartialList: PartialMeterDTO[] = [];
  addressFilter = {
    streetName: '',
    postcode: '',
    cityName: '',
  };
  paginationMetersInfo: Pagination = new Pagination(1, 10, 0, 1);
  statutCategory: any[] = [];
  ref?: DynamicDialogRef | null;
  sidebarHistoryKey: boolean = false;
  minDate = new Date();
  dateStartApproved: any;
  dateStartMeter: any;
  textChangeStatusMeter!: string;
  currentPageReportTemplate: string = '';
  data: any;

  options = {
    maintainAspectRatio: false,
    aspectRatio: 0.8,
    plugins: {
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: function (tooltipItem: any) {
            const label = tooltipItem.dataset.label || '';
            const value = tooltipItem.raw;
            return `${label}: ${value} kWh`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        title: {
          display: true,
          text: this.translate.instant('SHARING_OPERATION.VIEW.CHART.X_TITLE_DATE'),
        },
        ticks:{
          callback: (value: any, index: number) => {
            // Make sure 'this' refers to the component context
            const label = this.data?.labels?.[index];
            if (!label) return '';

            const date = new Date(label);
            if (isNaN(date.getTime())) return label;

            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');

            return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
          }
        }
      },
      y: {
        stacked: true,
        title: {
          display: true,
          text: this.translate.instant('SHARING_OPERATION.VIEW.CHART.Y_TITLE_CONSUMPTION'),
        },
      },
    },
  };
  formChart!: FormGroup;
  displayDownloadButton: boolean = false;
  metersCharts: PartialMeterDTO[] = [];
  selectedMeterCharts: boolean[] = [];

  public dragging: boolean = false;
  public fileConsumption: File | null = null;
  formGroup!: FormGroup;
  constructor(
    private sharingOperationService: SharingOperationService,
    private routing: Router,
    private route: ActivatedRoute,
    private metersService: MeterService,
    private dialogService: DialogService,
    private confirmationService: ConfirmationService,
    private snackbar: SnackbarNotification,
    private eventBus: EventBusService,
    private errorHandler: ErrorMessageHandler,
  ) {}

  ngOnInit(): void {
    this.isLoading = true;
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    if (id === '') {
      this.routing.navigate(['//members/sharing/']);
      return;
    }
    this.id = +id;
    if (this.id) {
      this.loadOperationSharing();
      this.setupStatusCategory();
      this.updatePaginationTranslation();
      this.formChart = new FormGroup({
        dateDeb: new FormControl('', [Validators.required]),
        dateFin: new FormControl('', [Validators.required]),
      });
      this.formGroup = new FormGroup(
        {
          fileConsumption: new FormControl('', [Validators.required]),
        },
        {
          updateOn: 'submit',
        },
      );
      this.loadAllMeters();
    }
  }

  updatePaginationTranslation() {
    this.translate
      .get('SHARING_OPERATION.VIEW.METER.PAGE_REPORT_TEMPLATE_METER_LABEL', {
        page: this.paginationMetersInfo.page,
        total_pages: this.paginationMetersInfo.total_pages,
        total: this.paginationMetersInfo.total,
      })
      .subscribe((translatedText: string) => {
        this.currentPageReportTemplate = translatedText;
      });
  }
  setupStatusCategory() {
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
        'SHARING_OPERATION.VIEW.CONSUMPTION_MONITORING.UPLOAD_SUCCESS_LABEL'
      ])
      .subscribe((translation) => {
        this.statutCategory = [
          { value: MeterDataStatus.ACTIVE, label: translation['SHARING_OPERATION.VIEW.METER.STATUS.ACTIVATED_LABEL'] },
          { value: MeterDataStatus.INACTIVE, label: translation['SHARING_OPERATION.VIEW.METER.STATUS.DEACTIVATED_LABEL'] },
          { value: MeterDataStatus.WAITING_GRD, label: translation['SHARING_OPERATION.VIEW.METER.STATUS.WAITING_FOR_GRD_ACCEPTANCE_LABEL'] },
          { value: MeterDataStatus.WAITING_MANAGER, label: translation['SHARING_OPERATION.VIEW.METER.STATUS.WAITING_FOR_MANAGER_ACCEPTANCE_LABEL'] },
        ];
      });
  }

  loadOperationSharing() {
    this.sharingOperationService.getSharingOperation(this.id).subscribe((response) => {
      if (response) {
        this.sharingOperation = response.data as SharingOperationDTO;
      }
      this.isLoading = false;
    });
  }
  exportExcelCWAPe() {
    console.log('TO IMPLEMENT');
  }
  loadAllMeters() {
    try {
      const params: any = {
        sharingOperationsId: this.id,
      };
      this.metersService.getMetersList(params).subscribe(
        {
          next:(response)=>
          {
            if (response) {
              this.metersCharts = response.data as PartialMeterDTO[];
              this.selectedMeterCharts = this.metersCharts.map((_) => false);
            } else {
              console.error('Error fetching meters partial list');
            }
          },
          error: (_error) => {
            console.error('Error fetching meters partial list');
          },
        }
      );
    } catch (e) {
      console.error('Error fetching meters partial list ' + e);
    }
  }

  loadMeters(changeIsLoaded: boolean = true, filter?: any, page?: number) {
    try {
      const params: any = {
        sharingOperationsId: this.id,
      };
      // Check for address
      if (!(this.addressFilter.streetName == '' && this.addressFilter.postcode == '' && this.addressFilter.cityName == '')) {
        // Il y a un filtre d'adresse
        if (this.addressFilter.streetName != '') {
          params['streetname'] = this.addressFilter.streetName;
        }
        if (this.addressFilter.postcode != '') {
          params['postcode'] = this.addressFilter.postcode;
        }
        if (this.addressFilter.cityName != '') {
          params['cityname'] = this.addressFilter.cityName;
        }
      }
      if (filter) {
        for (const key in filter) {
          if (key == 'statut') {
            if (filter[key][0].value != null) {
              params[key] = filter[key][0].value;
            }
          } else {
            if (filter[key][0].value != null && filter[key][0].value != '') {
              if (key == 'holder') {
                params[key] = filter[key][0].value.id;
              } else {
                params[key] = filter[key][0].value;
              }
            }
          }
        }
      }
      this.metersService.getMetersList({page: page, limit: 10, ...params}).subscribe(
        {
          next:(response)=>
          {
            if (response) {
              this.metersPartialList = response.data as PartialMeterDTO[];
              this.paginationMetersInfo = response.pagination;
              this.updatePaginationTranslation()
            } else {
              console.error('Error fetching meters partial list');
            }
          },
          error:(_error) => {
            console.error('Error fetching meters partial list');
          },
        }
      );
    } catch (e) {
      console.error('Error fetching meters partial list ' + e);
    }
  }

  lazyLoadMeters($event: any) {
    let page = 0;
    if ($event.first && $event.rows) {
      page = $event.first / $event.rows + 1;
    }
    this.loadMeters(true, $event.filters, page);
  }

  clear(table: any) {
    table.clear();
    this.addressFilter = {
      streetName: '',
      postcode: '',
      cityName: '',
    };
  }

  pageChange(_$event: any) {
    console.log('TO IMPLEMENT');
  }

  onRowClick(meter: any) {
    this.routing.navigate(['/members/meter/' + meter.EAN]);
  }

  addMeter() {
    this.ref = this.dialogService.open(SharingOperationAddMeter, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('SHARING_OPERATION.VIEW.METER.ADD_METERS_HEADER'),
      data: {
        id: this.id,
      },
    });
    if(this.ref) {
      this.ref.onClose.subscribe((response) => {
        if (response) {
          this.snackbar.openSnackBar(this.translate.instant('SHARING_OPERATION.VIEW.METER.METER_ADDED_SUCCESSFULLY_LABEL'), VALIDATION_TYPE);
          this.loadMeters(true);
        }
      });
    }
  }

  editKey() {
    this.ref = this.dialogService.open(SharingOperationAddKey, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('SHARING_OPERATION.VIEW.KEY.MODIFY_KEY_HEADER'),
      data: {
        id: this.id,
      },
    });
    if(this.ref){
      this.ref.onClose.subscribe((response) => {
        if (response) {
          this.snackbar.openSnackBar(this.translate.instant('SHARING_OPERATION.VIEW.KEY.KEY_MODIFIED_SUCCESSFULLY_LABEL'), VALIDATION_TYPE);
          this.loadOperationSharing();
        }
      });
    }

  }

  revokeWaitingKey() {
    this.sharingOperationService.patchKeyStatus({
      id_key: this.sharingOperation!.key_waiting_approval.key.id,
      id_sharing: this.id,
      date: new Date(),
      status: SharingKeyStatus.REJECTED}).subscribe(
      {
        next:(response)=>
        {
          if (response) {
            this.loadOperationSharing();

            // this.ref.close(true);
          } else {
            this.errorHandler.handleError();
          }
        },
        error:(error) => {
          this.errorHandler.handleError(error.data ?? null);
        },
      }
    );
  }

  approveWaitingKey() {
    this.sharingOperationService.patchKeyStatus({
      id_key: this.sharingOperation!.key_waiting_approval.key.id,
      id_sharing: this.id,
      date: this.dateStartApproved,
      status: SharingKeyStatus.APPROVED
    }).subscribe(
      {
        next:(response)=>
        {
          if (response) {
            if(this.ref){
              this.ref.close(true);
            }
            this.loadOperationSharing();
          } else {
            this.errorHandler.handleError(response);
          }
        },
        error:(error) => {
          this.errorHandler.handleError(error);
        },
      }
    );
  }

  openDateApprovedKey(event: Event) {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      acceptIcon: 'pi pi-check',
      rejectIcon: 'pi pi-times',
      acceptLabel: this.translate.instant('COMMON.ACTIONS.VALIDATE'),
      rejectLabel: this.translate.instant('COMMON.ACTIONS.CANCEL'),
      accept: () => {
        this.approveWaitingKey();
      },
    });
  }

  openMeterChangeStatusPopup(event: Event, meter: PartialMeterDTO, action: number) {
    event.stopPropagation();
    if (action == 1) {
      this.textChangeStatusMeter = this.translate.instant("SHARING_OPERATION.VIEW.METER.CHANGE_STATUS_METER_STARTING_LABEL");
    } else if (action == 2) {
      this.textChangeStatusMeter = this.translate.instant("SHARING_OPERATION.VIEW.METER.CHANGE_STATUS_METER_ENDING_LABEL");
    } else if (action == 3) {
      this.textChangeStatusMeter = this.translate.instant("SHARING_OPERATION.VIEW.METER.CHANGE_STATUS_METER_WAITING_LABEL");
    }
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      acceptIcon: 'pi pi-check',
      rejectIcon: 'pi pi-times',
      acceptLabel: this.translate.instant('COMMON.ACTIONS.VALIDATE'),
      rejectLabel: this.translate.instant('COMMON.ACTIONS.CANCEL'),
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

  approveMeter(meter: PartialMeterDTO) {
    const patchedMeterStatus: PatchMeterToSharingOperationDTO = {
      date: this.dateStartMeter, id_meter: meter.EAN, id_sharing: this.sharingOperation!.id, status: MeterDataStatus.ACTIVE
    }

    this.sharingOperationService.patchMeterStatus(patchedMeterStatus).subscribe(
      {
        next:(response)=>
        {
          if (response) {
            this.loadMeters(true);
          } else {
            this.errorHandler.handleError(response);
          }
        },
        error:(error) => {
          this.errorHandler.handleError(error);
        },
      }
    );

    this.dateStartMeter = null;
  }

  removeMeter(meter: PartialMeterDTO) {
    const patchedMeterStatus: PatchMeterToSharingOperationDTO = {
      date: this.dateStartMeter, id_meter: meter.EAN, id_sharing: this.sharingOperation!.id, status: MeterDataStatus.INACTIVE
    }
    this.sharingOperationService.patchMeterStatus(patchedMeterStatus).subscribe(
      {
        next:(response)=>
        {
          if (response) {
            this.loadMeters(true);
          } else {
            this.errorHandler.handleError();
          }
        },
        error:(error) => {
          this.errorHandler.handleError(error.data?? null);
        },
      }
    );

    this.dateStartMeter = null;
  }

  putMeterToWaiting(meter: PartialMeterDTO) {
    const patchedMeterStatus: PatchMeterToSharingOperationDTO = {
      date: this.dateStartMeter, id_meter: meter.EAN, id_sharing: this.sharingOperation!.id, status: MeterDataStatus.WAITING_GRD
    }
    this.sharingOperationService.patchMeterStatus(patchedMeterStatus).subscribe(
      {
        next:(response)=>
        {
          if (response) {
            this.loadMeters(true);
          } else {
            this.errorHandler.handleError(response);
          }
        },
        error:(error) => {
          this.errorHandler.handleError(error);
        },
      }
    );

    this.dateStartMeter = null;
  }

  newKey() {
    // Get all meters EAN
    const metersEAN = this.metersPartialList.map((a) => a.EAN);
    this.eventBus.emit('setConsumers', metersEAN);
    this.routing.navigate(['/key/add']);
  }

  loadChart() {
    this.displayDownloadButton = false;
    if (this.formChart.invalid) {
      return;
    }
    this.sharingOperationService
      .getSharingOperationConsumptions(this.id, {date_start: this.formChart.value.dateDeb,
        date_end: this.formChart.value.dateFin})
      .subscribe((response) => {
        if (response) {
          const tmpData = response.data as SharingOpConsumptionDTO;
          this.data = {
            labels: tmpData.timestamps,
            datasets: [
              {
                type: 'bar',
                label: this.translate.instant('SHARING_OPERATION.VIEW.CHART.CONSUMPTION_SHARED_LABEL'),
                stack: 'consumption',
                data: tmpData.shared,
              },
              {
                type: 'bar',
                label: this.translate.instant('SHARING_OPERATION.VIEW.CHART.CONSUMPTION_NET_LABEL'),
                stack: 'consumption',
                data: tmpData.net,
              },
              {
                type: 'bar',
                label: this.translate.instant('SHARING_OPERATION.VIEW.CHART.INJECTION_NET_LABEL'),
                stack: 'inj',
                data: tmpData.inj_net,
              },
              {
                type: 'bar',
                label: this.translate.instant('SHARING_OPERATION.VIEW.CHART.INJECTION_SHARED_LABEL'),
                stack: 'inj',
                data: tmpData.inj_shared,
              },
            ],
          };
          this.displayDownloadButton = true;
        }
      });
  }

  downloadTotalConsumption() {
    this.sharingOperationService
      .downloadSharingOperationConsumptions(this.sharingOperation!.id, {
        date_start:this.formChart.value.dateDeb,
        date_end: this.formChart.value.dateFin
      })
      .subscribe((response) => {
        // if (response) {
        //   const blob = new Blob([response], { type: 'xlsx' });
        //   const url = window.URL.createObjectURL(blob);
        //   const a = document.createElement('a');
        //   a.href = url;
        //   a.download = this.translate.instant('sharing_operations.full.consumption_monitoring.consumption_file_prefix') + this.sharingOperation.name + '.xlsx';
        //   document.body.appendChild(a);
        //   a.click();
        //   window.URL.revokeObjectURL(url);
        //   document.body.removeChild(a);
        // }
      });
  }

  onFileSelected(event: any): void {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      this.fileConsumption = selectedFile;
      this.formGroup.patchValue({ fileConsumption: this.fileConsumption });
      this.formGroup.get('fileConsumption')?.updateValueAndValidity();
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragging = false;
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.fileConsumption = files[0];
      this.formGroup.patchValue({ fileConsumption: this.fileConsumption });
      this.formGroup.get('fileConsumption')?.updateValueAndValidity();
    }
  }

  addConsumptionInformations() {
    if (this.formGroup.invalid) {
      return;
    }
    const formData = new FormData();
    formData.append('file', this.fileConsumption as File);
    formData.append('idSharing', this.sharingOperation!.id.toString());
    const addConsumption: AddConsumptionDataDTO = {
      id_sharing_operation: this.sharingOperation!.id,

    }
    this.sharingOperationService.addConsumptionDataToSharing(addConsumption).subscribe( // TODO: To fix
      {
        next:(response)=>
        {
          if (response) {
            this.snackbar.openSnackBar(this.translate.instant('SHARING_OPERATION.VIEW.CONSUMPTION_MONITORING.UPLOAD_SUCCESS_LABEL'), VALIDATION_TYPE);
          } else {
            this.errorHandler.handleError(response);
          }
        },
        error:(error) => {
          this.errorHandler.handleError(error);
        },
      }
    );
  }

  protected readonly KeyStatus = SharingKeyStatus;
  protected readonly MeterStatus = MeterDataStatus;
}
