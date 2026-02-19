import { Component, inject, OnInit } from '@angular/core';
import { ErrorAdded, ErrorSummaryAdded } from '../../../../shared/types/error.types';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MembersPartialDTO } from '../../../../shared/dtos/member.dtos';
import { MemberService } from '../../../../shared/services/member.service';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { MeterService } from '../../../../shared/services/meter.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import {
  ClientType,
  InjectionStatus,
  MeterDataStatus,
  MeterRate,
  PhaseCategory,
  ProductionChain,
  ReadingFrequency,
  TarifGroup,
} from '../../../../shared/types/meter.types';
import { CreateMeterDataDTO, CreateMeterDTO } from '../../../../shared/dtos/meter.dtos';
import { CreateAddressDTO } from '../../../../shared/dtos/address.dtos';
import { Panel } from 'primeng/panel';
import { InputText } from 'primeng/inputtext';
import { ErrorHandlerComponent } from '../../../../shared/components/error.handler/error.handler.component';
import { InputGroup } from 'primeng/inputgroup';
import { RadioButton } from 'primeng/radiobutton';
import { Textarea } from 'primeng/textarea';
import { Select } from 'primeng/select';
import { DatePicker } from 'primeng/datepicker';
import { FormErrorSummaryComponent } from '../../../../shared/components/summary-error.handler/summary-error.handler.component';
import { Button } from 'primeng/button';
interface ListRadio {
  id: number;
  name: string;
}
@Component({
  selector: 'app-meter-creation',
  standalone: true,
  imports: [
    Panel,
    TranslatePipe,
    InputText,
    ErrorHandlerComponent,
    InputGroup,
    RadioButton,
    FormsModule,
    Textarea,
    Select,
    DatePicker,
    FormErrorSummaryComponent,
    Button,
    ReactiveFormsModule,
  ],
  templateUrl: './meter-creation.html',
  styleUrl: './meter-creation.css',
})
export class MeterCreation implements OnInit {
  private memberService = inject(MemberService);
  private config = inject(DynamicDialogConfig);
  private meterService = inject(MeterService);
  private ref = inject(DynamicDialogRef);
  private translate = inject(TranslateService);
  private errorHandler = inject(ErrorMessageHandler);
  errorsSummaryAdded: ErrorSummaryAdded = {};
  errorMemberAdd: ErrorAdded = {};
  metersForm!: FormGroup;
  productionChainCategory: ListRadio[] = [];
  rateCategory: ListRadio[] = [];
  clientCategory: ListRadio[] = [];
  injectionStatusCategory: ListRadio[] = [];
  minDate = new Date();
  membersList!: MembersPartialDTO[];
  tarifGroupCategory: ListRadio[] = [];
  phaseCategory: ListRadio[] = [];
  readingFrequencyCategory: ListRadio[] = [];
  holder_id?: number;
  grdAvailable: ListRadio[] = [
    { id: 1, name: 'RESA' },
    { id: 2, name: 'ORES' },
    { id: 3, name: 'AIEG' },
    { id: 4, name: 'AIESH' },
    { id: 5, name: 'REW' },
    { id: 6, name: 'ELIA' },
  ];

  constructor() {
    this.holder_id = undefined;
    if (this.config.data && this.config.data.holder_id) {
      this.holder_id = this.config.data.holder_id;
    }
  }

