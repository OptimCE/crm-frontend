import {Component, inject, Input, OnInit} from '@angular/core';
import { FormErrorSummaryComponent } from '../../../../shared/components/summary-error.handler/summary-error.handler.component';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { PaginatorModule } from 'primeng/paginator';
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
import { ToggleButtonModule } from 'primeng/togglebutton';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Textarea } from 'primeng/textarea';
import { Select } from 'primeng/select';
import { DatePicker } from 'primeng/datepicker';
import { ErrorAdded, ErrorSummaryAdded } from '../../../../shared/types/error.types';
import { MetersDataDTO, PatchMeterDataDTO } from '../../../../shared/dtos/meter.dtos';
import { MembersPartialDTO } from '../../../../shared/dtos/member.dtos';
import { MemberService } from '../../../../shared/services/member.service';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { MeterService } from '../../../../shared/services/meter.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';

@Component({
  selector: 'app-meter-data-update',
  imports: [
    CheckboxModule,
    InputTextModule,
    PaginatorModule,
    RadioButtonModule,
    ReactiveFormsModule,
    Button,
    ErrorHandlerComponent,
    ToggleButtonModule,
    TranslatePipe,
    FormErrorSummaryComponent,
    Textarea,
    Select,
    DatePicker,
  ],
  templateUrl: './meter-data-update.html',
  styleUrl: './meter-data-update.css',
})
export class MeterDataUpdate implements OnInit {
  private memberService = inject(MemberService)
  private config = inject(DynamicDialogConfig)
  private meterService = inject(MeterService)
  private ref = inject(DynamicDialogRef)
  private translate = inject(TranslateService)
  private errorHandler = inject(ErrorMessageHandler)
  errorMemberAdded: ErrorAdded = {};
  errorsSummaryAdded: ErrorSummaryAdded = {};

  @Input()
  meterData?: MetersDataDTO;
  @Input()
  id: string;
  metersForm!: FormGroup;
  productionChainCategory = [
    { id: 1, name: '' },
    { id: 2, name: '' },
    { id: 3, name: '' },
    { id: 4, name: '' },
    { id: 5, name: '' },
    { id: 6, name: '' },
    { id: 7, name: '' },
    { id: 8, name: '' },
  ];
  rateCategory: any[] = [
    { id: 1, name: '' },
    { id: 2, name: '' },
    { id: 3, name: '' },
  ];
  clientCategory: any[] = [
    { id: 1, name: '' },
    { id: 2, name: '' },
    { id: 3, name: '' },
  ];
  injectionStatusCategory: any[] = [
    {
      id: 1,
      name: '',
    },
    {
      id: 2,
      name: '',
    },
    {
      id: 3,
      name: '',
    },
    {
      id: 4,
      name: '',
    },
    {
      id: 5,
      name: '',
    },
  ];
  grdAvailable: any[] = [
    { id: 1, name: 'RESA' },
    { id: 2, name: 'ORES' },
    { id: 3, name: 'AIEG' },
    { id: 4, name: 'AIESH' },
    { id: 5, name: 'REW' },
    { id: 6, name: 'ELIA' },
  ];
  membersList!: MembersPartialDTO[];
  constructor(

  ) {
    this.meterData = this.config.data.meterData;
    this.id = this.config.data.id;
  }

