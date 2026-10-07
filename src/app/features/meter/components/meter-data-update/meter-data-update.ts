import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { formatDate } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormErrorSummaryComponent } from '../../../../shared/components/summary-error.handler/summary-error.handler.component';
import { InputTextModule } from 'primeng/inputtext';
import { RadioButtonModule } from 'primeng/radiobutton';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Button } from 'primeng/button';
import { ErrorHandlerComponent } from '../../../../shared/components/error.handler/error.handler.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Textarea } from 'primeng/textarea';
import { Select } from 'primeng/select';
import { DatePicker } from 'primeng/datepicker';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { ErrorAdded, ErrorSummaryAdded } from '../../../../shared/types/error.types';
import { MetersDataDTO, PatchMeterDataDTO } from '../../../../shared/dtos/meter.dtos';
import { toLocalDateString } from '../../../../shared/utils/date.utils';
import { MembersPartialDTO } from '../../../../shared/dtos/member.dtos';
import { MemberService } from '../../../../shared/services/member.service';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { MeterService } from '../../../../shared/services/meter.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error.utils';
import { translatedOptions } from '../../../../shared/utils/translated-options.utils';
import {
  MeterDataStatus,
  ClientType,
  InjectionStatus,
  MeterRate,
  ProductionChain,
} from '../../../../shared/types/meter.types';

// Large enough to hold every member of a community, so any of them can be picked.
const MEMBERS_PAGE_LIMIT = 500;

interface MeterDataUpdateDialogData {
  meterData: MetersDataDTO;
  id: string;
}

interface MeterDataCategory<T = number> {
  id: T;
  name: string;
}

interface MeterDataStatusOption {
  value: MeterDataStatus;
  label: string;
}

interface MeterDataFormValue {
  description: string;
  samplingPower: number;
  totalGeneratingCapacity: number;
  amperage: number;
  rate: MeterDataCategory<MeterRate>;
  productionChain: MeterDataCategory<ProductionChain>;
  clientType: MeterDataCategory<ClientType>;
  member: MembersPartialDTO | '' | null;
  dateStart: string | Date;
  status: MeterDataStatus;
  injectionStatus: MeterDataCategory<InjectionStatus>;
  grd: MeterDataCategory;
}

@Component({
  selector: 'app-meter-data-update',
  imports: [
    InputTextModule,
    RadioButtonModule,
    ReactiveFormsModule,
    Button,
    ErrorHandlerComponent,
    TranslatePipe,
    FormErrorSummaryComponent,
    Textarea,
    Select,
    DatePicker,
    ConfirmDialog,
  ],
  templateUrl: './meter-data-update.html',
  styleUrl: './meter-data-update.css',
  providers: [ConfirmationService],
})
export class MeterDataUpdate implements OnInit {
  private memberService = inject(MemberService);
  private config = inject(DynamicDialogConfig);
  private meterService = inject(MeterService);
  private ref = inject(DynamicDialogRef);
  private translate = inject(TranslateService);
  private errorHandler = inject(ErrorMessageHandler);
  private confirmationService = inject(ConfirmationService);
  private destroyRef = inject(DestroyRef);
  readonly errorMemberAdded = signal<ErrorAdded>({});
  readonly errorsSummaryAdded = signal<ErrorSummaryAdded>({});

