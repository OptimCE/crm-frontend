import { Component, DestroyRef, inject, OnInit, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
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
import {
  CreateMeterDataDTO,
  CreateMeterDTO,
  GrdSource,
  injectionStatusForApi,
  productionChainForApi,
} from '../../../../shared/dtos/meter.dtos';
import { toLocalDateString } from '../../../../shared/utils/date.utils';
import { eanValidator } from '../../../../shared/validators/ean.validator';
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
import { extractApiErrorMessage } from '../../../../shared/utils/api-error.utils';
import { Stepper } from 'primeng/stepper';
import { StepList } from 'primeng/stepper';
import { Step } from 'primeng/stepper';
import { StepPanel } from 'primeng/stepper';
import { StepPanels } from 'primeng/stepper';
import { FieldLabelHelper } from '../../../../shared/components/field-label-helper/field-label-helper';
import { ELIA_OPTION_ID, grdSelectOptions } from '../../../../shared/constants/grd';
import { Message } from 'primeng/message';
import { DsoService } from '../../../../shared/services/dso.service';
import {
  DsoCommuneDTO,
  DsoNames,
  DsoOperatorDTO,
  DsoRegion,
  DsoResolutionDTO,
  DsoResolveQuery,
  DsoSectionDTO,
  DsoWarningDTO,
} from '../../../../shared/dtos/dso.dtos';
import { translationChanges } from '../../../../shared/utils/translated-options.utils';

interface ListRadio {
  id: number;
  name: string;
}

/** The GRD lookup, from the moment step 1 is validated. */
type GrdLookupState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; resolution: DsoResolutionDTO };

/** A `choose_commune` answer, offered as inline radios. */
interface GrdCommuneChoice {
  communes: DsoCommuneDTO[];
  selected: string | null;
}

/** A `choose_section` answer whose sections disagree, offered as inline radios. */
interface GrdSectionChoice {
  /** The commune the sections belong to, when the answer named it. */
  ins: string | null;
  region: DsoRegion | null;
  sections: DsoSectionDTO[];
  selected: string | null;
}

export interface GrdChoiceOption {
  value: string;
  label: string;
}