  ngOnInit(): void {
    this.memberService.getMembersList({ page: 1, limit: 10 }).subscribe({
      next: (response) => {
        if (response && response.data) {
          this.membersList = response.data as MembersPartialDTO[];
          if (this.meterData && this.meterData.member) {
            const member = this.meterData.member;
            this.metersForm.patchValue({
              member: this.membersList.find((m) => m.id === member.id),
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
    this.metersForm = new FormGroup({
      description: new FormControl('', []),
      samplingPower: new FormControl('', [Validators.required]),
      totalGeneratingCapacity: new FormControl('', [Validators.required]),
      amperage: new FormControl('', [Validators.required]),
      rate: new FormControl('', [Validators.required]),
      productionChain: new FormControl('', [Validators.required]),
      clientType: new FormControl('', [Validators.required]),
      member: new FormControl('', [Validators.required, this.validMemberValidator()]),
      dateStart: new FormControl('', [Validators.required]),
      status: new FormControl('', [Validators.required]),
      injectionStatus: new FormControl('', [Validators.required]),
      grd: new FormControl('', [Validators.required]),
    });

    this.setupErrorTranslation();
    this.setupTranslationCategory();
    if (this.meterData) {
      console.log('PATCH VALUE');
      console.log(this.productionChainCategory);
      console.log(this.meterData?.production_chain);
      console.log(
        this.productionChainCategory.find((p) => p.id == this.meterData?.production_chain),
      );
      this.metersForm.patchValue({
        description: this.meterData.description,
        samplingPower: this.meterData.sampling_power,
        totalGeneratingCapacity: this.meterData.totalGenerating_capacity,
        amperage: this.meterData.amperage,
        productionChain: this.productionChainCategory.find(
          (p) => p.id == this.meterData?.production_chain,
        ),
        injectionStatus: this.injectionStatusCategory.find(
          (p) => p.id == this.meterData?.injection_status,
        ),
        rate: this.rateCategory.find((p) => p.id == this.meterData?.rate),
        clientType: this.clientCategory.find((p) => p.id == this.meterData?.client_type),
        grd: this.grdAvailable.find((p) => p.name == this.meterData?.grd),
        status: this.meterData.status,
      });
    }
  }
  setupErrorTranslation() {
    this.translate
      .get(['METER.UPDATE_DATA.ERRORS.SELECTED_MEMBER_INCORRECT'])
      .subscribe((translation) => {
        this.errorMemberAdded = {
          invalidMember: () => translation['METER.UPDATE_DATA.ERRORS.SELECTED_MEMBER_INCORRECT'],
        };
        this.errorsSummaryAdded = {
          invalidMember: (_: any, _controlName: string) =>
            translation['METER.UPDATE_DATA.ERRORS.SELECTED_MEMBER_INCORRECT'],
        };
      });
  }

  setupTranslationCategory() {
    this.setupProductionChainCategory();
    this.setupRateCategory();
    this.setupClientCategory();
    this.setupInjectionStatusCategory();
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
        this.productionChainCategory.forEach((item, index) => {
          item.name = translations[index];
        });
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
        const translations = [
          translation['METER.CATEGORIES.RATE.SIMPLE'],
          translation['METER.CATEGORIES.RATE.BI_HOURLY'],
          translation['METER.CATEGORIES.RATE.EXCLUSIVE_NIGHT'],
        ];
        this.rateCategory.forEach((item, index) => {
          item.name = translations[index];
        });
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
        const translations = [
          translation['METER.CATEGORIES.CLIENT.RESIDENTIAL'],
          translation['METER.CATEGORIES.CLIENT.PROFESSIONAL'],
          translation['METER.CATEGORIES.CLIENT.INDUSTRIAL'],
        ];

        this.clientCategory.forEach((item, index) => {
          item.name = translations[index];
        });
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
        const translations = [
          translation['METER.CATEGORIES.INJECTION_STATUS.AUTOPRODUCER_OWNER'],
          translation['METER.CATEGORIES.INJECTION_STATUS.SELF_PRODUCTION_RIGHT_OF_USER'],
          translation['METER.CATEGORIES.INJECTION_STATUS.OWNER_PURE_INJECTION'],
          translation['METER.CATEGORIES.INJECTION_STATUS.PURE_INJECTION_RIGHT_OF_USE'],
          translation['METER.CATEGORIES.INJECTION_STATUS.NONE'],
        ];

        this.injectionStatusCategory.forEach((item, index) => {
          item.name = translations[index];
        });
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
    const updateMeterData: PatchMeterDataDTO = {
      EAN: this.id,
      amperage: this.metersForm.get('amperage')?.value,
      client_type: this.metersForm.get('clientType')?.value.id,
      description: this.metersForm.get('description')?.value,
      end_date: undefined,
      grd: this.metersForm.get('grd')?.value.name,
      injection_status: this.metersForm.get('injectionStatus')?.value.id,
      member_id: this.metersForm.get('member')?.value.id,
      production_chain: this.metersForm.get('productionChain')?.value.id,
      rate: this.metersForm.get('rate')?.value.id,
      sampling_power: this.metersForm.get('samplingPower')?.value,
      sharing_operation_id: undefined,
      start_date: this.metersForm.get('dateStart')?.value,
      status: this.metersForm.get('status')?.value,
      total_generating_capacity: this.metersForm.get('totalGeneratingCapacity')?.value,
    };

    this.meterService.patchMeterData(updateMeterData).subscribe({
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
}
