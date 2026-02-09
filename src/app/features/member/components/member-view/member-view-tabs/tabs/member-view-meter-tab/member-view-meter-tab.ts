import {Component, Input, OnDestroy, OnInit, signal} from '@angular/core';
import {Button} from 'primeng/button';
import {Ripple} from 'primeng/ripple';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {TableModule} from 'primeng/table';
import {MeterPartialQuery, PartialMeterDTO} from '../../../../../../../shared/dtos/meter.dtos';
import {Pagination} from '../../../../../../../core/dtos/api.response';
import {DialogService, DynamicDialogRef} from 'primeng/dynamicdialog';
import {MeterService} from '../../../../../../../shared/services/meter.service';
import {Router} from '@angular/router';
import {SnackbarNotification} from '../../../../../../../shared/services-ui/snackbar.notifcation.service';
import {MeterDataStatus} from '../../../../../../../shared/types/meter.types';
import {MeterCreation} from '../../../../../../meter/components/meter-creation/meter-creation';
import {VALIDATION_TYPE} from '../../../../../../../core/dtos/notification';
import {Tag} from 'primeng/tag';
import {Select} from 'primeng/select';
import {FormsModule} from '@angular/forms';
import {AddressPipe} from '../../../../../../../shared/pipes/address/address-pipe';
import {InputText} from 'primeng/inputtext';

@Component({
  selector: 'app-member-view-meter-tab',
  imports: [
    Button,
    Ripple,
    TranslatePipe,
    TableModule,
    Tag,
    Select,
    FormsModule,
    AddressPipe,
    InputText
  ],
  templateUrl: './member-view-meter-tab.html',
  styleUrl: './member-view-meter-tab.css',
  providers: [DialogService]
})
export class MemberViewMeterTab implements OnInit, OnDestroy{

  @Input() id!: number;

  filter = signal<MeterPartialQuery>({page: 1, limit: 10})

  paginationMetersInfo: Pagination = new Pagination(1, 10, 0, 1);
  metersPartialList = signal<PartialMeterDTO[]>([]);
  addressFilter = {
    streetName: '',
    postcode: '',
    cityName: '',
  };
  currentPageReportTemplate: string = '';
  statutCategory: any = [];
  sharingOperations = [];
  ref?: DynamicDialogRef | null;

  constructor(private meterService: MeterService,
              private translate: TranslateService,
              private routing: Router,
              private dialogService: DialogService,
              private snackbar: SnackbarNotification){}

  ngOnInit() {
    this.filter.set({page:1, limit: 10, holder_id: this.id})
    this.updateMeterPaginationTranslation()
    this.setupStatusCategory()
  }



  loadMeters() {
    this.meterService.getMetersList(this.filter()).subscribe(
      {
        next:(response)=>
        {
          if (response) {
            this.metersPartialList.set(response.data as PartialMeterDTO[]);
            this.paginationMetersInfo = response.pagination;
            this.updateMeterPaginationTranslation();
          } else {
            console.error('Error fetching meters partial list');
          }
        },
        error:(error) => {
          console.error('Error fetching meters partial list');
        },
      }
    );
  }
  lazyLoadMeters($event: any) {
    const current: any = {...this.filter()};
    if($event.first !== undefined && $event.rows !== undefined){
      if($event.rows){
        current.page = ($event.first / $event.rows) + 1
      }
      else{
        current.page = 1;
      }
    }

    if($event.filters){
      Object.entries($event.filters).forEach(([field, meta]) => {
        if ((meta as any).value) {
          current[field] = (meta as any).value;
        } else {
          delete current[field];
        }})
    }
    this.loadMeters();
  }

  updateMeterPaginationTranslation() {
    this.translate
      .get('MEMBER.VIEW.METERS.PAGE_REPORT_TEMPLATE_METER_LABEL', {
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
        'METER.STATUS.ACTIVE_LABEL',
        'METER.STATUS.INACTIVE_LABEL',
        'METER.STATUS.WAITING_GRD_LABEL',
        'METER.STATUS.WAITING_MANAGER_LABEL'
      ])
      .subscribe((translation) => {
        this.statutCategory = [
          { value: MeterDataStatus.ACTIVE, label: translation['METER.STATUS.ACTIVE_LABEL'] },
          { value: MeterDataStatus.INACTIVE, label: translation['METER.STATUS.INACTIVE_LABEL'] },
          { value: MeterDataStatus.WAITING_GRD, label: translation['METER.STATUS.WAITING_GRD_LABEL'] },
          { value: MeterDataStatus.WAITING_MANAGER, label: translation['METER.STATUS.WAITING_MANAGER_LABEL'] },
        ];
      });
  }


  clear(table: any) {
    table.clear();
    this.addressFilter = {
      streetName: '',
      postcode: '',
      cityName: '',
    };
  }

  onRowClick(meter: any) {
    this.routing.navigate(['/members/meter/' + meter.EAN]);
  }

  toAddMeter() {
    this.ref = this.dialogService.open(MeterCreation, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('MEMBER.VIEW.METERS.ADD_A_METER_HEADER'),
      data: {
        holder_id: this.id,
      },
    });
    if(this.ref){
      this.ref.onClose.subscribe((response) => {
        if (response) {
          this.snackbar.openSnackBar(this.translate.instant('MEMBER.VIEW.METERS.METER_ADDED_SUCCESSFULLY_LABEL'), VALIDATION_TYPE);
          this.loadMeters();
        }
      });
    }

  }

  ngOnDestroy() {
    if(this.ref){
      this.ref.destroy()
    }
  }

  protected readonly MeterDataStatus = MeterDataStatus;
}
