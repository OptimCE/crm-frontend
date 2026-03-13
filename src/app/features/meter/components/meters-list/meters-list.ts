import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MeterPartialQuery, PartialMeterDTO } from '../../../../shared/dtos/meter.dtos';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { MembersPartialDTO } from '../../../../shared/dtos/member.dtos';
import { Pagination } from '../../../../core/dtos/api.response';
import { MeterService } from '../../../../shared/services/meter.service';
import { Router } from '@angular/router';
import { MemberService } from '../../../../shared/services/member.service';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MeterDataStatus } from '../../../../shared/types/meter.types';
import { MeterCreation } from '../meter-creation/meter-creation';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { Table, TableLazyLoadEvent, TableModule, TablePageEvent } from 'primeng/table';
import { AddressPipe } from '../../../../shared/pipes/address/address-pipe';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { Button } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { InputText } from 'primeng/inputtext';
import { MemberPartialPipe } from '../../../../shared/pipes/member-partial/member-partial-pipe';
import { SharingOperationPartialDTO } from '../../../../shared/dtos/sharing_operation.dtos';
import { HeaderPage } from '../../../../layout/header-page/header-page';

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
    HeaderPage,
  ],
  templateUrl: './meters-list.html',
  styleUrl: './meters-list.css',
  providers: [DialogService],
})
export class MetersList implements OnInit {
  private metersService = inject(MeterService);
  private routing = inject(Router);
  private dialogService = inject(DialogService);
  private memberService = inject(MemberService);
  private snackbar = inject(SnackbarNotification);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  readonly isLoaded = signal(false);
  readonly metersPartialList = signal<PartialMeterDTO[]>([]);
  readonly filter = signal<MeterPartialQuery>({ page: 1, limit: 10 });
  ref?: DynamicDialogRef | null;
  addressFilter = {
    streetName: '',
    postcode: '',
    cityName: '',
  };
  readonly holders = signal<MembersPartialDTO[]>([]);
  readonly sharingOperations = signal<SharingOperationPartialDTO[]>([]);
  readonly statutCategory = signal<{ value: MeterDataStatus; label: string }[]>([]);

  readonly paginationInfo = signal<Pagination>(new Pagination(1, 10, 0, 1));
  readonly currentPageReportTemplate = signal('');
  readonly firstRow = computed(
    () => (this.paginationInfo().page - 1) * this.paginationInfo().limit,
  );
  readonly showPaginator = computed(() => this.paginationInfo().total_pages > 1);
  ngOnInit(): void {
    this.isLoaded.set(false);
    this.loadHolders();
    this.setupStatusCategory();
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

  setupStatusCategory(): void {
    this.translate
      .get([
        'METER.STATUS.ACTIVE_LABEL',
        'METER.STATUS.INACTIVE_LABEL',
        'METER.STATUS.WAITING_GRD_LABEL',
        'METER.STATUS.WAITING_MANAGER_LABEL',
      ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translation: Record<string, string>) => {
        this.statutCategory.set([
          { value: MeterDataStatus.ACTIVE, label: translation['METER.STATUS.ACTIVE_LABEL'] },
          { value: MeterDataStatus.INACTIVE, label: translation['METER.STATUS.INACTIVE_LABEL'] },
          {
            value: MeterDataStatus.WAITING_GRD,
            label: translation['METER.STATUS.WAITING_GRD_LABEL'],
          },
          {
            value: MeterDataStatus.WAITING_MANAGER,
            label: translation['METER.STATUS.WAITING_MANAGER_LABEL'],
          },
        ]);
      });
  }
  loadHolders(): void {
    this.memberService
      .getMembersList({ page: 1, limit: 10 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => {
        if (response) {
          this.holders.set(response.data as MembersPartialDTO[]);
        }
      });
  }

  loadMeters(): void {
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
            this.isLoaded.set(true);
            console.error('Error fetching meters partial list');
          }
        },
        error: (_error) => {
          this.isLoaded.set(true);
          console.error('Error fetching meters partial list');
        },
      });
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
      this.ref.onClose.subscribe((response) => {
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
      if ($event.rows) {
        current.page = $event.first / $event.rows + 1;
      } else {
        current.page = 1;
      }
    }

    if ($event.filters) {
      Object.entries($event.filters).forEach(([field, meta]) => {
        const filterMeta = Array.isArray(meta) ? meta[0] : meta;
        if (
          filterMeta &&
          filterMeta.value !== undefined &&
          filterMeta.value !== null &&
          filterMeta.value !== ''
        ) {
          if (field === 'EAN') {
            current.EAN = filterMeta.value as string;
          } else if (field === 'meter_number') {
            current.meter_number = filterMeta.value as string;
          } else if (field === 'statut') {
            current.status = filterMeta.value as MeterDataStatus;
          }
        } else {
          if (field === 'EAN') {
            delete current.EAN;
          } else if (field === 'meter_number') {
            delete current.meter_number;
          } else if (field === 'statut') {
            delete current.status;
          }
        }
      });
    }
    this.filter.set(current);
    this.loadMeters();
  }

  clear(table: Table): void {
    table.clear();
    this.addressFilter = {
      streetName: '',
      postcode: '',
      cityName: '',
    };
  }

  applyAddressFilter(dt: Table<PartialMeterDTO>): void {
    dt.filter(this.addressFilter.streetName, 'streetName', 'contains');
    dt.filter(this.addressFilter.postcode, 'postcode', 'contains');
    dt.filter(this.addressFilter.cityName, 'cityName', 'contains');
  }

  pageChange($event: TablePageEvent): void {
    const current: MeterPartialQuery = { ...this.filter() };
    if ($event.rows) {
      current.page = $event.first / $event.rows + 1;
    }
    this.filter.set(current);
    this.loadMeters();
  }

  protected readonly MeterStatus = MeterDataStatus;
}