  ngOnInit(): void {
    this.metersForm = new FormGroup({
      address_street: new FormControl('', [Validators.required]),
      address_number: new FormControl('', [Validators.required]),
      address_postcode: new FormControl('', [Validators.required]),
      address_supplement: new FormControl('', []),
      address_city: new FormControl('', [Validators.required]),
      EAN: new FormControl('', [Validators.required,
        // eanValidator
      ]),
      grd: new FormControl('', [Validators.required]),
      meterNumber: new FormControl('', [Validators.required]),
      tarifGroup: new FormControl('', [Validators.required]),
      phasesNumber: new FormControl('', [Validators.required]),
      readingFrequency: new FormControl('', [Validators.required]),
      description: new FormControl('', []),
      samplingPower: new FormControl('', [Validators.required]),
      totalGeneratingCapacity: new FormControl('', [Validators.required]),
      amperage: new FormControl('', [Validators.required]),
      rate: new FormControl('', [Validators.required]),
      productionChain: new FormControl(
        this.productionChainCategory[this.productionChainCategory.length - 1],
        [Validators.required],
      ),
      clientType: new FormControl('', [Validators.required]),
      member: new FormControl('', [Validators.required,
        // this.validMemberValidator()
      ]),
      dateStart: new FormControl('', [Validators.required]),
      injectionStatus: new FormControl(
        {
          value: this.injectionStatusCategory[this.injectionStatusCategory.length - 1],
          disabled: true,
        },
        [Validators.required],
      ),
    });
    console.log('TEST : ', this.metersForm.value.productionChain);
    this.memberService.getMembersList({ page: 1, limit: 100 }).subscribe({
      next: (response) => {
        if (response && response.data) {
          this.membersList = response.data as MembersPartialDTO[];
          if (this.holder_id) {
            this.metersForm.patchValue({
              member: this.membersList.find((member) => member.id == this.holder_id),
            });
          }
        } else {
          this.errorHandler.handleError(response);
        }
      },
      error: (error) => {
        this.errorHandler.handleError(error);
      },
    });
    this.setupTranslationError();
    this.setupTranslationCategory();
  }

  setupTranslationError() {
    this.translate.get(['METER.ADD.ERRORS.SELECTED_MEMBER_INCORRECT']).subscribe((translation) => {
      this.errorMemberAdd = {
        errorMember: () => translation['METER.ADD.ERRORS.SELECTED_MEMBER_INCORRECT'],
      };
      this.errorsSummaryAdded = {
        errorMember: (_: any, _controlName: string) =>
          translation['METER.ADD.ERRORS.SELECTED_MEMBER_INCORRECT'],
      };
    });
  }
  setupTranslationCategory() {
    this.setupProductionChainCategory();
    this.setupRateCategory();
    this.setupClientCategory();
    this.setupInjectionStatusCategory();
    this.setupReadingFrequencyCategory();
    this.setupPhaseCategory();
    this.setupTarifGroupCategory();
  }

  setupProductionChainCategory() {
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
      .subscribe((translation) => {
        this.productionChainCategory = [
          {
            id: ProductionChain.PHOTOVOLTAIC,
            name: translation['METER.CATEGORIES.PRODUCTION_CHAIN.PHOTOVOLTAIC'],
          },
          { id: ProductionChain.WIND, name: translation['METER.CATEGORIES.PRODUCTION_CHAIN.WIND'] },
          {
            id: ProductionChain.HYDRO,
            name: translation['METER.CATEGORIES.PRODUCTION_CHAIN.HYDROELECTRIC'],
          },
          {
            id: ProductionChain.BIOMASS,
            name: translation['METER.CATEGORIES.PRODUCTION_CHAIN.SOLID_BIOMASS'],
          },
          {
            id: ProductionChain.BIOGAS,
            name: translation['METER.CATEGORIES.PRODUCTION_CHAIN.BIOGAS'],
          },
          {
            id: ProductionChain.COGEN_FOSSIL,
            name: translation['METER.CATEGORIES.PRODUCTION_CHAIN.FOSSIL_FIRE_COGENERATION'],
          },
          {
            id: ProductionChain.OTHER,
            name: translation['METER.CATEGORIES.PRODUCTION_CHAIN.OTHER'],
          },
          { id: ProductionChain.NONE, name: translation['METER.CATEGORIES.PRODUCTION_CHAIN.NONE'] },
        ];
      });
  }

