import {Component, OnInit, signal} from '@angular/core';
import {MeterPartialQuery, PartialMeterDTO} from '../../../../shared/dtos/meter.dtos';
import {DialogService, DynamicDialogRef} from 'primeng/dynamicdialog';
import {MembersPartialDTO} from '../../../../shared/dtos/member.dtos';
import {Pagination} from '../../../../core/dtos/api.response';
import {MeterService} from '../../../../shared/services/meter.service';
import {Router} from '@angular/router';
import {MemberService} from '../../../../shared/services/member.service';
import {SnackbarNotification} from '../../../../shared/services-ui/snackbar.notifcation.service';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {MeterDataStatus} from '../../../../shared/types/meter.types';
import {MeterCreation} from '../meter-creation/meter-creation';
import {VALIDATION_TYPE} from '../../../../core/dtos/notification';
import {TableModule} from 'primeng/table';
import {AddressPipe} from '../../../../shared/pipes/address/address-pipe';
import {IconFieldModule} from 'primeng/iconfield';
import {InputIconModule} from 'primeng/inputicon';
import {Button} from 'primeng/button';
import {TagModule} from 'primeng/tag';
import {FormsModule} from '@angular/forms';
import {Select} from 'primeng/select';
import {InputText} from 'primeng/inputtext';
import {MemberPartialPipe} from '../../../../shared/pipes/member-partial/member-partial-pipe';

@Component({
  selector: 'app-meters-list',
  standalone: true,
  imports: [
    TableModule,
    AddressPipe,
    MemberPartialPipe,
    IconFieldModule,
    InputIconModule,
    Button,
    TagModule,
    FormsModule,
    TranslatePipe,
    Select,
    InputText,
  ],
  templateUrl: './meters-list.html',
  styleUrl: './meters-list.css',
  providers: [DialogService]
})
export class MetersList implements OnInit {
  isLoaded: boolean;
  metersPartialList = signal<PartialMeterDTO[]>([]);
  filter = signal<MeterPartialQuery>({page: 1, limit: 10})
  ref?: DynamicDialogRef | null;
  addressFilter = {
    streetName: '',
    postcode: '',
    cityName: '',
  };
  holders: MembersPartialDTO[] = [];
  sharingOperations = [];
  statutCategory: any[] = [];
  filters: any = {};

  paginationInfo: Pagination = new Pagination(1, 10, 0, 1);
  currentPageReportTemplate: string = '';
  constructor(
    private metersService: MeterService,
    private routing: Router,
    private dialogService: DialogService,
    private memberService: MemberService,
    private snackbar: SnackbarNotification,
    private translate: TranslateService,
  ) {
    this.isLoaded = false;

  }
  ngOnInit() {
    this.isLoaded = false;
    this.loadHolders();
    this.setupStatusCategory();
  }

  updatePaginationTranslation() {
    this.translate
      .get('METER.LIST.PAGE_REPORT_TEMPLATE_METER_LABEL', {
        page: this.paginationInfo.page,
        total_pages: this.paginationInfo.total_pages,
        total: this.paginationInfo.total,
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
        'METER.STATUS.WAITING_MANAGER_LABEL'])
      .subscribe((translation) => {
        this.statutCategory = [
          { value: MeterDataStatus.ACTIVE, label: translation['METER.STATUS.ACTIVE_LABEL'] },
          { value: MeterDataStatus.INACTIVE, label: translation['METER.STATUS.INACTIVE_LABEL'] },
          { value: MeterDataStatus.WAITING_GRD, label: translation['METER.STATUS.WAITING_GRD_LABEL'] },
          { value: MeterDataStatus.WAITING_MANAGER, label: translation['METER.STATUS.WAITING_MANAGER_LABEL'] },
        ];
      });
  }
  loadHolders() {
    this.memberService.getMembersList({page: 1, limit: 10}).subscribe((response) => {
      if (response) {
        this.holders = response.data as MembersPartialDTO[];
      }
    });
  }

  loadMeters() {
    this.metersService.getMetersList(this.filter()).subscribe(
      {
        next:(response)=>
        {
          if (response) {
            this.metersPartialList.set(response.data as PartialMeterDTO[]);
            this.paginationInfo = response.pagination;
            this.updatePaginationTranslation();
          } else {
            this.isLoaded = true;
            console.error('Error fetching meters partial list');
          }
        },
        error:(error) => {
          this.isLoaded = true;
          console.error('Error fetching meters partial list');
        },
      }
    );
  }

  onRowClick(meter: PartialMeterDTO) {
    this.routing.navigate(['/members/meter/' + meter.EAN]);
  }

  onAddMeter() {
    this.ref = this.dialogService.open(MeterCreation, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('METER.LIST.ADD_METER_HEADER'),
    });
    if(this.ref){
      this.ref.onClose.subscribe((response) => {
        if (response) {
          this.snackbar.openSnackBar(this.translate.instant('METER.LIST.METER_ADDED_SUCCESSFULLY_LABEL'), VALIDATION_TYPE);
          this.loadMeters();
        }
      });
    }

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

  clear(table: any) {
    table.clear();
    this.addressFilter = {
      streetName: '',
      postcode: '',
      cityName: '',
    };
  }

  applyAddressFilter(dt: any) {
    dt.filter(this.addressFilter.streetName, 'streetName', 'contains');
    dt.filter(this.addressFilter.postcode, 'postcode', 'contains');
    dt.filter(this.addressFilter.cityName, 'cityName', 'contains');
  }

  pageChange($event: any) {
    const current: any = {...this.filter()}
    current.page= $event.first / $event.rows + 1;
    this.filter.set(current);
    this.loadMeters();
  }

  protected readonly MeterStatus = MeterDataStatus;
}
