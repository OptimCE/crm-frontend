import { Component, DestroyRef, inject, OnInit, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { toLocalDateString } from '../../../../shared/utils/date.utils';
import { eanValidator } from './ean.validator';
import { CreateAddressDTO } from '../../../../shared/dtos/address.dtos';
import {
  AddressAutocomplete,
  AddressPicked,
} from '../../../../shared/components/address-autocomplete/address-autocomplete';
import {
  isAddressEmpty,
  prefixedAddressNames,
  readAddressFields,
} from '../../../../shared/components/address-autocomplete/address-field-source';
import {
  AddressPickStore,
  withPickedGeo,
} from '../../../../shared/components/address-autocomplete/address-pick-store';
import { InputText } from 'primeng/inputtext';
import { ErrorHandlerComponent } from '../../../../shared/components/error.handler/error.handler.component';
import { RadioButton } from 'primeng/radiobutton';
import { Textarea } from 'primeng/textarea';
import { Select } from 'primeng/select';
import { DatePicker } from 'primeng/datepicker';
import { FormErrorSummaryComponent } from '../../../../shared/components/summary-error.handler/summary-error.handler.component';
import { Button } from 'primeng/button';
import { ApiResponse } from '../../../../core/dtos/api.response';
import { Stepper } from 'primeng/stepper';
import { StepList } from 'primeng/stepper';
import { Step } from 'primeng/stepper';
import { StepPanel } from 'primeng/stepper';
import { StepPanels } from 'primeng/stepper';
import { FieldLabelHelper } from '../../../../shared/components/field-label-helper/field-label-helper';

interface ListRadio {
  id: number;
  name: string;
}

interface MeterFormValue {
  address_street: string;
  address_number: string;
  address_postcode: string;
  address_supplement: string;
  address_city: string;
  EAN: string;
  grd: string;
  meterNumber: string;
  tarifGroup: ListRadio;
  phasesNumber: ListRadio;
  readingFrequency: ListRadio;
  description: string;
  samplingPower: number;
  totalGeneratingCapacity: number;
  amperage: number;
  rate: ListRadio;
  productionChain: ListRadio;
  clientType: ListRadio;
  member: MembersPartialDTO;
  dateStart: Date;
  injectionStatus: ListRadio;
}

@Component({
  selector: 'app-meter-creation',
  standalone: true,
  imports: [
    TranslatePipe,
    InputText,
    ErrorHandlerComponent,
    RadioButton,
    FormsModule,
    Textarea,
    Select,
    DatePicker,
    FormErrorSummaryComponent,
    Button,
    ReactiveFormsModule,
    Stepper,
    StepList,
    Step,
    StepPanel,
    StepPanels,
    FieldLabelHelper,
    AddressAutocomplete,
  ],
  templateUrl: './meter-creation.html',
  styleUrl: './meter-creation.css',
})
export class MeterCreation implements OnInit {
  private memberService = inject(MemberService);
  private config = inject<DynamicDialogConfig<{ holder_id?: number }>>(DynamicDialogConfig);
  private meterService = inject(MeterService);
  private ref = inject(DynamicDialogRef);
  private translate = inject(TranslateService);
  private errorHandler = inject(ErrorMessageHandler);
  private destroyRef = inject(DestroyRef);

  errorsSummaryAdded: ErrorSummaryAdded = {};
  errorMemberAdd: ErrorAdded = {};
  metersForm!: FormGroup;

  readonly productionChainCategory = signal<ListRadio[]>([]);
  readonly rateCategory = signal<ListRadio[]>([]);
  readonly clientCategory = signal<ListRadio[]>([]);
  readonly injectionStatusCategory = signal<ListRadio[]>([]);
  readonly tarifGroupCategory = signal<ListRadio[]>([]);
  readonly phaseCategory = signal<ListRadio[]>([]);
  readonly readingFrequencyCategory = signal<ListRadio[]>([]);
  readonly membersList = signal<MembersPartialDTO[]>([]);

  minDate = new Date();
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
      EAN: new FormControl('', [Validators.required, eanValidator()]),
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
      productionChain: new FormControl('', [Validators.required]),
      clientType: new FormControl('', [Validators.required]),
      member: new FormControl(''),
      dateStart: new FormControl('', [Validators.required]),
      injectionStatus: new FormControl({ value: '', disabled: true }, [Validators.required]),
    });
    this.syncAddressDetailsVisibility();

    this.memberService
      .getMembersList({ page: 1, limit: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response && response.data) {
            this.membersList.set(response.data as MembersPartialDTO[]);
            if (this.holder_id) {
              this.metersForm.patchValue({
                member: this.membersList().find((member) => member.id == this.holder_id),
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

  setupTranslationError(): void {
    this.translate
      .get(['METER.ADD.ERRORS.SELECTED_MEMBER_INCORRECT'])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translation: Record<string, string>) => {
        this.errorMemberAdd = {
          errorMember: () => translation['METER.ADD.ERRORS.SELECTED_MEMBER_INCORRECT'],
        };
        this.errorsSummaryAdded = {
          errorMember: (_: unknown, _controlName: string) =>
            translation['METER.ADD.ERRORS.SELECTED_MEMBER_INCORRECT'],
        };
      });
  }

  setupTranslationCategory(): void {
    this.setupProductionChainCategory();
    this.setupRateCategory();
    this.setupClientCategory();
    this.setupInjectionStatusCategory();
    this.setupReadingFrequencyCategory();
    this.setupPhaseCategory();
    this.setupTarifGroupCategory();
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
        this.productionChainCategory.set([
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
        ]);
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
        this.rateCategory.set([
          { id: MeterRate.SIMPLE, name: translation['METER.CATEGORIES.RATE.SIMPLE'] },
          { id: MeterRate.BI_HOURLY, name: translation['METER.CATEGORIES.RATE.BI_HOURLY'] },
          {
            id: MeterRate.EXCLUSIVE_NIGHT,
            name: translation['METER.CATEGORIES.RATE.EXCLUSIVE_NIGHT'],
          },
        ]);
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
        this.clientCategory.set([
          { id: ClientType.RESIDENTIAL, name: translation['METER.CATEGORIES.CLIENT.RESIDENTIAL'] },
          {
            id: ClientType.PROFESSIONAL,
            name: translation['METER.CATEGORIES.CLIENT.PROFESSIONAL'],
          },
          { id: ClientType.INDUSTRIAL, name: translation['METER.CATEGORIES.CLIENT.INDUSTRIAL'] },
        ]);
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
        this.injectionStatusCategory.set([
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
        ]);
      });
  }

  setupReadingFrequencyCategory(): void {
    this.translate
      .get([
        'METER.CATEGORIES.READING_FREQUENCY.MONTHLY',
        'METER.CATEGORIES.READING_FREQUENCY.ANNUAL',
      ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translation: Record<string, string>) => {
        this.readingFrequencyCategory.set([
          {
            id: ReadingFrequency.MONTHLY,
            name: translation['METER.CATEGORIES.READING_FREQUENCY.MONTHLY'],
          },
          {
            id: ReadingFrequency.YEARLY,
            name: translation['METER.CATEGORIES.READING_FREQUENCY.ANNUAL'],
          },
        ]);
      });
  }

  setupPhaseCategory(): void {
    this.translate
      .get(['METER.CATEGORIES.PHASE.SINGLE_PHASE', 'METER.CATEGORIES.PHASE.THREE_PHASES'])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translation: Record<string, string>) => {
        this.phaseCategory.set([
          { id: PhaseCategory.SINGLE, name: translation['METER.CATEGORIES.PHASE.SINGLE_PHASE'] },
          { id: PhaseCategory.THREE, name: translation['METER.CATEGORIES.PHASE.THREE_PHASES'] },
        ]);
      });
  }

  setupTarifGroupCategory(): void {
    this.translate
      .get([
        'METER.CATEGORIES.TARIF_GROUP.LOW_VOLTAGE',
        'METER.CATEGORIES.TARIF_GROUP.HIGH_VOLTAGE',
      ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translation: Record<string, string>) => {
        this.tarifGroupCategory.set([
          {
            id: TarifGroup.LOW_TENSION,
            name: translation['METER.CATEGORIES.TARIF_GROUP.LOW_VOLTAGE'],
          },
          {
            id: TarifGroup.HIGH_TENSION,
            name: translation['METER.CATEGORIES.TARIF_GROUP.HIGH_VOLTAGE'],
          },
        ]);
      });
  }

  validMemberValidator(): ValidatorFn {
    return (control: AbstractControl) => {
      const value = control.value as MembersPartialDTO | null;
      if (!value) {
        return null;
      }
      const isValid =
        typeof value === 'object' && this.membersList().some((member) => member.id === value.id);
      return isValid ? null : { invalidMember: true };
    };
  }

  /** Where the picker finds this form's five address controls. */
  protected readonly addressSource = computed(() => ({
    group: this.metersForm,
    names: prefixedAddressNames('address'),
  }));
  protected readonly addressPick = new AddressPickStore();

  /**
   * Whether the five detailed address inputs are on screen.
   *
   * Creating a meter starts with the register search alone, because that is the
   * path that produces a rooftop pin; the raw fields are noise until there is
   * something in them. They open for good on anything that means "there is an
   * address here now" — a picked suggestion, a form that arrived prefilled, a
   * failed step validation, or the user asking to type it by hand.
   *
   * One-way on purpose, which is why there is no "hide" affordance: four of
   * the five inputs are `Validators.required`, so a re-collapsible block could
   * put a failing control off screen and leave the user with a step that
   * refuses to advance and nothing visible explaining why.
   */
  protected readonly addressDetailsOpen = signal(false);

  /**
   * The manual escape hatch, and it is load-bearing rather than a courtesy.
   *
   * The picker is suggest-only and must never gate a save (an address the
   * register does not know still has to be encodable). If picking a suggestion
   * were the ONLY way to reveal the inputs, collapsing them by default would
   * quietly turn that promise into a hard block.
   */
  protected openAddressDetails(): void {
    this.addressDetailsOpen.set(true);
  }

  /** Open the block whenever the form already carries an address. */
  private syncAddressDetailsVisibility(): void {
    if (!isAddressEmpty(readAddressFields(this.addressSource()))) {
      this.addressDetailsOpen.set(true);
    }
  }

  protected onAddressPicked(event: AddressPicked): void {
    this.metersForm.patchValue({
      address_street: event.fields.street,
      address_number: event.fields.number,
      address_postcode: event.fields.postcode,
      address_city: event.fields.city,
    });
    this.addressPick.remember(event);
    // Show what was just written: a pick that silently filled hidden inputs
    // would be indistinguishable from one that did nothing.
    this.addressDetailsOpen.set(true);
  }

  validateStep1(activateCallback: (step: number) => void): void {
    const step1Controls = [
      'address_street',
      'address_number',
      'address_postcode',
      'address_city',
      'EAN',
      'meterNumber',
      'tarifGroup',
      'phasesNumber',
      'readingFrequency',
    ];
    let valid = true;
    for (const name of step1Controls) {
      const ctrl = this.metersForm.get(name);
      if (ctrl) {
        ctrl.markAsTouched();
        if (ctrl.invalid) {
          valid = false;
          // The four required address controls live in the collapsible block.
          // Marking one touched while it is hidden would paint the step as
          // invalid with no visible field to fix.
          if (name.startsWith('address_')) {
            this.addressDetailsOpen.set(true);
          }
        }
      }
    }
    if (valid) {
      // No explicit probe here on purpose. The picker lives inside p-stepper's
      // `<ng-template #content>`, which PrimeNG renders in its OWN view, so a
      // @ViewChild in this component never resolves it — the call would be a
      // silent no-op that reads as coverage. The ambient probe already fires
      // 600 ms after typing stops, while the user is still on this step and the
      // fields are still on screen to correct.
      activateCallback(1);
    }
  }

  onSubmit(): void {
    if (!this.metersForm.valid) {
      return;
    }
    const formValue = this.metersForm.getRawValue() as MeterFormValue;
    const newMeterData: CreateMeterDataDTO = {
      description: formValue.description,
      sampling_power: formValue.samplingPower,
      status: MeterDataStatus.INACTIVE,
      amperage: formValue.amperage,
      rate: formValue.rate.id,
      client_type: formValue.clientType.id,
      start_date: toLocalDateString(formValue.dateStart),
      injection_status: formValue.injectionStatus.id,
      production_chain: formValue.productionChain.id,
      total_generating_capacity: formValue.totalGeneratingCapacity,
      grd: formValue.grd,
      member_id: formValue.member ? formValue.member.id : undefined,
      end_date: undefined,
    };
    // `geoFor` returns null once the user has edited away from what they picked,
    // so a stale rooftop coordinate can never reach the payload.
    const newAddress: CreateAddressDTO = withPickedGeo(
      {
        street: formValue.address_street,
        number: formValue.address_number,
        postcode: formValue.address_postcode,
        city: formValue.address_city,
        // `supplement` was silently dropped here while meter-UPDATE kept it, so
        // a box number typed at creation reappeared only after the first edit.
        supplement: formValue.address_supplement,
      },
      this.addressPick.geoFor(readAddressFields(this.addressSource())),
    );
    const newMeter: CreateMeterDTO = {
      EAN: formValue.EAN,
      address: newAddress,
      initial_data: newMeterData,
      meter_number: formValue.meterNumber,
      phases_number: formValue.phasesNumber.id,
      reading_frequency: formValue.readingFrequency.id,
      tarif_group: formValue.tarifGroup.id,
    };
    this.meterService
      .addMeter(newMeter)
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
          const errorData = error instanceof ApiResponse ? (error.data as string) : null;
          this.errorHandler.handleError(errorData);
        },
      });
  }

  onChangeProductionChain(): void {
    const formValue = this.metersForm.getRawValue() as MeterFormValue;
    if (
      formValue.productionChain &&
      formValue.productionChain.id === (ProductionChain.NONE as number)
    ) {
      const noneOption = this.injectionStatusCategory().find(
        (item) => (item.id as InjectionStatus) === InjectionStatus.NONE,
      );
      if (noneOption) {
        this.metersForm.get('injectionStatus')?.setValue(noneOption);
      }
      this.metersForm.get('injectionStatus')?.disable();
    } else {
      this.metersForm.get('injectionStatus')?.enable();
    }
  }
}