  setupRateCategory() {
    this.translate
      .get([
        'METER.CATEGORIES.RATE.SIMPLE',
        'METER.CATEGORIES.RATE.BI_HOURLY',
        'METER.CATEGORIES.RATE.EXCLUSIVE_NIGHT',
      ])
      .subscribe((translation) => {
        this.rateCategory = [
          { id: MeterRate.SIMPLE, name: translation['METER.CATEGORIES.RATE.SIMPLE'] },
          { id: MeterRate.BI_HOURLY, name: translation['METER.CATEGORIES.RATE.BI_HOURLY'] },
          {
            id: MeterRate.EXCLUSIVE_NIGHT,
            name: translation['METER.CATEGORIES.RATE.EXCLUSIVE_NIGHT'],
          },
        ];
      });
  }

  setupClientCategory() {
    this.translate
      .get([
        'METER.CATEGORIES.CLIENT.RESIDENTIAL',
        'METER.CATEGORIES.CLIENT.PROFESSIONAL',
        'METER.CATEGORIES.CLIENT.INDUSTRIAL',
      ])
      .subscribe((translation) => {
        this.clientCategory = [
          { id: ClientType.RESIDENTIAL, name: translation['METER.CATEGORIES.CLIENT.RESIDENTIAL'] },
          {
            id: ClientType.PROFESSIONAL,
            name: translation['METER.CATEGORIES.CLIENT.PROFESSIONAL'],
          },
          { id: ClientType.INDUSTRIAL, name: translation['METER.CATEGORIES.CLIENT.INDUSTRIAL'] },
        ];
      });
  }

  setupInjectionStatusCategory() {
    this.translate
      .get([
        'METER.CATEGORIES.INJECTION_STATUS.NONE',
        'METER.CATEGORIES.INJECTION_STATUS.AUTOPRODUCER_OWNER',
        'METER.CATEGORIES.INJECTION_STATUS.SELF_PRODUCTION_RIGHT_OF_USER',
        'METER.CATEGORIES.INJECTION_STATUS.OWNER_PURE_INJECTION',
        'METER.CATEGORIES.INJECTION_STATUS.PURE_INJECTION_RIGHT_OF_USE',
      ])
      .subscribe((translation) => {
        this.injectionStatusCategory = [
          {
            id: InjectionStatus.AUTOPROD_OWNER,
            name: translation['METER.CATEGORIES.INJECTION_STATUS.AUTOPRODUCER_OWNER'],
          },
          {
            id: InjectionStatus.AUTOPROD_RIGHTS,
            name: translation['METER.CATEGORIES.INJECTION_STATUS.SELF_PRODUCTION_RIGHT_OF_USER'],
          },
          {
            id: InjectionStatus.INJECTION_OWNER,
            name: translation['METER.CATEGORIES.INJECTION_STATUS.OWNER_PURE_INJECTION'],
          },
          {
            id: InjectionStatus.INJECTION_RIGHTS,
            name: translation['METER.CATEGORIES.INJECTION_STATUS.PURE_INJECTION_RIGHT_OF_USE'],
          },
          { id: InjectionStatus.NONE, name: translation['METER.CATEGORIES.INJECTION_STATUS.NONE'] },
        ];
      });
  }

  setupReadingFrequencyCategory() {
    this.translate
      .get([
        'METER.CATEGORIES.READING_FREQUENCY.MONTHLY',
        'METER.CATEGORIES.READING_FREQUENCY.ANNUAL',
      ])
      .subscribe((translation) => {
        this.readingFrequencyCategory = [
          {
            id: ReadingFrequency.MONTHLY,
            name: translation['METER.CATEGORIES.READING_FREQUENCY.MONTHLY'],
          },
          {
            id: ReadingFrequency.YEARLY,
            name: translation['METER.CATEGORIES.READING_FREQUENCY.ANNUAL'],
          },
        ];
      });
  }

