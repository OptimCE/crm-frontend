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
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';
import { Toast } from 'primeng/toast';
import { Tooltip } from 'primeng/tooltip';
import { interval, switchMap } from 'rxjs';

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
  GenerationPartialDTO,
  GenerationQuery,
  GenerationStatus,
  JsonSchemaObject,
  JsonSchemaProperty,
} from '../../../../../../shared/dtos/allocation_generation.dtos';
import { AllocationGenerationService } from '../../../../../../shared/services/allocation_generation.service';
import { ErrorHandlerComponent } from '../../../../../../shared/components/error.handler/error.handler.component';
import { FormErrorSummaryComponent } from '../../../../../../shared/components/summary-error.handler/summary-error.handler.component';
import { ErrorMessageHandler } from '../../../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../../../shared/services-ui/snackbar.notifcation.service';
import { ErrorAdded, ErrorSummaryAdded } from '../../../../../../shared/types/error.types';
import { HeaderPage } from '../../../../../../layout/header-page/header-page';
import { GenerationRow, KeyExpandState } from '../generation-row/generation-row';
import { StartPanel } from '../start-panel/start-panel';

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

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
    InputText,
    Select,
    Skeleton,
    Tag,
    Tooltip,
    HeaderPage,
    GenerationRow,
    StartPanel,
    ErrorHandlerComponent,
    FormErrorSummaryComponent,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './allocation-generation-hub.html',
  styleUrl: './allocation-generation-hub.css',
})
export class AllocationGenerationHub implements OnInit {
  private readonly service = inject(AllocationGenerationService);
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
  });

  /** Mirrors `startForm.controls.file` purely for the dropzone display. */
  readonly file = signal<File | null>(null);
  readonly submitting = signal<boolean>(false);

  // Friendly field names for the error summary. The top-level fields use i18n keys;
  // the schema-driven inputs (incl. iterations) are labelled from their schema title.
  readonly summaryLabels = computed<Record<string, string>>(() => {
    const labels: Record<string, string> = {
      algorithmName: 'ALGORITHM_HUB.ALGORITHM_LABEL',
      generationName: 'ALGORITHM_HUB.GENERATION_NAME_LABEL',
      injectionName: 'ALGORITHM_HUB.INJECTION_NAME_LABEL',
      file: 'ALGORITHM_HUB.FILE_LABEL',
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
  }

  ngOnInit(): void {
    this.loadAlgorithms();
    this.loadGenerations();
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

    const payload: CreateGenerationPayload = {
      file: raw.file as File,
      name: raw.generationName,
      injectionName: raw.injectionName,
      algorithmName: raw.algorithmName as string,
      inputs,
    };

    this.submitting.set(true);
    this.service
      .startGeneration(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
