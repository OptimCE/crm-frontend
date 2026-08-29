import { Component, computed, DestroyRef, inject, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { DatePicker } from 'primeng/datepicker';
import { RadioButton } from 'primeng/radiobutton';
import { Select } from 'primeng/select';
import { debounceTime, distinctUntilChanged, map, Observable } from 'rxjs';

import { ApiResponse } from '../../../../../../core/dtos/api.response';
import { VALIDATION_TYPE } from '../../../../../../core/dtos/notification';
import { ErrorHandlerComponent } from '../../../../../../shared/components/error.handler/error.handler.component';
import { FormErrorSummaryComponent } from '../../../../../../shared/components/summary-error.handler/summary-error.handler.component';
import { KeyPartialDTO } from '../../../../../../shared/dtos/key.dtos';
import {
  CreateSimulationPayload,
  CreateSimulationResponse,
} from '../../../../../../shared/dtos/simulation.dtos';
import { InputSourceChoice } from '../../../../../../shared/dtos/crm_data_source.dtos';
import { SharingOperationPartialDTO } from '../../../../../../shared/dtos/sharing_operation.dtos';
import { SharingOperationService } from '../../../../../../shared/services/sharing_operation.service';
import {
  CrmDataPreview,
  CrmPreviewView,
} from '../../../../../../shared/components/crm-data-preview/crm-data-preview';
import { toLocalDateString } from '../../../../../../shared/utils/date.utils';
import { KeyService } from '../../../../../../shared/services/key.service';
import { SimulationService } from '../../../../../../shared/services/simulation.service';
import { ErrorMessageHandler } from '../../../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../../../shared/services-ui/snackbar.notifcation.service';
import { ErrorAdded, ErrorSummaryAdded } from '../../../../../../shared/types/error.types';

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
// Allocation keys rarely number in the hundreds per community; load a generous
// page and rely on the picker's filter rather than paging the dropdown.
const KEYS_PAGE_SIZE = 200;

// Give the manager time to finish picking a date before we ask the backend what
// is in it. Long enough that clicking through a datepicker fires one request,
// short enough that the answer feels immediate.
const PREVIEW_DEBOUNCE_MS = 350;

/** Operations are few per community; one page covers every realistic case. */
const OPERATION_PAGE_SIZE = 200;

interface KeyOption {
  label: string;
  value: number;
  description: string;
}

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

@Component({
  selector: 'app-simulation-start-panel',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    Button,
    DatePicker,
    InputText,
    RadioButton,
    Select,
    ErrorHandlerComponent,
    FormErrorSummaryComponent,
    CrmDataPreview,
  ],
  templateUrl: './simulation-start-panel.html',
  styleUrl: './simulation-start-panel.css',
})
export class SimulationStartPanel implements OnInit {
  private readonly simulationService = inject(SimulationService);
  private readonly keyService = inject(KeyService);
  private readonly sharingOperations = inject(SharingOperationService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  /** Emitted after a run is successfully queued, so the hub can refresh. */
  readonly launched = output<void>();

  // ----- allocation keys (picker) ----------------------------------------
  readonly keys = signal<KeyPartialDTO[]>([]);
  readonly keysLoading = signal<boolean>(true);
  readonly keysError = signal<boolean>(false);

  readonly keyOptions = computed<KeyOption[]>(() =>
    this.keys().map((key) => ({ label: key.name, value: key.id, description: key.description })),
  );

  // ----- form ------------------------------------------------------------
  readonly form = new FormGroup({
    idKey: new FormControl<number | null>(null, Validators.required),
    simulationName: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(1)],
    }),
    injectionName: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(1)],
    }),
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

  /** Mirrors `form.controls.file` purely for the dropzone display. */
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
   * The submit gate for the CRM source. Unmatched participants are the common
   * reason this stays false: the key names something that is not a meter EAN,
   * and the panel lists exactly which ones.
   */
  readonly crmReady = computed(() => this.crmPreview()?.ok === true);

  constructor() {
    // Re-run the pre-flight whenever the key, operation or period changes. The
    // key matters here as much as the period: it is what the meters are matched
    // against. distinctUntilChanged before the debounce keeps unrelated edits
    // (the run name) from firing a request at all.
    this.form.valueChanges
      .pipe(
        map(() => {
          const selection = this.crmSelection();
          return selection ? { ...selection, idKey: this.form.controls.idKey.value } : null;
        }),
        distinctUntilChanged(
          (previous, current) => JSON.stringify(previous) === JSON.stringify(current),
        ),
        debounceTime(PREVIEW_DEBOUNCE_MS),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.requestPreview());
  }

  // Friendly field names for the error summary (i18n keys are translated by the component).
  readonly summaryLabels: Record<string, string> = {
    idKey: 'SIMULATION_HUB.KEY_LABEL',
    simulationName: 'SIMULATION_HUB.SIMULATION_NAME_LABEL',
    injectionName: 'SIMULATION_HUB.INJECTION_NAME_LABEL',
    file: 'SIMULATION_HUB.FILE_LABEL',
    idSharingOperation: 'CRM_DATA_SOURCE.OPERATION_LABEL',
    periodStart: 'CRM_DATA_SOURCE.PERIOD_START_LABEL',
    periodEnd: 'CRM_DATA_SOURCE.PERIOD_END_LABEL',
  };

  // Per-field error messages for the file dropzone (size/type/required).
  readonly fileErrors: ErrorAdded = {
    required: () => this.translate.instant('SIMULATION_HUB.ERRORS.FILE_REQUIRED') as string,
    fileEmpty: () => this.translate.instant('SIMULATION_HUB.ERRORS.FILE_EMPTY') as string,
    fileTooLarge: () => this.translate.instant('SIMULATION_HUB.ERRORS.FILE_TOO_LARGE') as string,
    fileType: () => this.translate.instant('SIMULATION_HUB.ERRORS.FILE_TYPE') as string,
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
    fileEmpty: () => this.translate.instant('SIMULATION_HUB.ERRORS.FILE_EMPTY') as string,
    fileTooLarge: () => this.translate.instant('SIMULATION_HUB.ERRORS.FILE_TOO_LARGE') as string,
    fileType: () => this.translate.instant('SIMULATION_HUB.ERRORS.FILE_TYPE') as string,
  };

  ngOnInit(): void {
    this.loadKeys();
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
    this.form.controls.periodStart.setValue(lastMonthStart, { emitEvent: false });
    this.form.controls.periodEnd.setValue(lastMonthEnd, { emitEvent: false });
  }

  onSourceChange(source: InputSourceChoice): void {
    this.inputSource.set(source);
    // The radio also writes this control through `formControlName`, but the signal
    // alone is not enough: `crmSelection()` and `submit()` read the control, so a
    // programmatic call here would leave the visible panel and the submitted
    // branch disagreeing. Keep this handler the single writer of the choice.
    this.form.controls.inputSource.setValue(source, { emitEvent: false });
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
    const { file, injectionName, idSharingOperation, periodStart, periodEnd } = this.form.controls;

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
          if (list.length === 1 && !this.form.controls.idSharingOperation.value) {
            this.form.controls.idSharingOperation.setValue(list[0].id);
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
    if (this.form.controls.inputSource.value !== 'crm') return null;
    const id = this.form.controls.idSharingOperation.value;
    const start = this.form.controls.periodStart.value;
    const end = this.form.controls.periodEnd.value;
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
    const idKey = this.form.controls.idKey.value;
    // The key is part of the question, not just the period: the preview reports
    // whether *this key's* participants match the meters.
    if (!selection || !idKey) {
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
    this.simulationService
      .previewCrmData(idKey, {
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
            ok: data.can_simulate,
            meterCount: data.meter_count,
            readingCount: data.reading_count,
            firstTimestamp: data.first_timestamp,
            lastTimestamp: data.last_timestamp,
            totalConsumptionKwh: data.total_consumption_kwh,
            totalInjectionKwh: data.total_injection_kwh,
            incompleteMeters: data.incomplete_meters,
            blockers: data.blockers,
            matchedParticipants: data.matched_participants,
            unmatchedParticipants: data.unmatched_participants,
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

  private loadKeys(): void {
    this.keysLoading.set(true);
    this.keysError.set(false);
    this.keyService
      .getKeysList({ page: 1, limit: KEYS_PAGE_SIZE, sort_name: 'ASC' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const data = Array.isArray(response.data) ? response.data : [];
          this.keys.set(data);
          this.keysLoading.set(false);
        },
        error: (error: unknown) => {
          this.keysLoading.set(false);
          this.keysError.set(true);
          this.handleApiError(error);
        },
      });
  }

  // ----- file picker -----------------------------------------------------

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.applyFile(file);
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
    const control = this.form.controls.file;
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
    const control = this.form.controls.file;
    this.file.set(null);
    control.setValue(null);
    control.setErrors({ [errorKey]: true });
    control.markAsTouched();
  }

  clearFile(): void {
    this.file.set(null);
    this.form.controls.file.setValue(null);
  }

  formatFileSize(size: number): string {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }

  // ----- submit ----------------------------------------------------------

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const raw = this.form.getRawValue();

    if (raw.inputSource === 'crm') {
      const selection = this.crmSelection();
      // Belt and braces: the button is already disabled while the pre-flight is
      // not green, and the backend re-runs the same checks server-side.
      if (!selection || !this.crmReady()) return;
      this.startRun(
        this.simulationService.startSimulationFromCrm({
          name: raw.simulationName,
          idKey: raw.idKey as number,
          idSharingOperation: selection.idSharingOperation,
          periodStart: selection.periodStart,
          periodEnd: selection.periodEnd,
        }),
      );
      return;
    }

    const payload: CreateSimulationPayload = {
      file: raw.file as File,
      name: raw.simulationName,
      idKey: raw.idKey as number,
      injectionName: raw.injectionName,
    };
    this.startRun(this.simulationService.startSimulation(payload));
  }

  /** Shared tail of both submit paths: toast, silent reset, notify the hub. */
  private startRun(request: Observable<ApiResponse<CreateSimulationResponse>>): void {
    this.submitting.set(true);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.submitting.set(false);
        this.snackbar.openSnackBar(
          this.translate.instant('SIMULATION_HUB.SUCCESS.SIMULATION_STARTED') as string,
          VALIDATION_TYPE,
        );
        // Silent reset: avoid re-triggering the error components on the cleared
        // fields. The source choice, operation and period are deliberately kept
        // — re-running the same period against another key is the common next
        // step, and re-picking all three would be busywork.
        this.form.patchValue(
          { idKey: null, simulationName: '', injectionName: '', file: null },
          { emitEvent: false },
        );
        this.file.set(null);
        this.crmPreview.set(null);
        this.launched.emit();
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.handleApiError(error);
      },
    });
  }

  private handleApiError(error: unknown): void {
    const errorData = error instanceof ApiResponse ? (error.data as string) : null;
    this.errorHandler.handleError(errorData);
  }
}