  setupPhaseCategory() {
    this.translate
      .get(['METER.CATEGORIES.PHASE.SINGLE_PHASE', 'METER.CATEGORIES.PHASE.THREE_PHASES'])
      .subscribe((translation) => {
        this.phaseCategory = [
          { id: PhaseCategory.SINGLE, name: translation['METER.CATEGORIES.PHASE.SINGLE_PHASE'] },
          { id: PhaseCategory.THREE, name: translation['METER.CATEGORIES.PHASE.THREE_PHASES'] },
        ];
      });
  }

  setupTarifGroupCategory() {
    this.translate
      .get([
        'METER.CATEGORIES.TARIF_GROUP.LOW_VOLTAGE',
        'METER.CATEGORIES.TARIF_GROUP.HIGH_VOLTAGE',
      ])
      .subscribe((translation) => {
        this.tarifGroupCategory = [
          {
            id: TarifGroup.LOW_TENSION,
            name: translation['METER.CATEGORIES.TARIF_GROUP.LOW_VOLTAGE'],
          },
          {
            id: TarifGroup.HIGH_TENSION,
            name: translation['METER.CATEGORIES.TARIF_GROUP.HIGH_VOLTAGE'],
          },
        ];
      });
  }

  validMemberValidator(): ValidatorFn {
    return (control: AbstractControl) => {
      const value = control.value;

      // Allow empty values (handled by required validator)
      if (!value) {
        return null;
      }

      // Check if value is a valid member
      const isValid =
        typeof value === 'object' &&
        true &&
        this.membersList.some((member) => member.id === value.id);
      return isValid ? null : { invalidMember: true };
    };
  }

  onSubmit() {
    if (!this.metersForm.valid) {
      console.error('Form not valid');
      return;
    }
    const newMeterData: CreateMeterDataDTO = {
      description: this.metersForm.get('description')?.value,
      sampling_power: this.metersForm.get('samplingPower')?.value,
      status: MeterDataStatus.INACTIVE,
      amperage: this.metersForm.get('amperage')?.value,
      rate: this.metersForm.get('rate')?.value.id,
      client_type: this.metersForm.get('clientType')?.value.id,
      start_date: this.metersForm.get('dateStart')?.value,
      injection_status: this.metersForm.get('injectionStatus')?.value.id,
      production_chain: this.metersForm.get('productionChain')?.value.id,
      total_generating_capacity: this.metersForm.get('totalGeneratingCapacity')?.value,
      grd: this.metersForm.get('grd')?.value,
      member_id: this.metersForm.get('member')?.value.id,
      end_date: undefined,
    };
    const newAddress: CreateAddressDTO = {
      street: this.metersForm.value.address_street,
      number: this.metersForm.value.address_number,
      postcode: this.metersForm.value.address_postcode,
      city: this.metersForm.value.address_city,
    };
    const newMeter: CreateMeterDTO = {
      EAN: this.metersForm.value.EAN,
      address: newAddress,
      initial_data: newMeterData,
      meter_number: this.metersForm.value.meterNumber,
      phases_number: this.metersForm.value.phasesNumber.id,
      reading_frequency: this.metersForm.value.readingFrequency.id,
      tarif_group: this.metersForm.value.tarifGroup.id,
    };
    this.meterService.addMeter(newMeter).subscribe({
      next: (response) => {
        if (response) {
          this.ref.close(true);
        } else {
          this.errorHandler.handleError();
        }
      },
      error: (error) => {
        this.errorHandler.handleError(error.data ?? null);
      },
    });
  }

  onChangeProductionChain() {
    if (this.metersForm.value.productionChain.id == 8) {
      if (
        this.metersForm.value.injectionStatus.id !=
        this.injectionStatusCategory[this.injectionStatusCategory.length - 1].id
      ) {
        this.metersForm
          .get('injectionStatus')
          ?.setValue(this.injectionStatusCategory[this.injectionStatusCategory.length - 1]);
      }
      this.metersForm.get('injectionStatus')?.disable();
    } else {
      this.metersForm.get('injectionStatus')?.enable();
    }
  }
}