  readonly meterData?: MetersDataDTO;
  readonly id: string;
  metersForm!: FormGroup;
  readonly statusOptions = translatedOptions<MeterDataStatusOption>([
    { value: MeterDataStatus.ACTIVE, label: 'METER.STATUS.ACTIVE_LABEL' },
    { value: MeterDataStatus.INACTIVE, label: 'METER.STATUS.INACTIVE_LABEL' },
    { value: MeterDataStatus.WAITING_GRD, label: 'METER.STATUS.WAITING_GRD_LABEL' },
    { value: MeterDataStatus.WAITING_MANAGER, label: 'METER.STATUS.WAITING_MANAGER_LABEL' },
  ]);
  readonly productionChainCategory = signal<MeterDataCategory<ProductionChain>[]>([
    { id: ProductionChain.PHOTOVOLTAIC, name: '' },
    { id: ProductionChain.WIND, name: '' },
    { id: ProductionChain.HYDRO, name: '' },
    { id: ProductionChain.BIOMASS, name: '' },
    { id: ProductionChain.BIOGAS, name: '' },
    { id: ProductionChain.COGEN_FOSSIL, name: '' },
    { id: ProductionChain.OTHER, name: '' },
    { id: ProductionChain.NONE, name: '' },
  ]);
  readonly rateCategory = signal<MeterDataCategory<MeterRate>[]>([
    { id: MeterRate.SIMPLE, name: '' },
    { id: MeterRate.BI_HOURLY, name: '' },
    { id: MeterRate.EXCLUSIVE_NIGHT, name: '' },
  ]);
  readonly clientCategory = signal<MeterDataCategory<ClientType>[]>([
    { id: ClientType.RESIDENTIAL, name: '' },
    { id: ClientType.PROFESSIONAL, name: '' },
    { id: ClientType.INDUSTRIAL, name: '' },
  ]);
  readonly injectionStatusCategory = signal<MeterDataCategory<InjectionStatus>[]>([
    { id: InjectionStatus.AUTOPROD_OWNER, name: '' },
    { id: InjectionStatus.AUTOPROD_RIGHTS, name: '' },
    { id: InjectionStatus.INJECTION_OWNER, name: '' },
    { id: InjectionStatus.INJECTION_RIGHTS, name: '' },
    { id: InjectionStatus.NONE, name: '' },
  ]);
  grdAvailable: MeterDataCategory[] = [
    { id: 1, name: 'RESA' },
    { id: 2, name: 'ORES' },
    { id: 3, name: 'AIEG' },
    { id: 4, name: 'AIESH' },
    { id: 5, name: 'REW' },
    { id: 6, name: 'ELIA' },
  ];
  readonly membersList = signal<MembersPartialDTO[]>([]);
  constructor() {
    const data = this.config.data as MeterDataUpdateDialogData;
    this.meterData = data.meterData;
    this.id = data.id;
  }

