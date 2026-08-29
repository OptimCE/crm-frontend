import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  FormRecord,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Chip } from 'primeng/chip';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { InputText } from 'primeng/inputtext';
import { DatePicker } from 'primeng/datepicker';
import { RadioButton } from 'primeng/radiobutton';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';
import { Toast } from 'primeng/toast';
import { Tooltip } from 'primeng/tooltip';
import { debounceTime, distinctUntilChanged, interval, map, Observable, switchMap } from 'rxjs';

import { ApiResponse, Pagination } from '../../../../../../core/dtos/api.response';
import { VALIDATION_TYPE } from '../../../../../../core/dtos/notification';
import { RealtimeService } from '../../../../../../core/services/realtime/realtime.service';
import { REALTIME_TOPICS } from '../../../../../../core/services/realtime/realtime.types';
import {
  AlgorithmInputValue,
  AlgorithmMetadata,
  AllocationKeyDetailDTO,
  AllocationKeyPartialDTO,
  AllocationKeyQuery,
  CreateGenerationPayload,
  CreateGenerationResponse,
  GenerationPartialDTO,
  GenerationQuery,
  GenerationStatus,
  JsonSchemaObject,
  JsonSchemaProperty,
} from '../../../../../../shared/dtos/allocation_generation.dtos';
import { InputSourceChoice } from '../../../../../../shared/dtos/crm_data_source.dtos';
import { SharingOperationPartialDTO } from '../../../../../../shared/dtos/sharing_operation.dtos';
import { AllocationGenerationService } from '../../../../../../shared/services/allocation_generation.service';
import { SharingOperationService } from '../../../../../../shared/services/sharing_operation.service';
import {
  CrmDataPreview,
  CrmPreviewView,
} from '../../../../../../shared/components/crm-data-preview/crm-data-preview';
import { toLocalDateString } from '../../../../../../shared/utils/date.utils';
import { ErrorHandlerComponent } from '../../../../../../shared/components/error.handler/error.handler.component';
import { FormErrorSummaryComponent } from '../../../../../../shared/components/summary-error.handler/summary-error.handler.component';
import { ErrorMessageHandler } from '../../../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../../../shared/services-ui/snackbar.notifcation.service';
import { ErrorAdded, ErrorSummaryAdded } from '../../../../../../shared/types/error.types';
import { HeaderPage } from '../../../../../../layout/header-page/header-page';
import { GenerationRow, KeyExpandState } from '../generation-row/generation-row';
import { StartPanel } from '../start-panel/start-panel';

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

// Give the manager time to finish picking a date before we ask the backend what
// is in it. Long enough that clicking through a datepicker fires one request,
// short enough that the answer feels immediate.
const PREVIEW_DEBOUNCE_MS = 350;

/** Operations are few per community; one page covers every realistic case. */
const OPERATION_PAGE_SIZE = 200;

interface SharingOperationOption {
  label: string;
  value: number;
}

/** What the CRM source needs before a preview can be requested. */
interface CrmSelection {
  idSharingOperation: number;
  periodStart: string;
  periodEnd: string;
}

interface AlgorithmOption {
  label: string;
  value: string;
  meta: AlgorithmMetadata;
}

// Until now this hub had NO poller at all: after starting a generation the user
// had to hit refresh by hand, indefinitely. Realtime is the fast path, and these
// mirror the simulation hub so that when realtime is unavailable the behaviour is
// the same as its sibling rather than the old manual-only one.
//
// The poll is SLOWED when the stream is live, never stopped: `live()` proves the
// socket is healthy, not that events are being published, so a gated-off poller
// would never converge if one service were missing REALTIME_REDIS_URL.
const POLL_INTERVAL_MS = 4000;
const SAFETY_POLL_INTERVAL_MS = 20_000;

@Component({
  selector: 'app-allocation-generation-hub',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    TranslatePipe,
    Toast,
    ConfirmDialog,
    Button,
    Card,
    Chip,
    DatePicker,
    InputText,
    RadioButton,
    Select,
    Skeleton,
    Tag,
    Tooltip,
    HeaderPage,
    GenerationRow,
    StartPanel,
    ErrorHandlerComponent,
    FormErrorSummaryComponent,
    CrmDataPreview,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './allocation-generation-hub.html',
  styleUrl: './allocation-generation-hub.css',
})
export class AllocationGenerationHub implements OnInit {
  private readonly service = inject(AllocationGenerationService);
  private readonly sharingOperations = inject(SharingOperationService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);

