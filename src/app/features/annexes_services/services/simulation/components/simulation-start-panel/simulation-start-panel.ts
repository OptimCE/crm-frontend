import { Component, computed, DestroyRef, inject, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';

import { ApiResponse } from '../../../../../../core/dtos/api.response';
import { VALIDATION_TYPE } from '../../../../../../core/dtos/notification';
import { ErrorHandlerComponent } from '../../../../../../shared/components/error.handler/error.handler.component';
import { FormErrorSummaryComponent } from '../../../../../../shared/components/summary-error.handler/summary-error.handler.component';
import { KeyPartialDTO } from '../../../../../../shared/dtos/key.dtos';
import { CreateSimulationPayload } from '../../../../../../shared/dtos/simulation.dtos';
import { KeyService } from '../../../../../../shared/services/key.service';
import { SimulationService } from '../../../../../../shared/services/simulation.service';
import { ErrorMessageHandler } from '../../../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../../../shared/services-ui/snackbar.notifcation.service';
import { ErrorAdded, ErrorSummaryAdded } from '../../../../../../shared/types/error.types';

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
// Allocation keys rarely number in the hundreds per community; load a generous
// page and rely on the picker's filter rather than paging the dropdown.
const KEYS_PAGE_SIZE = 200;

interface KeyOption {
  label: string;
  value: number;
  description: string;
}

@Component({
  selector: 'app-simulation-start-panel',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    Button,
    InputText,
    Select,
    ErrorHandlerComponent,
    FormErrorSummaryComponent,
  ],
  templateUrl: './simulation-start-panel.html',
  styleUrl: './simulation-start-panel.css',
})
export class SimulationStartPanel implements OnInit {
  private readonly simulationService = inject(SimulationService);
  private readonly keyService = inject(KeyService);
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
  });

  /** Mirrors `form.controls.file` purely for the dropzone display. */
  readonly file = signal<File | null>(null);
  readonly submitting = signal<boolean>(false);

  // Friendly field names for the error summary (i18n keys are translated by the component).
  readonly summaryLabels: Record<string, string> = {
    idKey: 'SIMULATION_HUB.KEY_LABEL',
    simulationName: 'SIMULATION_HUB.SIMULATION_NAME_LABEL',
    injectionName: 'SIMULATION_HUB.INJECTION_NAME_LABEL',
    file: 'SIMULATION_HUB.FILE_LABEL',
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
    const payload: CreateSimulationPayload = {
      file: raw.file as File,
      name: raw.simulationName,
      idKey: raw.idKey as number,
      injectionName: raw.injectionName,
    };

    this.submitting.set(true);
    this.simulationService
      .startSimulation(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.snackbar.openSnackBar(
            this.translate.instant('SIMULATION_HUB.SUCCESS.SIMULATION_STARTED') as string,
            VALIDATION_TYPE,
          );
          // Silent reset: avoid re-triggering the error components on the cleared fields.
          this.form.reset(
            { idKey: null, simulationName: '', injectionName: '', file: null },
            { emitEvent: false },
          );
          this.file.set(null);
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