  ngOnInit(): void {
    // Build the form before subscribing: a cached members list is emitted synchronously,
    // and the holder pre-fill would otherwise be lost (empty holder, then removed on save).
    this.metersForm = new FormGroup({
      description: new FormControl('', []),
      samplingPower: new FormControl('', [Validators.required]),
      totalGeneratingCapacity: new FormControl('', [Validators.required]),
      amperage: new FormControl('', [Validators.required]),
      rate: new FormControl('', [Validators.required]),
      productionChain: new FormControl('', [Validators.required]),
      clientType: new FormControl('', [Validators.required]),
      member: new FormControl('', [this.validMemberValidator()]),
      dateStart: new FormControl('', [Validators.required]),
      status: new FormControl('', [Validators.required]),
      injectionStatus: new FormControl('', [Validators.required]),
      grd: new FormControl('', [Validators.required]),
    });
    this.memberService
      .getMembersList({ page: 1, limit: MEMBERS_PAGE_LIMIT })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response && response.data) {
            this.membersList.set(this.withCurrentHolder(response.data as MembersPartialDTO[]));
            if (this.meterData && this.meterData.member) {
              const member = this.meterData.member;
              this.metersForm.patchValue({
                member: this.membersList().find((m) => m.id === member.id),
              });
            }
          } else {
            console.error(response);
          }
        },
        error: (error) => {
          console.error(error);
        },
      });

    this.setupErrorTranslation();
    this.setupTranslationCategory();
    if (this.meterData) {
      this.metersForm.patchValue({
        description: this.meterData.description,
        samplingPower: this.meterData.sampling_power,
        totalGeneratingCapacity: this.meterData.totalGenerating_capacity,
        amperage: this.meterData.amperage,
        productionChain: this.productionChainCategory().find(
          (p) => p.id === this.meterData?.production_chain,
        ),
        injectionStatus: this.injectionStatusCategory().find(
          (p) => p.id === this.meterData?.injection_status,
        ),
        rate: this.rateCategory().find((p) => p.id === this.meterData?.rate),
        clientType: this.clientCategory().find((p) => p.id === this.meterData?.client_type),
        grd: this.grdAvailable.find((p) => p.name === this.meterData?.grd),
        status: this.meterData.status,
      });
    }
  }
  setupErrorTranslation(): void {
    this.translate
      .get(['METER.UPDATE_DATA.ERRORS.SELECTED_MEMBER_INCORRECT'])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translation: Record<string, string>) => {
        this.errorMemberAdded.set({
          invalidMember: () => translation['METER.UPDATE_DATA.ERRORS.SELECTED_MEMBER_INCORRECT'],
        });
        this.errorsSummaryAdded.set({
          invalidMember: (_: unknown, _controlName: string) =>
            translation['METER.UPDATE_DATA.ERRORS.SELECTED_MEMBER_INCORRECT'],
        });
      });
  }

  setupTranslationCategory(): void {
    this.setupProductionChainCategory();
    this.setupRateCategory();
    this.setupClientCategory();
    this.setupInjectionStatusCategory();
  }

  setupProductionChainCategory(): void {
    this.translate
      .get([
        'METER.CATEGORIES.PRODUCTION_CHAIN.PHOTOVOLTAIC',
        'METER.CATEGORIES.PRODUCTION_CHAIN.WIND',
        'METER.CATEGORIES.PRODUCTION_CHAIN.HYDROELECTRIC',
        'METER.CATEGORIES.PRODUCTION_CHAIN.SOLID_BIOMASS',
        'METER.CATEGORIES.PRODUCTION_CHAIN.BIOGAS',
        'METER.CATEGORIES.PRODUCTION_CHAIN.FOSSIL_FIRE_COGENERATION',
        'METER.CATEGORIES.PRODUCTION_CHAIN.OTHER',
        'METER.CATEGORIES.PRODUCTION_CHAIN.NONE',
      ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translation: Record<string, string>) => {
        const translations = [
          translation['METER.CATEGORIES.PRODUCTION_CHAIN.PHOTOVOLTAIC'],
          translation['METER.CATEGORIES.PRODUCTION_CHAIN.WIND'],
          translation['METER.CATEGORIES.PRODUCTION_CHAIN.HYDROELECTRIC'],
          translation['METER.CATEGORIES.PRODUCTION_CHAIN.SOLID_BIOMASS'],
          translation['METER.CATEGORIES.PRODUCTION_CHAIN.BIOGAS'],
          translation['METER.CATEGORIES.PRODUCTION_CHAIN.FOSSIL_FIRE_COGENERATION'],
          translation['METER.CATEGORIES.PRODUCTION_CHAIN.OTHER'],
          translation['METER.CATEGORIES.PRODUCTION_CHAIN.NONE'],
        ];
        this.productionChainCategory.update((items) =>
          items.map((item, index) => ({ ...item, name: translations[index] })),
        );
      });
  }

  setupRateCategory(): void {
    this.translate
      .get([
        'METER.CATEGORIES.RATE.SIMPLE',
        'METER.CATEGORIES.RATE.BI_HOURLY',
        'METER.CATEGORIES.RATE.EXCLUSIVE_NIGHT',
      ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translation: Record<string, string>) => {
        const translations = [
          translation['METER.CATEGORIES.RATE.SIMPLE'],
          translation['METER.CATEGORIES.RATE.BI_HOURLY'],
          translation['METER.CATEGORIES.RATE.EXCLUSIVE_NIGHT'],
        ];
        this.rateCategory.update((items) =>
          items.map((item, index) => ({ ...item, name: translations[index] })),
        );
      });
  }

  setupClientCategory(): void {
    this.translate
      .get([
        'METER.CATEGORIES.CLIENT.RESIDENTIAL',
        'METER.CATEGORIES.CLIENT.PROFESSIONAL',
        'METER.CATEGORIES.CLIENT.INDUSTRIAL',
      ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translation: Record<string, string>) => {
        const translations = [
          translation['METER.CATEGORIES.CLIENT.RESIDENTIAL'],
          translation['METER.CATEGORIES.CLIENT.PROFESSIONAL'],
          translation['METER.CATEGORIES.CLIENT.INDUSTRIAL'],
        ];
        this.clientCategory.update((items) =>
          items.map((item, index) => ({ ...item, name: translations[index] })),
        );
      });
  }

  setupInjectionStatusCategory(): void {
    this.translate
      .get([
        'METER.CATEGORIES.INJECTION_STATUS.NONE',
        'METER.CATEGORIES.INJECTION_STATUS.AUTOPRODUCER_OWNER',
        'METER.CATEGORIES.INJECTION_STATUS.SELF_PRODUCTION_RIGHT_OF_USER',
        'METER.CATEGORIES.INJECTION_STATUS.OWNER_PURE_INJECTION',
        'METER.CATEGORIES.INJECTION_STATUS.PURE_INJECTION_RIGHT_OF_USE',
      ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translation: Record<string, string>) => {
        const translations = [
          translation['METER.CATEGORIES.INJECTION_STATUS.AUTOPRODUCER_OWNER'],
          translation['METER.CATEGORIES.INJECTION_STATUS.SELF_PRODUCTION_RIGHT_OF_USER'],
          translation['METER.CATEGORIES.INJECTION_STATUS.OWNER_PURE_INJECTION'],
          translation['METER.CATEGORIES.INJECTION_STATUS.PURE_INJECTION_RIGHT_OF_USE'],
          translation['METER.CATEGORIES.INJECTION_STATUS.NONE'],
        ];
        this.injectionStatusCategory.update((items) =>
          items.map((item, index) => ({ ...item, name: translations[index] })),
        );
      });
  }

  validMemberValidator(): ValidatorFn {
    return (control: AbstractControl) => {
      const value = control.value as MembersPartialDTO | null;

      // Allow empty values (handled by required validator)
      if (!value) {
        return null;
      }

      // Check if value is a valid member
      const isValid =
        typeof value === 'object' &&
        true &&
        'id' in value &&
        this.membersList().some((member) => member.id === value.id);
      return isValid ? null : { invalidMember: true };
    };
  }

  /**
   * Keep the current holder selectable even when it is not in the loaded page of members:
   * otherwise the field opens empty and saving silently removes the holder.
   */
  private withCurrentHolder(members: MembersPartialDTO[]): MembersPartialDTO[] {
    const holder = this.meterData?.member;
    if (!holder || members.some((m) => m.id === holder.id)) {
      return members;
    }
    return [holder, ...members];
  }

  onSubmit(): void {
    if (!this.metersForm.valid) {
      return;
    }

    const formValue = this.metersForm.getRawValue() as MeterDataFormValue;

    const updateMeterData: PatchMeterDataDTO = {
      EAN: this.id,
      amperage: formValue.amperage,
      client_type: formValue.clientType.id,
      description: formValue.description,
      end_date: undefined,
      grd: formValue.grd.name,
      injection_status: formValue.injectionStatus.id,
      member_id: formValue.member ? formValue.member.id : undefined,
      production_chain: formValue.productionChain.id,
      rate: formValue.rate.id,
      sampling_power: formValue.samplingPower,
      sharing_operation_id: undefined,
      start_date: toLocalDateString(
        formValue.dateStart instanceof Date ? formValue.dateStart : new Date(formValue.dateStart),
      ),
      status: formValue.status,
      total_generating_capacity: formValue.totalGeneratingCapacity,
    };

    // A new holder sees the meter's readings and is billed for it from the start date:
    // make the manager confirm the change so a mis-picked member is caught before saving.
    const previousHolder = this.meterData?.member ?? null;
    const nextHolder = formValue.member || null;
    if ((previousHolder?.id ?? null) !== (nextHolder?.id ?? null)) {
      this.confirmHolderChange(previousHolder, nextHolder, formValue.dateStart, updateMeterData);
      return;
    }
    this.performSave(updateMeterData);
  }

  private confirmHolderChange(
    previousHolder: MembersPartialDTO | null,
    nextHolder: MembersPartialDTO | null,
    dateStart: string | Date,
    updateMeterData: PatchMeterDataDTO,
  ): void {
    let messageKey = 'METER.UPDATE_DATA.HOLDER_CHANGE.TRANSFER_MESSAGE';
    if (!previousHolder) {
      messageKey = 'METER.UPDATE_DATA.HOLDER_CHANGE.ASSIGN_MESSAGE';
    } else if (!nextHolder) {
      messageKey = 'METER.UPDATE_DATA.HOLDER_CHANGE.REMOVE_MESSAGE';
    }
    this.confirmationService.confirm({
      header: this.translate.instant('METER.UPDATE_DATA.HOLDER_CHANGE.HEADER') as string,
      message: this.translate.instant(messageKey, {
        ean: this.id,
        from: previousHolder?.name ?? '',
        to: nextHolder?.name ?? '',
        date: formatDate(dateStart, 'dd/MM/yyyy', 'en-US'),
      }) as string,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('COMMON.ACTIONS.VALIDATE') as string,
      rejectLabel: this.translate.instant('COMMON.ACTIONS.CANCEL') as string,
      accept: () => this.performSave(updateMeterData),
    });
  }

  private performSave(updateMeterData: PatchMeterDataDTO): void {
    this.meterService
      .patchMeterData(updateMeterData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response) {
            this.ref.close(true);
          } else {
            this.errorHandler.handleError();
          }
        },
        error: (error: unknown) => {
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }
}