  // ----- algorithms ------------------------------------------------------
  readonly algorithms = signal<AlgorithmMetadata[]>([]);
  readonly algorithmsLoading = signal<boolean>(true);
  readonly algorithmsError = signal<boolean>(false);
  readonly selectedAlgorithm = signal<AlgorithmMetadata | undefined>(undefined);

  readonly algorithmOptions = computed<AlgorithmOption[]>(() =>
    this.algorithms().map((a) => ({ label: a.description || a.name, value: a.name, meta: a })),
  );

  // ----- start form ------------------------------------------------------
  readonly startForm = new FormGroup({
    algorithmName: new FormControl<string | null>(null, Validators.required),
    generationName: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(1)],
    }),
    injectionName: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(1)],
    }),
    inputs: new FormRecord<AbstractControl>({}),
    file: new FormControl<File | null>(null, Validators.required),

    // ----- input source ---------------------------------------------------
    // 'file' keeps the historical behaviour and stays the default. Switching to
    // 'crm' moves the required-ness from file/injectionName onto the operation
    // and period, via applySourceValidators() — leaving a hidden control
    // required is the classic way to end up with a submit button that silently
    // does nothing.
    inputSource: new FormControl<InputSourceChoice>('file', { nonNullable: true }),
    idSharingOperation: new FormControl<number | null>(null),
    periodStart: new FormControl<Date | null>(null),
    periodEnd: new FormControl<Date | null>(null),
  });

  /** Mirrors `startForm.controls.file` purely for the dropzone display. */
  readonly file = signal<File | null>(null);
  readonly submitting = signal<boolean>(false);

  // ----- CRM data source -------------------------------------------------
  readonly inputSource = signal<InputSourceChoice>('file');
  readonly operations = signal<SharingOperationPartialDTO[]>([]);
  readonly operationsLoading = signal<boolean>(false);
  readonly crmPreview = signal<CrmPreviewView | null>(null);
  readonly crmPreviewLoading = signal<boolean>(false);
  readonly crmPreviewFailed = signal<boolean>(false);

  readonly operationOptions = computed<SharingOperationOption[]>(() =>
    this.operations().map((o) => ({ label: o.name, value: o.id })),
  );

  readonly usingCrmSource = computed(() => this.inputSource() === 'crm');

  /**
   * The submit gate for the CRM source. A pre-flight that has not run yet, or
   * that found a blocker, must not be launchable — the backend re-checks
   * anyway, but letting the click through would turn an explainable red panel
   * into an opaque toast.
   */
  readonly crmReady = computed(() => this.crmPreview()?.ok === true);

  // Friendly field names for the error summary. The top-level fields use i18n keys;
  // the schema-driven inputs (incl. iterations) are labelled from their schema title.
  readonly summaryLabels = computed<Record<string, string>>(() => {
    const labels: Record<string, string> = {
      algorithmName: 'ALGORITHM_HUB.ALGORITHM_LABEL',
      generationName: 'ALGORITHM_HUB.GENERATION_NAME_LABEL',
      injectionName: 'ALGORITHM_HUB.INJECTION_NAME_LABEL',
      file: 'ALGORITHM_HUB.FILE_LABEL',
      idSharingOperation: 'CRM_DATA_SOURCE.OPERATION_LABEL',
      periodStart: 'CRM_DATA_SOURCE.PERIOD_START_LABEL',
      periodEnd: 'CRM_DATA_SOURCE.PERIOD_END_LABEL',
    };
    const props = this.selectedAlgorithm()?.input_schema.properties ?? {};
    for (const [key, prop] of Object.entries(props)) {
      labels[key] = prop.title || key;
    }
    return labels;
  });

  // Per-field error messages for the file dropzone (size/type/required).
  readonly fileErrors: ErrorAdded = {
    required: () => this.translate.instant('ALGORITHM_HUB.ERRORS.FILE_REQUIRED') as string,
    fileEmpty: () => this.translate.instant('ALGORITHM_HUB.ERRORS.FILE_EMPTY') as string,
    fileTooLarge: () => this.translate.instant('ALGORITHM_HUB.ERRORS.FILE_TOO_LARGE') as string,
    fileType: () => this.translate.instant('ALGORITHM_HUB.ERRORS.FILE_TYPE') as string,
  };

  // Named messages for the summary so each missing field is identifiable.
  readonly summaryErrors: ErrorSummaryAdded = {
    required: (_params, controlName, displayName) =>
      this.translate.instant('FORM_ERROR.FIELD_REQUIRED', {
        controlName: displayName ?? controlName,
      }) as string,
    minlength: (params, controlName, displayName) =>
      this.translate.instant('FORM_ERROR.FIELD_MIN_LENGTH', {
        controlName: displayName ?? controlName,
        requiredLength: params['requiredLength'],
        actualLength: params['actualLength'],
      }) as string,
    min: (params, controlName, displayName) =>
      `${displayName ?? controlName}: ${this.translate.instant('ALGORITHM_HUB.ERRORS.MIN_VALUE', {
        min: params['min'],
      })}`,
    max: (params, controlName, displayName) =>
      `${displayName ?? controlName}: ${this.translate.instant('ALGORITHM_HUB.ERRORS.MAX_VALUE', {
        max: params['max'],
      })}`,
    fileEmpty: () => this.translate.instant('ALGORITHM_HUB.ERRORS.FILE_EMPTY') as string,
    fileTooLarge: () => this.translate.instant('ALGORITHM_HUB.ERRORS.FILE_TOO_LARGE') as string,
    fileType: () => this.translate.instant('ALGORITHM_HUB.ERRORS.FILE_TYPE') as string,
  };

  // ----- generations list ------------------------------------------------
  readonly generations = signal<GenerationPartialDTO[]>([]);
  readonly generationsLoading = signal<boolean>(true);
  readonly generationsPagination = signal<Pagination>(new Pagination(1, 20, 0, 0));
  readonly generationsFilter = signal<GenerationQuery>({
    page: 1,
    page_size: 20,
    sort_id: 'DESC',
  });
  readonly lastRefreshedAt = signal<number | null>(null);

  readonly hasMorePages = computed(() => this.generationsPagination().total_pages > 1);

  // ----- expansion + lazy data ------------------------------------------
  readonly expandedGenerationId = signal<number | null>(null);
  readonly keysByGeneration = signal<ReadonlyMap<number, AllocationKeyPartialDTO[]>>(new Map());
  readonly keysLoadingId = signal<number | null>(null);

  private readonly realtime = inject(RealtimeService);

  /**
   * Status of each generation as of the previous list read, so a PENDING ->
   * terminal transition is observed exactly once.
   *
   * Toasting from the observed DELTA rather than from event arrival makes a
   * double toast impossible (both paths funnel into silentRefresh) and keeps the
   * toast working when realtime is down.
   */
  private lastStatusById = new Map<number, GenerationStatus>();

  readonly hasPending = computed(() =>
    this.generations().some((generation) => generation.status === GenerationStatus.PENDING),
  );

  readonly expandedKeyId = signal<number | null>(null);
  readonly keyDetailById = signal<ReadonlyMap<number, AllocationKeyDetailDTO>>(new Map());
  readonly keyDetailLoadingId = signal<number | null>(null);

  constructor() {
    toObservable(this.realtime.live)
      .pipe(
        switchMap((live) => interval(live ? SAFETY_POLL_INTERVAL_MS : POLL_INTERVAL_MS)),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        if (this.hasPending() && !document.hidden) {
          this.silentRefresh();
        }
      });

    // The fast path. `realtime.reconnected` is included automatically, so a
    // dropped event heals on the next connect. Never trust the payload as data:
    // refetch and let the list be the truth.
    this.realtime
      .on(REALTIME_TOPICS.GENERATION_FINISHED)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (!document.hidden) this.silentRefresh();
      });

    // Re-run the pre-flight whenever the operation or the period changes.
    // distinctUntilChanged before the debounce keeps unrelated edits (the run
    // name, an algorithm parameter) from firing a request at all.
    this.startForm.valueChanges
      .pipe(
        map(() => this.crmSelection()),
        distinctUntilChanged(
          (previous, current) => JSON.stringify(previous) === JSON.stringify(current),
        ),
        debounceTime(PREVIEW_DEBOUNCE_MS),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.requestPreview());
  }

  ngOnInit(): void {
    this.loadAlgorithms();
    this.loadGenerations();
    this.applyDefaultPeriod();
  }

  // ====== CRM data source =================================================

  /**
   * Default to the last complete month.
   *
   * The overwhelmingly common request is "last month", and the DSO feed for the
   * current month is partial by definition, so pre-filling it would put every
   * manager one click away from an amber gap warning.
   */
  private applyDefaultPeriod(): void {
    const now = new Date();
    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthEnd = new Date(firstOfThisMonth.getTime() - 86_400_000);
    const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);
    this.startForm.controls.periodStart.setValue(lastMonthStart, { emitEvent: false });
    this.startForm.controls.periodEnd.setValue(lastMonthEnd, { emitEvent: false });
  }

  onSourceChange(source: InputSourceChoice): void {
    this.inputSource.set(source);
    this.applySourceValidators(source);
    if (source === 'crm') {
      if (!this.operations().length) this.loadOperations();
      this.requestPreview();
    } else {
      this.crmPreview.set(null);
      this.crmPreviewFailed.set(false);
    }
  }

  /**
   * Move required-ness between the two source shapes.
   *
   * Both directions matter: a leftover `required` on the hidden `file` control
   * blocks submit with no visible error, and a leftover one on `periodStart`
   * would do the same after switching back.
   */
  private applySourceValidators(source: InputSourceChoice): void {
    const { file, injectionName, idSharingOperation, periodStart, periodEnd } =
      this.startForm.controls;

    if (source === 'crm') {
      file.clearValidators();
      injectionName.clearValidators();
      idSharingOperation.setValidators(Validators.required);
      periodStart.setValidators(Validators.required);
      periodEnd.setValidators(Validators.required);
    } else {
      file.setValidators(Validators.required);
      injectionName.setValidators([Validators.required, Validators.minLength(1)]);
      idSharingOperation.clearValidators();
      periodStart.clearValidators();
      periodEnd.clearValidators();
    }

    for (const control of [file, injectionName, idSharingOperation, periodStart, periodEnd]) {
      control.updateValueAndValidity({ emitEvent: false });
    }
  }

  private loadOperations(): void {
    this.operationsLoading.set(true);
    this.sharingOperations
      .getSharingOperationList({ page: 1, limit: OPERATION_PAGE_SIZE, sort_name: 'ASC' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const list = Array.isArray(response.data) ? response.data : [];
          this.operations.set(list);
          this.operationsLoading.set(false);
          // One operation is the common case; choosing it for the manager
          // removes a decision that has only one possible answer.
          if (list.length === 1 && !this.startForm.controls.idSharingOperation.value) {
            this.startForm.controls.idSharingOperation.setValue(list[0].id);
          }
        },
        error: (error: unknown) => {
          this.operationsLoading.set(false);
          this.handleApiError(error);
        },
      });
  }

  /** The selection, or null while it is still incomplete. */
  private crmSelection(): CrmSelection | null {
    if (this.startForm.controls.inputSource.value !== 'crm') return null;
    const id = this.startForm.controls.idSharingOperation.value;
    const start = this.startForm.controls.periodStart.value;
    const end = this.startForm.controls.periodEnd.value;
    if (!id || !start || !end) return null;
    // toLocalDateString, not toISOString: the picker hands back local midnight
    // and UTC conversion would shift the day for anyone east of Greenwich.
    return {
      idSharingOperation: id,
      periodStart: toLocalDateString(start),
      periodEnd: toLocalDateString(end),
    };
  }

  private requestPreview(): void {
    const selection = this.crmSelection();
    if (!selection) {
      this.crmPreview.set(null);
      this.crmPreviewFailed.set(false);
      return;
    }
    if (selection.periodStart > selection.periodEnd) {
      // Answered locally so the manager is not made to wait on a round trip for
      // something the form can see.
      this.crmPreview.set(null);
      this.crmPreviewFailed.set(false);
      return;
    }

    this.crmPreviewLoading.set(true);
    this.crmPreviewFailed.set(false);
    this.service
      .previewCrmData({
        id_sharing_operation: selection.idSharingOperation,
        period_start: selection.periodStart,
        period_end: selection.periodEnd,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.crmPreviewLoading.set(false);
          const data = response.data;
          if (!data || typeof data === 'string') {
            this.crmPreviewFailed.set(true);
            this.crmPreview.set(null);
            return;
          }
          this.crmPreview.set({
            ok: data.can_generate,
            meterCount: data.meter_count,
            readingCount: data.reading_count,
            firstTimestamp: data.first_timestamp,
            lastTimestamp: data.last_timestamp,
            totalConsumptionKwh: data.total_consumption_kwh,
            totalInjectionKwh: data.total_injection_kwh,
            incompleteMeters: data.incomplete_meters,
            blockers: data.blockers,
          });
        },
        error: () => {
          // Deliberately not routed through handleApiError: a failed pre-flight
          // is shown inside the panel, not as a toast the manager must dismiss.
          this.crmPreviewLoading.set(false);
          this.crmPreviewFailed.set(true);
          this.crmPreview.set(null);
        },
      });
  }

  // ====== algorithms =====================================================

  private loadAlgorithms(): void {
    this.algorithmsLoading.set(true);
    this.algorithmsError.set(false);
    this.service
      .listAlgorithms()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.algorithms.set(response.data ?? []);
          this.algorithmsLoading.set(false);
        },
        error: (error: unknown) => {
          this.algorithmsLoading.set(false);
          this.algorithmsError.set(true);
          this.handleApiError(error);
        },
      });
  }

  onAlgorithmSelected(name: string | null): void {
    if (!name) {
      this.rebuildInputsForm(null);
      this.selectedAlgorithm.set(undefined);
      return;
    }
    this.service
      .getAlgorithm(name)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const meta =
            response.data && typeof response.data !== 'string' ? response.data : undefined;
          this.rebuildInputsForm(meta?.input_schema ?? null);
          this.selectedAlgorithm.set(meta);
        },
        error: (error: unknown) => this.handleApiError(error),
      });
  }

  private rebuildInputsForm(schema: JsonSchemaObject | null): void {
    const inputs = this.startForm.controls.inputs;
    for (const key of Object.keys(inputs.controls)) {
      inputs.removeControl(key, { emitEvent: false });
    }
    if (!schema) {
      inputs.updateValueAndValidity({ emitEvent: false });
      return;
    }
    const required = new Set(schema.required ?? []);
    for (const [key, prop] of Object.entries(schema.properties)) {
      const validators: ValidatorFn[] = [];
      if (required.has(key)) validators.push(Validators.required);
      if (prop.minimum !== undefined) validators.push(Validators.min(prop.minimum));
      if (prop.maximum !== undefined) validators.push(Validators.max(prop.maximum));
      const initial = this.initialValueFor(prop);
      inputs.addControl(key, new FormControl<AlgorithmInputValue>(initial, { validators }), {
        emitEvent: false,
      });
    }
    inputs.updateValueAndValidity({ emitEvent: false });
  }

  private initialValueFor(prop: JsonSchemaProperty): AlgorithmInputValue {
    if (prop.default !== undefined && prop.default !== null) return prop.default;
    if (prop.type === 'boolean') return false;
    return null;
  }

  // ====== file picker ====================================================

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.applyFile(file);
    // Allow re-picking the same file later by clearing the input value.
    input.value = '';
  }

  onFileDropped(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0] ?? null;
    this.applyFile(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  private applyFile(file: File | null): void {
    const control = this.startForm.controls.file;
    if (!file) {
      this.file.set(null);
      control.setValue(null);
      return;
    }
    if (file.size === 0) {
      this.rejectFile('fileEmpty');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      this.rejectFile('fileTooLarge');
      return;
    }
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.csv') && !lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
      this.rejectFile('fileType');
      return;
    }
    this.file.set(file);
    control.setValue(file);
  }

  /** Clears the file value and surfaces a custom validation error on the control. */
  private rejectFile(errorKey: 'fileEmpty' | 'fileTooLarge' | 'fileType'): void {
    const control = this.startForm.controls.file;
    this.file.set(null);
    control.setValue(null);
    control.setErrors({ [errorKey]: true });
    control.markAsTouched();
  }

  clearFile(): void {
    this.file.set(null);
    this.startForm.controls.file.setValue(null);
  }

  formatFileSize(size: number): string {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }

  // ====== submit =========================================================

  submitGeneration(): void {
    this.startForm.markAllAsTouched();
    if (this.startForm.invalid) return;
    const raw = this.startForm.getRawValue();
    const inputs = this.collectInputs(raw.inputs as Record<string, AlgorithmInputValue>);

    if (raw.inputSource === 'crm') {
      const selection = this.crmSelection();
      // Belt and braces: the button is already disabled while the pre-flight is
      // not green, and the backend re-runs the same checks server-side.
      if (!selection || !this.crmReady()) return;
      this.startRun(
        this.service.startGenerationFromCrm({
          name: raw.generationName,
          algorithmName: raw.algorithmName as string,
          inputs,
          idSharingOperation: selection.idSharingOperation,
          periodStart: selection.periodStart,
          periodEnd: selection.periodEnd,
        }),
      );
      return;
    }

    const payload: CreateGenerationPayload = {
      file: raw.file as File,
      name: raw.generationName,
      injectionName: raw.injectionName,
      algorithmName: raw.algorithmName as string,
      inputs,
    };
    this.startRun(this.service.startGeneration(payload));
  }

  /** Shared tail of both submit paths: toast, silent reset, refresh. */
  private startRun(request: Observable<ApiResponse<CreateGenerationResponse>>): void {
    this.submitting.set(true);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.submitting.set(false);
        this.snackbar.openSnackBar(
          this.translate.instant('ALGORITHM_HUB.SUCCESS.GENERATION_STARTED') as string,
          VALIDATION_TYPE,
        );
        // Silent reset: avoid re-triggering the error components on the cleared fields.
        this.startForm.controls.generationName.reset('', { emitEvent: false });
        this.startForm.controls.injectionName.reset('', { emitEvent: false });
        this.startForm.controls.file.reset(null, { emitEvent: false });
        this.file.set(null);
        // The period and operation are deliberately kept: a manager who just
        // ran February is far more likely to run February with another
        // algorithm than to start from scratch.
        this.refreshGenerations();
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.handleApiError(error);
      },
    });
  }

  private collectInputs(
    raw: Record<string, AlgorithmInputValue>,
  ): Record<string, AlgorithmInputValue> {
    const required = new Set(this.selectedAlgorithm()?.input_schema.required ?? []);
    const result: Record<string, AlgorithmInputValue> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (value === null || value === '') {
        if (required.has(key)) result[key] = value;
        continue;
      }
      result[key] = value;
    }
    return result;
  }

  // ====== generations list ===============================================

  refreshGenerations(): void {
    this.service.invalidate();
    this.loadGenerations(this.generationsFilter().page);
  }

  loadGenerations(page = 1): void {
    const filter: GenerationQuery = { ...this.generationsFilter(), page };
    this.generationsFilter.set(filter);
    this.generationsLoading.set(true);
    this.service
      .listGenerations(filter)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const data = Array.isArray(response.data) ? response.data : [];
          this.generations.set(data);
          this.generationsPagination.set(response.pagination);
          this.lastRefreshedAt.set(Date.now());
          this.generationsLoading.set(false);
          // Seed only: an explicit load must never toast about work that
          // finished before the user got here.
          this.snapshotStatuses(data);
        },
        error: (error: unknown) => {
          this.generationsLoading.set(false);
          this.handleApiError(error);
        },
      });
  }

  /** Background refresh: no spinner, and toasts any terminal transition once. */
  private silentRefresh(): void {
    this.service.invalidate();
    this.service
      .listGenerations(this.generationsFilter())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const data = Array.isArray(response.data) ? response.data : [];
          this.toastTerminalTransitions(data);
          this.generations.set(data);
          this.generationsPagination.set(response.pagination);
          this.lastRefreshedAt.set(Date.now());
        },
        error: () => {
          /* silent — the next manual refresh surfaces persistent errors */
        },
      });
  }

  /**
   * Toast once per generation that just left PENDING, then re-snapshot.
   *
   * Text comes from the i18n bundle keyed on the observed status, never from a
   * realtime payload: anything holding the Redis password can publish, so
   * rendering payload strings would make a compromised service a text-injection
   * channel into every browser.
   */
  private toastTerminalTransitions(data: readonly GenerationPartialDTO[]): void {
    for (const generation of data) {
      const before = this.lastStatusById.get(generation.id);
      if (before !== GenerationStatus.PENDING || generation.status === GenerationStatus.PENDING) {
        continue;
      }
      this.snackbar.openSnackBar(
        this.translate.instant(
          generation.status === GenerationStatus.SUCCESS
            ? 'ALGORITHM_HUB.TOAST_FINISHED'
            : 'ALGORITHM_HUB.TOAST_FAILED',
        ) as string,
        VALIDATION_TYPE,
      );
    }
    this.snapshotStatuses(data);
  }

  private snapshotStatuses(data: readonly GenerationPartialDTO[]): void {
    this.lastStatusById = new Map(data.map((generation) => [generation.id, generation.status]));
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.generationsPagination().total_pages) return;
    this.loadGenerations(page);
  }

  // ====== expansion ======================================================

  toggleGeneration(idGeneration: number): void {
    const current = this.expandedGenerationId();
    if (current === idGeneration) {
      this.expandedGenerationId.set(null);
      return;
    }
    this.expandedGenerationId.set(idGeneration);
    this.expandedKeyId.set(null);
    if (!this.keysByGeneration().has(idGeneration)) {
      this.loadKeysForGeneration(idGeneration);
    }
  }

  loadKeysForGeneration(idGeneration: number, page = 1): void {
    const query: AllocationKeyQuery = { page, page_size: 50, sort_id: 'ASC' };
    this.keysLoadingId.set(idGeneration);
    this.service
      .getGenerationKeys(idGeneration, query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const keys = Array.isArray(response.data) ? response.data : [];
          this.keysByGeneration.update((map) => {
            const next = new Map(map);
            next.set(idGeneration, keys);
            return next;
          });
          this.keysLoadingId.set(null);
        },
        error: (error: unknown) => {
          this.keysLoadingId.set(null);
          this.handleApiError(error);
        },
      });
  }

  toggleKey(idKey: number): void {
    const current = this.expandedKeyId();
    if (current === idKey) {
      this.expandedKeyId.set(null);
      return;
    }
    this.expandedKeyId.set(idKey);
    if (!this.keyDetailById().has(idKey)) {
      this.loadKeyDetail(idKey);
    }
  }

  loadKeyDetail(idKey: number): void {
    this.keyDetailLoadingId.set(idKey);
    this.service
      .getKey(idKey)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const detail =
            response.data && typeof response.data !== 'string' ? response.data : undefined;
          if (detail) {
            this.keyDetailById.update((map) => {
              const next = new Map(map);
              next.set(idKey, detail);
              return next;
            });
          }
          this.keyDetailLoadingId.set(null);
        },
        error: (error: unknown) => {
          this.keyDetailLoadingId.set(null);
          this.handleApiError(error);
        },
      });
  }

  // ====== save / delete ==================================================

  saveKey(idKey: number): void {
    this.confirmation.confirm({
      header: this.translate.instant('ALGORITHM_HUB.CONFIRM.SAVE_HEADER') as string,
      message: this.translate.instant('ALGORITHM_HUB.CONFIRM.SAVE_MESSAGE') as string,
      acceptLabel: this.translate.instant('COMMON.ACTIONS.VALIDATE') as string,
      rejectLabel: this.translate.instant('COMMON.ACTIONS.CANCEL') as string,
      acceptButtonProps: { severity: 'primary' },
      accept: () => {
        this.service
          .saveKey({ id_key: idKey })
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.snackbar.openSnackBar(
                this.translate.instant('ALGORITHM_HUB.SUCCESS.KEY_SAVED') as string,
                VALIDATION_TYPE,
              );
            },
            error: (error: unknown) => this.handleApiError(error),
          });
      },
    });
  }

  deleteKey(idKey: number): void {
    this.confirmation.confirm({
      header: this.translate.instant('ALGORITHM_HUB.CONFIRM.DELETE_KEY_HEADER') as string,
      message: this.translate.instant('ALGORITHM_HUB.CONFIRM.DELETE_KEY_MESSAGE') as string,
      acceptLabel: this.translate.instant('COMMON.ACTIONS.VALIDATE') as string,
      rejectLabel: this.translate.instant('COMMON.ACTIONS.CANCEL') as string,
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this.service
          .deleteKey(idKey)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.snackbar.openSnackBar(
                this.translate.instant('ALGORITHM_HUB.SUCCESS.KEY_DELETED') as string,
                VALIDATION_TYPE,
              );
              this.removeKeyFromMaps(idKey);
            },
            error: (error: unknown) => this.handleApiError(error),
          });
      },
    });
  }

  deleteGeneration(idGeneration: number): void {
    this.confirmation.confirm({
      header: this.translate.instant('ALGORITHM_HUB.CONFIRM.DELETE_GEN_HEADER') as string,
      message: this.translate.instant('ALGORITHM_HUB.CONFIRM.DELETE_GEN_MESSAGE') as string,
      acceptLabel: this.translate.instant('COMMON.ACTIONS.VALIDATE') as string,
      rejectLabel: this.translate.instant('COMMON.ACTIONS.CANCEL') as string,
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this.service
          .deleteGeneration(idGeneration)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.snackbar.openSnackBar(
                this.translate.instant('ALGORITHM_HUB.SUCCESS.GEN_DELETED') as string,
                VALIDATION_TYPE,
              );
              this.removeGenerationFromMaps(idGeneration);
            },
            error: (error: unknown) => this.handleApiError(error),
          });
      },
    });
  }

  private removeKeyFromMaps(idKey: number): void {
    this.keysByGeneration.update((map) => {
      const next = new Map<number, AllocationKeyPartialDTO[]>();
      for (const [genId, keys] of map.entries()) {
        next.set(
          genId,
          keys.filter((k) => k.id !== idKey),
        );
      }
      return next;
    });
    this.keyDetailById.update((map) => {
      if (!map.has(idKey)) return map;
      const next = new Map(map);
      next.delete(idKey);
      return next;
    });
    if (this.expandedKeyId() === idKey) this.expandedKeyId.set(null);
  }

  private removeGenerationFromMaps(idGeneration: number): void {
    this.generations.update((list) => list.filter((g) => g.id !== idGeneration));
    this.keysByGeneration.update((map) => {
      const orphans = map.get(idGeneration);
      if (!orphans) return map;
      const next = new Map(map);
      next.delete(idGeneration);
      // also drop any key-detail entries that belonged to this generation
      this.keyDetailById.update((detailMap) => {
        const detailNext = new Map(detailMap);
        for (const k of orphans) detailNext.delete(k.id);
        return detailNext;
      });
      return next;
    });
    if (this.expandedGenerationId() === idGeneration) this.expandedGenerationId.set(null);
  }

  // ====== helpers for template ===========================================

  isGenerationExpanded(id: number): boolean {
    return this.expandedGenerationId() === id;
  }

  keysFor(id: number): AllocationKeyPartialDTO[] | undefined {
    return this.keysByGeneration().get(id);
  }

  isKeysLoadingFor(id: number): boolean {
    return this.keysLoadingId() === id;
  }

  keyExpandStateFor(_genId: number): KeyExpandState {
    return {
      expandedKeyId: this.expandedKeyId(),
      detailById: this.keyDetailById(),
      loadingId: this.keyDetailLoadingId(),
    };
  }

  protected readonly GenerationStatus = GenerationStatus;

  private handleApiError(error: unknown): void {
    const errorData = error instanceof ApiResponse ? (error.data as string) : null;
    this.errorHandler.handleError(errorData);
  }
}
