import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Button } from 'primeng/button';
import { Ripple } from 'primeng/ripple';
import { InputTextModule } from 'primeng/inputtext';
import { ConfirmationService, MessageService, PrimeTemplate } from 'primeng/api';
import { FormsModule } from '@angular/forms';
import { TableLazyLoadEvent, TableModule, TablePageEvent } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { Skeleton } from 'primeng/skeleton';
import { Avatar } from 'primeng/avatar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ToastModule } from 'primeng/toast';
import { SplitButtonModule } from 'primeng/splitbutton';
import { ConfirmPopup } from 'primeng/confirmpopup';
import { DatePicker } from 'primeng/datepicker';
import { CardModule } from 'primeng/card';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConsumptionUpload } from '../../../../shared/components/consumption-upload/consumption-upload';
import { ConsumptionCoverage } from '../../../../shared/components/consumption-coverage/consumption-coverage';
import { CheckboxModule } from 'primeng/checkbox';
import { Drawer } from 'primeng/drawer';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import {
  SharingOperationDTO,
  SharingOperationKeyDTO,
  SharingOperationMetersQueryType,
} from '../../../../shared/dtos/sharing_operation.dtos';
import { MeterPartialQuery, PartialMeterDTO } from '../../../../shared/dtos/meter.dtos';
import { ApiResponse, Pagination } from '../../../../core/dtos/api.response';
import { SharingOperationService } from '../../../../shared/services/sharing_operation.service';
import { MeterService } from '../../../../shared/services/meter.service';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { MeterDataStatus } from '../../../../shared/types/meter.types';
import { SharingOperationAddMeter } from '../sharing-operation-add-meter/sharing-operation-add-meter';
import { SharingOperationAddKey } from '../sharing-operation-add-key/sharing-operation-add-key';
import { SharingKeyStatus } from '../../../../shared/types/sharing_operation.types';
import { ERROR_TYPE, VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { SharingOperationTypePipe } from '../../../../shared/pipes/sharing-operation-type/sharing-operation-type-pipe';
import { KeyPartialQuery } from '../../../../shared/dtos/key.dtos';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { Tooltip } from 'primeng/tooltip';
import { SharingOperationMetersList } from './sharing-operation-meters-list/sharing-operation-meters-list';
import { SharingOperationMeterEventService } from './sharing-operation.meter.subjet';
import { SelectMeterNewKeyDialog } from './dialogs/select-meter-new-key-dialog/select-meter-new-key-dialog';
import { BackArrow } from '../../../../layout/back-arrow/back-arrow';
import { SharingOperationConsumptionChart } from './sharing-operation-consumption-chart/sharing-operation-consumption-chart';
import { SharingOperationCreationUpdate } from '../sharing-operation-creation-update/sharing-operation-creation-update';
import { SharingOperationMunicipalitiesUpdate } from '../sharing-operation-municipalities-update/sharing-operation-municipalities-update';

@Component({
  selector: 'app-sharing-operation-view',
  standalone: true,
  imports: [
    Ripple,
    InputTextModule,
    PrimeTemplate,
    TableModule,
    TagModule,
    FormsModule,
    Skeleton,
    Avatar,
    RouterLink,
    DatePipe,
    ToastModule,
    SplitButtonModule,
    ConfirmPopup,
    DatePicker,
    CardModule,
    TranslatePipe,
    ConsumptionUpload,
    ConsumptionCoverage,
    CheckboxModule,
    Drawer,
    SharingOperationTypePipe,
    Button,
    Tabs,
    TabList,
    Tab,
    SharingOperationMetersList,
    TabPanel,
    TabPanels,
    BackArrow,
    SharingOperationConsumptionChart,
    Tooltip,
  ],
  templateUrl: './sharing-operation-view.html',
  styleUrl: './sharing-operation-view.css',
  providers: [DialogService, ConfirmationService, MessageService, ErrorMessageHandler],
})
export class SharingOperationView implements OnInit {
  private sharingOperationService = inject(SharingOperationService);
  private routing = inject(Router);
  private route = inject(ActivatedRoute);
  private metersService = inject(MeterService);
  private dialogService = inject(DialogService);
  private confirmationService = inject(ConfirmationService);
  private snackbar = inject(SnackbarNotification);
  private errorHandler = inject(ErrorMessageHandler);
  private translate = inject(TranslateService);
  private meterEventService = inject(SharingOperationMeterEventService);
  private destroyRef = inject(DestroyRef);

  readonly isLoading = signal<boolean>(true);
  readonly hasError = signal<boolean>(false);
  readonly togglingVisibility = signal<boolean>(false);
  readonly id = signal<number>(0);
  readonly sharingOperation = signal<SharingOperationDTO | undefined>(undefined);
  readonly sharingOperationKeys = signal<SharingOperationKeyDTO[]>([]);
  readonly loadingSharingOperationKeys = signal<boolean>(true);
  readonly paginationSharingOperationKey = signal<Pagination>({
    total: 0,
    total_pages: 0,
    page: 0,
    limit: 0,
  });
  readonly filterSharingOperationKey = signal<KeyPartialQuery>({ page: 1, limit: 10 });
  readonly paginationMetersInfo = signal<Pagination>(new Pagination(1, 10, 0, 1));
  readonly statutCategory = signal<{ value: MeterDataStatus; label: string }[]>([]);
  ref?: DynamicDialogRef | null;
  readonly sidebarHistoryKey = signal<boolean>(false);
  readonly dateStartApproved = signal<Date | null>(null);
  readonly currentPageReportTemplate = signal<string>('');
  readonly metersCharts = signal<PartialMeterDTO[]>([]);
  readonly selectedMeterCharts = signal<boolean[]>([]);
  readonly coverageReload = signal<number>(0);

  readonly hasKey = computed(() => !!this.sharingOperation()?.key?.key);
  readonly hasWaitingKey = computed(() => !!this.sharingOperation()?.key_waiting_approval);

  ngOnInit(): void {
    this.isLoading.set(true);
    const idParam = this.route.snapshot.paramMap.get('id') ?? '';
    if (idParam === '') {
      void this.routing.navigate(['//members/sharing/']);
      return;
    }
    this.id.set(+idParam);
    if (this.id()) {
      this.loadOperationSharing();
      this.setupStatusCategory();
      this.updatePaginationTranslation();
      this.loadAllMeters();
    }
  }

  updatePaginationTranslation(): void {
    this.translate
      .get('SHARING_OPERATION.VIEW.METER.PAGE_REPORT_TEMPLATE_METER_LABEL', {
        page: this.paginationMetersInfo().page,
        total_pages: this.paginationMetersInfo().total_pages,
        total: this.paginationMetersInfo().total,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translatedText: string) => {
        this.currentPageReportTemplate.set(translatedText);
      });
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
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translation: Record<string, string>) => {
        this.statutCategory.set([
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
        ]);
      });
  }

  loadOperationSharing(showLoading = true): void {
    if (showLoading) {
      this.isLoading.set(true);
    }
    this.hasError.set(false);
    this.sharingOperationService
      .getSharingOperation(this.id())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response) {
            this.sharingOperation.set(response.data as SharingOperationDTO);
          } else {
            this.hasError.set(true);
          }
          this.isLoading.set(false);
        },
        error: () => {
          this.hasError.set(true);
          this.isLoading.set(false);
        },
      });
  }
  toggleVisibility(): void {
    const op = this.sharingOperation();
    if (!op || this.togglingVisibility()) return;

    this.togglingVisibility.set(true);
    this.sharingOperationService
      .patchVisibility({
        id_sharing: op.id,
        is_public: !op.is_public,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response) {
            this.snackbar.openSnackBar(
              this.translate.instant(
                op.is_public
                  ? 'SHARING_OPERATION.VIEW.VISIBILITY.SET_PRIVATE_SUCCESS'
                  : 'SHARING_OPERATION.VIEW.VISIBILITY.SET_PUBLIC_SUCCESS',
              ) as string,
              VALIDATION_TYPE,
            );
            this.loadOperationSharing(false);
          } else {
            this.errorHandler.handleError();
          }
          this.togglingVisibility.set(false);
        },
        error: (error: unknown) => {
          const errorData = error instanceof ApiResponse ? (error.data as string) : null;
          this.errorHandler.handleError(errorData);
          this.togglingVisibility.set(false);
        },
      });
  }
  loadAllMeters(): void {
    try {
      const params: MeterPartialQuery = {
        sharing_operation_id: this.id(),
        page: 1,
        limit: 100,
      };
      this.metersService
        .getMetersList(params)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => {
            if (response) {
              this.metersCharts.set(response.data as PartialMeterDTO[]);
              this.selectedMeterCharts.set(this.metersCharts().map((_) => false));
            } else {
              console.error('Error fetching meters partial list');
            }
          },
          error: (_error) => {
            console.error('Error fetching meters partial list');
          },
        });
    } catch (e) {
      console.error('Error fetching meters partial list ' + String(e));
    }
  }

  editOperation(): void {
    const op = this.sharingOperation();
    if (!op) return;
    this.ref = this.dialogService.open(SharingOperationCreationUpdate, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      width: '640px',
      breakpoints: { '768px': '90vw', '480px': '100vw' },
      styleClass: 'responsive-dialog',
      header: this.translate.instant('SHARING_OPERATION.VIEW.EDIT_HEADER') as string,
      data: { operation: op },
    });
    this.ref?.onClose.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((response) => {
      if (response) {
        this.snackbar.openSnackBar(
          this.translate.instant('SHARING_OPERATION.VIEW.UPDATE_SUCCESS_LABEL') as string,
          VALIDATION_TYPE,
        );
        this.loadOperationSharing(false);
      }
    });
  }

  editMunicipalities(): void {
    const op = this.sharingOperation();
    if (!op) return;
    this.ref = this.dialogService.open(SharingOperationMunicipalitiesUpdate, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      width: '560px',
      breakpoints: { '768px': '90vw', '480px': '100vw' },
      styleClass: 'responsive-dialog',
      header: this.translate.instant('SHARING_OPERATION.VIEW.EDIT_MUNICIPALITIES_HEADER') as string,
      data: { id: op.id, municipalities: op.municipalities },
    });
    this.ref?.onClose.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((response) => {
      if (response) {
        this.snackbar.openSnackBar(
          this.translate.instant(
            'SHARING_OPERATION.VIEW.MUNICIPALITIES_UPDATED_SUCCESSFULLY_LABEL',
          ) as string,
          VALIDATION_TYPE,
        );
        this.loadOperationSharing(false);
      }
    });
  }

  addMeter(): void {
    this.ref = this.dialogService.open(SharingOperationAddMeter, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      width: '960px',
      breakpoints: { '1024px': '90vw', '640px': '100vw' },
      styleClass: 'responsive-dialog',
      header: this.translate.instant('SHARING_OPERATION.VIEW.METER.ADD_METERS_HEADER') as string,
      data: {
        id: this.id(),
      },
    });
    if (this.ref) {
      this.ref.onClose.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((response) => {
        if (response) {
          this.snackbar.openSnackBar(
            this.translate.instant(
              'SHARING_OPERATION.VIEW.METER.METER_ADDED_SUCCESSFULLY_LABEL',
            ) as string,
            VALIDATION_TYPE,
          );
          this.meterEventService.notifyMeterAdded();
        }
      });
    }
  }

  editKey(): void {
    this.ref = this.dialogService.open(SharingOperationAddKey, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('SHARING_OPERATION.VIEW.KEY.MODIFY_KEY_HEADER') as string,
      data: {
        id: this.id(),
      },
    });
    if (this.ref) {
      this.ref.onClose.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((response) => {
        if (response) {
          this.snackbar.openSnackBar(
            this.translate.instant(
              'SHARING_OPERATION.VIEW.KEY.KEY_MODIFIED_SUCCESSFULLY_LABEL',
            ) as string,
            VALIDATION_TYPE,
          );
          this.loadOperationSharing();
        }
      });
    }
  }

  revokeWaitingKey(): void {
    const waitingKey = this.sharingOperation()?.key_waiting_approval;
    if (waitingKey) {
      this.sharingOperationService
        .patchKeyStatus({
          id_key: waitingKey.key.id,
          id_sharing: this.id(),
          date: new Date(),
          status: SharingKeyStatus.REJECTED,
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => {
            if (response) {
              this.loadOperationSharing();
            } else {
              this.errorHandler.handleError();
            }
          },
          error: (error: unknown) => {
            const errorData = error instanceof ApiResponse ? (error.data as string) : null;
            this.errorHandler.handleError(errorData);
          },
        });
    }
  }

  approveWaitingKey(): void {
    const waitingKey = this.sharingOperation()?.key_waiting_approval;
    const dateApproved = this.dateStartApproved();
    if (waitingKey && dateApproved) {
      this.sharingOperationService
        .patchKeyStatus({
          id_key: waitingKey.key.id,
          id_sharing: this.id(),
          date: dateApproved,
          status: SharingKeyStatus.APPROVED,
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => {
            if (response) {
              if (this.ref) {
                this.ref.close(true);
              }
              this.loadOperationSharing();
            } else {
              this.errorHandler.handleError(response);
            }
          },
          error: (error) => {
            this.errorHandler.handleError(error);
          },
        });
    } else {
      this.snackbar.openSnackBar(
        this.translate.instant('SHARING_OPERATION.VIEW.KEY.APPROVE_KEY_NO_DATE_ERROR') as string,
        ERROR_TYPE,
      );
    }
  }

  openDateApprovedKey(event: Event): void {
    this.dateStartApproved.set(new Date());
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      acceptIcon: 'pi pi-check',
      rejectIcon: 'pi pi-times',
      acceptLabel: this.translate.instant('COMMON.ACTIONS.VALIDATE') as string,
      rejectLabel: this.translate.instant('COMMON.ACTIONS.CANCEL') as string,
      accept: () => {
        this.approveWaitingKey();
      },
    });
  }

  newKey(): void {
    this.ref = this.dialogService.open(SelectMeterNewKeyDialog, {
      header: 'Select meters for new key',
      width: '800px',
      data: { idSharing: this.id() },
    });

    this.ref?.onClose
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((selectedEANs: string[] | null) => {
        if (!selectedEANs?.length) return;
        void this.routing.navigate(['/keys/add'], {
          state: { consumers: selectedEANs },
        });
      });
  }

  /** Consumption data was uploaded — refresh the month-coverage grid. */
  onConsumptionUploaded(): void {
    // The uploader shows its own success toast and the service invalidates the
    // consumption cache; bump reloadKey so the coverage grid refetches.
    this.coverageReload.update((n) => n + 1);
  }

  protected readonly KeyStatus = SharingKeyStatus;
  protected readonly MeterStatus = MeterDataStatus;
  loadSharingOperationKey(): void {
    this.loadingSharingOperationKeys.set(true);
    this.sharingOperationService
      .getSharingOperationKeysList(this.id(), this.filterSharingOperationKey())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response) {
            this.sharingOperationKeys.set(response.data as SharingOperationKeyDTO[]);
            this.paginationSharingOperationKey.set(response.pagination);
            this.loadingSharingOperationKeys.set(false);
          }
        },
        error: (error: unknown) => {
          const errorData = error instanceof ApiResponse ? (error.data as string) : null;
          this.errorHandler.handleError(errorData);
          this.loadingSharingOperationKeys.set(false);
        },
      });
  }

  protected onPageSharingOperationKey($event: TablePageEvent): void {
    const current: KeyPartialQuery = { ...this.filterSharingOperationKey() };
    if ($event.rows) {
      current.page = ($event.first ?? 0) / $event.rows + 1;
    }
    this.filterSharingOperationKey.set(current);
    this.loadSharingOperationKey();
  }

  protected onLazyLoadSharingOperationKey($event: TableLazyLoadEvent): void {
    const current: KeyPartialQuery = { ...this.filterSharingOperationKey() };
    if ($event.first !== undefined && $event.rows !== undefined) {
      if ($event.rows) {
        current.page = $event.first / $event.rows + 1;
      } else {
        current.page = 1;
      }
    }
    this.filterSharingOperationKey.set(current);
    this.loadSharingOperationKey();
  }

  public SharingOperationMetersQueryType = SharingOperationMetersQueryType;
}