/** What the form shows when the lookup could not answer: nothing changes. */
const GRD_LOOKUP_UNAVAILABLE: DsoResolutionDTO = {
  available: false,
  status: 'unavailable',
  warnings: [],
};

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
    Message,
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
  private dsoService = inject(DsoService);
  private destroyRef = inject(DestroyRef);
  private readonly translationChanged = translationChanges();

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

  /** The dso-lookup operator catalogue once it has loaded; until then, the static list. */
  private readonly grdCatalogue = signal<DsoOperatorDTO[] | null>(null);
  /** The GRD select's options: ORES first, Elia last (a new array: p-select takes a mutable one). */
  readonly grdAvailable = computed(() => {
    this.translationChanged();
    return grdSelectOptions(
      this.grdCatalogue(),
      this.translate.instant('METER.INFORMATIONS.GRD_ELIA_OPTION') as string,
    );
  });
  /**
   * How the GRD got its value: `auto` once the lookup filled it in, `manual` as soon as
   * the user picks one. A manual choice is never overwritten by a later answer.
   */
  readonly grdSource = signal<GrdSource | null>(null);
  /** The data version an `auto` value came from; it travels with it on submit. */
  private grdDataVersion: string | null = null;
  readonly grdLookup = signal<GrdLookupState>({ kind: 'idle' });
  readonly grdCommuneChoice = signal<GrdCommuneChoice | null>(null);
  readonly grdSectionChoice = signal<GrdSectionChoice | null>(null);
  /** The query built from step 1, which a commune or section choice then narrows. */
  private grdBaseQuery: DsoResolveQuery = {};
  private grdLookupSubscription: Subscription | null = null;

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
    this.loadGrdCatalogue();

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
          this.errorHandler.handleError(extractApiErrorMessage(error));
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
      // Not awaited: step 2 opens at once and the GRD fills in if and when the answer
      // comes. Here rather than on a pick, so a typed address is looked up too.
      this.resolveGrd();
    }
  }

  // ── GRD lookup ──────────────────────────────────────────────────────────
  //
  // Advisory only. The select stays free, a manual pick always wins, and no answer
  // (nor its absence) can block the submit: POST /meters never calls the lookup.

  /**
   * The catalogue replaces the static list once it loads. Any failure, or the empty
   * list crm-backend answers when dso-lookup is off, keeps the static list.
   */
  private loadGrdCatalogue(): void {
    this.dsoService
      .getOperators()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (Array.isArray(response?.data) && response.data.length > 0) {
            this.grdCatalogue.set(response.data);
          }
        },
        error: () => undefined,
      });
  }

  /** Wire to the GRD select's `(onChange)`: only a user's pick fires it. */
  onGrdChange(): void {
    this.grdSource.set('manual');
    this.grdDataVersion = null;
  }

  /**
   * Ask which GRD serves the address of step 1.
   *
   * A still-valid register pick adds its commune code and locality name; the typed
   * postcode and city always go, so a hand-typed address is looked up as well. The
   * EAN adds an informative prefix check. The same address twice in a row (back,
   * then next again) keeps the answer, and any choice made in it.
   */
  resolveGrd(): void {
    const fields = readAddressFields(this.addressSource());
    const ean = (this.metersForm.get('EAN')?.value as string | null)?.trim() ?? '';
    const query: DsoResolveQuery = {
      ...this.addressPick.dsoHintFor(fields),
      postcode: fields.postcode.trim() || undefined,
      city: fields.city.trim() || undefined,
      ean: ean || undefined,
    };
    const state = this.grdLookup();
    const answered =
      state.kind === 'loading' || (state.kind === 'done' && state.resolution.available);
    if (answered && JSON.stringify(query) === JSON.stringify(this.grdBaseQuery)) {
      return;
    }
    this.grdBaseQuery = query;
    this.grdCommuneChoice.set(null);
    this.grdSectionChoice.set(null);
    this.runGrdLookup(query);
  }

  /** Wire to the commune radios of a `choose_commune` answer. */
  chooseGrdCommune(ins: string): void {
    const choice = this.grdCommuneChoice();
    if (!choice?.communes.some((commune) => commune.ins === ins)) {
      return;
    }
    this.grdCommuneChoice.set({ ...choice, selected: ins });
    this.grdSectionChoice.set(null);
    this.runGrdLookup(this.narrowedGrdQuery({ ins }));
  }

  /** Wire to the section radios of a `choose_section` answer. */
  chooseGrdSection(sectionKey: string): void {
    const choice = this.grdSectionChoice();
    const section = choice?.sections.find((candidate) => candidate.section_key === sectionKey);
    if (!choice || !section) {
      return;
    }
    this.grdSectionChoice.set({ ...choice, selected: sectionKey });
    // A section listed for the commune as a whole may not cover the typed postcode,
    // and the lookup by postcode would then find nothing.
    const typed = this.grdBaseQuery.postcode;
    const postcode = typed && section.postcodes.includes(typed) ? typed : section.postcodes[0];
    this.runGrdLookup(
      this.narrowedGrdQuery({
        ...(choice.ins ? { ins: choice.ins } : {}),
        section: sectionKey,
        postcode,
      }),
    );
  }

  /**
   * The step-1 query narrowed by a choice. Without the register hints: crm-backend
   * resolves a `nis_code` by address and would ignore `ins` and `section`.
   */
  private narrowedGrdQuery(narrow: DsoResolveQuery): DsoResolveQuery {
    const { nis_code: _nisCode, post_name: _postName, ...typed } = this.grdBaseQuery;
    return { ...typed, ...narrow };
  }

  private runGrdLookup(query: DsoResolveQuery): void {
    // A newer question supersedes an unanswered one, whose late answer is dropped.
    this.grdLookupSubscription?.unsubscribe();
    this.grdLookup.set({ kind: 'loading' });
    this.grdLookupSubscription = this.dsoService
      .resolve(query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => this.applyGrdResolution(response?.data, query),
        // A gateway timeout or a route not deployed yet: the select stays as it is.
        error: () => this.applyGrdResolution(undefined, query),
      });
  }

  private applyGrdResolution(
    data: DsoResolutionDTO | string | undefined,
    query: DsoResolveQuery,
  ): void {
    const resolution = data && typeof data === 'object' ? data : GRD_LOOKUP_UNAVAILABLE;
    this.grdLookup.set({ kind: 'done', resolution });

    if (resolution.status === 'choose_commune' && resolution.communes?.length) {
      this.grdCommuneChoice.set({ communes: resolution.communes, selected: null });
      this.grdSectionChoice.set(null);
    }
    const operator = this.grdOperatorOf(resolution);
    if (resolution.status === 'choose_section' && !operator && resolution.sections?.length) {
      const commune = resolution.communes?.[0];
      this.grdSectionChoice.set({
        ins: commune?.ins ?? query.ins ?? paddedNis(query.nis_code),
        region: commune?.region ?? null,
        sections: resolution.sections,
        selected: null,
      });
    }
    if (operator) {
      this.prefillGrd(operator, resolution.result?.data_version ?? resolution.data_version);
    }
  }

  /**
   * The ELECTRICITY OPERATOR the answer gives for the meter: the one that runs the
   * network, never the designated GRD of a note and never gas. A `choose_section`
   * whose sections all share one operator needs no choice (Baarle-Hertog).
   */
  private grdOperatorOf(resolution: DsoResolutionDTO): string | null {
    if (resolution.status === 'ok') {
      return resolution.result?.elec.operator || null;
    }
    if (resolution.status === 'choose_section' && resolution.sections?.length) {
      const operators = new Set(resolution.sections.map((section) => section.elec_operator));
      const [only] = [...operators];
      return operators.size === 1 && only ? only : null;
    }
    return null;
  }

  private prefillGrd(operator: string, dataVersion: string | undefined): void {
    if (this.grdSource() === 'manual' || operator === ELIA_OPTION_ID) {
      return;
    }
    if (!this.grdAvailable().some((option) => option.id === operator)) {
      return;
    }
    this.metersForm.get('grd')?.setValue(operator);
    this.grdSource.set('auto');
    this.grdDataVersion = dataVersion ?? null;
    this.grdPrefilled.set(operator);
  }

  /** The operator the lookup put in the select, for the "prefilled" line. */
  private readonly grdPrefilled = signal<string | null>(null);

  /** The answer on screen, once there is one. */
  private readonly grdResolution = computed(() => {
    const state = this.grdLookup();
    return state.kind === 'done' ? state.resolution : null;
  });

  readonly grdLookupLoading = computed(() => this.grdLookup().kind === 'loading');

  /** `not_found` or `unavailable`: the select is left as it was. */
  readonly grdLookupStatus = computed(() => this.grdResolution()?.status ?? null);

  /** The prefilled operator's name while the user keeps it. */
  readonly grdPrefilledName = computed(() => {
    const prefilled = this.grdPrefilled();
    if (this.grdSource() !== 'auto' || !prefilled) {
      return null;
    }
    return this.grdAvailable().find((option) => option.id === prefilled)?.name ?? null;
  });

  readonly grdChoices = computed(() => {
    this.translationChanged();
    const lang = this.currentLang();
    const communes = this.grdCommuneChoice();
    const sections = this.grdSectionChoice();
    return {
      communes: communes
        ? {
            selected: communes.selected,
            options: communes.communes.map(
              (commune): GrdChoiceOption => ({
                value: commune.ins,
                label: placeName(commune.names, lang, commune.region),
              }),
            ),
          }
        : null,
      sections: sections
        ? {
            selected: sections.selected,
            options: sections.sections.map(
              (section): GrdChoiceOption => ({
                value: section.section_key,
                label: placeName(section.names, lang, sections.region),
              }),
            ),
          }
        : null,
    };
  });

  /** The data's own note on this commune or section, in the reader's language (fr fallback). */
  readonly grdNote = computed(() => {
    this.translationChanged();
    const note = this.grdResolution()?.result?.note;
    if (!note) {
      return null;
    }
    const lang = this.currentLang();
    const own = lang === 'nl' || lang === 'de' || lang === 'en' ? note[lang] : '';
    return own || note.fr || null;
  });

  readonly grdToConfirm = computed(
    () => this.grdResolution()?.result?.flags.includes('to_confirm') ?? false,
  );

  /** Translated; a code this build has no text for (a newer backend) is left out. */
  readonly grdWarnings = computed(() => {
    this.translationChanged();
    return (this.grdResolution()?.warnings ?? [])
      .map((warning) => this.grdWarningText(warning))
      .filter((text): text is string => text !== null);
  });

  /** The data version behind the answer, for the attribution line. */
  readonly grdDataVersionShown = computed(() => {
    const resolution = this.grdResolution();
    return resolution?.available ? (resolution.data_version ?? null) : null;
  });

  private grdWarningText(warning: DsoWarningDTO): string | null {
    const regulator = (code: string | undefined): string => {
      if (!code) {
        return '';
      }
      const key = 'REGULATORS.' + code;
      const label = this.translate.instant(key) as string;
      return label === key ? code : label;
    };
    const key = 'METER.GRD_WARNING.' + warning.code;
    const text = this.translate.instant(key, {
      ...warning.params,
      address_regulator: regulator(warning.params['address_regulator']),
      community_regulator: regulator(warning.params['community_regulator']),
    }) as string;
    return text === key ? null : text;
  }

  private currentLang(): string {
    return this.translate.getCurrentLang() || 'fr';
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
      // "Aucun" has no backend value: sending 5 / 8 answered 422.
      injection_status: injectionStatusForApi(formValue.injectionStatus.id),
      production_chain: productionChainForApi(formValue.productionChain.id),
      total_generating_capacity: formValue.totalGeneratingCapacity,
      grd: formValue.grd,
      ...this.grdProvenance(),
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
      // Trimmed because `eanValidator` tests `value.trim()`: without this the
      // form blesses a pasted "  541448…  " and then sends the padded string,
      // which becomes the meter's primary key and matches no RESA EAN column
      // ever again. crm-backend normalises too; both ends, deliberately.
      EAN: formValue.EAN.trim(),
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
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }

  /**
   * `auto` only for a value the lookup filled in and the user kept, with the data
   * version it came from. Anything else in the select was chosen by a person.
   */
  private grdProvenance(): Pick<CreateMeterDataDTO, 'grd_source' | 'grd_data_version'> {
    if (this.grdSource() !== 'auto') {
      return { grd_source: 'manual' };
    }
    return {
      grd_source: 'auto',
      ...(this.grdDataVersion ? { grd_data_version: this.grdDataVersion } : {}),
    };
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

function paddedNis(nisCode: number | undefined): string | null {
  return nisCode === undefined ? null : String(nisCode).padStart(5, '0');
}

/**
 * A commune or section name in the reader's language. English, and a language the
 * register has no name in, read the region's own: Dutch in Flanders, French elsewhere.
 */
function placeName(names: DsoNames, lang: string, region: DsoRegion | null): string {
  const own = lang === 'fr' || lang === 'nl' || lang === 'de' ? names[lang] : '';
  return own || (region === 'VLA' ? names.nl : names.fr) || names.fr || names.nl;
}
