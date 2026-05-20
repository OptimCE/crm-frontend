import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import {
  ApiResponse,
  ApiResponsePaginated,
  Pagination,
} from '../../../../../../core/dtos/api.response';
import { VALIDATION_TYPE } from '../../../../../../core/dtos/notification';
import {
  AlgorithmMetadata,
  AllocationKeyDetailDTO,
  AllocationKeyPartialDTO,
  CreateGenerationPayload,
  GenerationPartialDTO,
  GenerationQuery,
  GenerationStatus,
  JsonSchemaObject,
} from '../../../../../../shared/dtos/allocation_generation.dtos';
import { AllocationGenerationService } from '../../../../../../shared/services/allocation_generation.service';
import { ErrorMessageHandler } from '../../../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../../../shared/services-ui/snackbar.notifcation.service';
import { AllocationGenerationHub } from './allocation-generation-hub';

// ── Helpers ──────────────────────────────────────────────────────────

const SCHEMA: JsonSchemaObject = {
  type: 'object',
  required: ['threshold'],
  properties: {
    threshold: { type: 'number', minimum: 0, maximum: 100, default: 50 },
    label: { type: 'string', 'ui:section': 'advanced' },
    enabled: { type: 'boolean' },
  },
};

function buildAlgorithm(overrides: Partial<AlgorithmMetadata> = {}): AlgorithmMetadata {
  return {
    name: 'algo-1',
    description: 'Algorithm 1',
    version: '1.0',
    queue: 'default',
    input_schema: SCHEMA,
    tags: [],
    timeout_seconds: null,
    ...overrides,
  };
}

function buildGeneration(overrides: Partial<GenerationPartialDTO> = {}): GenerationPartialDTO {
  return {
    id: 1,
    name: 'gen-1',
    status: GenerationStatus.SUCCESS,
    ...overrides,
  };
}

function buildKey(id: number): AllocationKeyPartialDTO {
  return { id, name: `key-${id}`, description: '', surplus_total: 0 };
}

function buildKeyDetail(id: number): AllocationKeyDetailDTO {
  return { ...buildKey(id), iterations: [] };
}

function makeFile(name: string, size: number): File {
  const blob = new Blob([new Uint8Array(Math.min(size, 8))], { type: 'text/csv' });
  const file = new File([blob], name, { type: 'text/csv' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

function fileInputEvent(file: File | null): Event {
  const input = { files: file ? [file] : [], value: 'x' } as unknown as HTMLInputElement;
  return { target: input } as unknown as Event;
}

function dropEvent(file: File | null): {
  event: DragEvent;
  preventDefault: ReturnType<typeof vi.fn>;
} {
  const preventDefault = vi.fn();
  const event = {
    preventDefault,
    dataTransfer: { files: file ? [file] : [] },
  } as unknown as DragEvent;
  return { event, preventDefault };
}

// ── Test Suite ───────────────────────────────────────────────────────

describe('AllocationGenerationHub', () => {
  let component: AllocationGenerationHub;
  let fixture: ComponentFixture<AllocationGenerationHub>;

  let serviceSpy: {
    listAlgorithms: ReturnType<typeof vi.fn>;
    getAlgorithm: ReturnType<typeof vi.fn>;
    listGenerations: ReturnType<typeof vi.fn>;
    getGenerationKeys: ReturnType<typeof vi.fn>;
    getKey: ReturnType<typeof vi.fn>;
    startGeneration: ReturnType<typeof vi.fn>;
    saveKey: ReturnType<typeof vi.fn>;
    deleteKey: ReturnType<typeof vi.fn>;
    deleteGeneration: ReturnType<typeof vi.fn>;
    invalidate: ReturnType<typeof vi.fn>;
  };
  let snackbarSpy: { openSnackBar: ReturnType<typeof vi.fn> };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };
  let confirmationSpy: { confirm: ReturnType<typeof vi.fn> };
  let translateSpy: {
    instant: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    onLangChange: { subscribe: ReturnType<typeof vi.fn> };
    onTranslationChange: { subscribe: ReturnType<typeof vi.fn> };
    onDefaultLangChange: { subscribe: ReturnType<typeof vi.fn> };
  };

  async function createComponent(initialize = true): Promise<void> {
    fixture = TestBed.createComponent(AllocationGenerationHub);
    component = fixture.componentInstance;
    if (initialize) {
      component.ngOnInit();
    }
    await fixture.whenStable();
  }

  beforeEach(async () => {
    serviceSpy = {
      listAlgorithms: vi.fn().mockReturnValue(of(new ApiResponse([buildAlgorithm()]))),
      getAlgorithm: vi.fn().mockReturnValue(of(new ApiResponse(buildAlgorithm()))),
      listGenerations: vi
        .fn()
        .mockReturnValue(
          of(new ApiResponsePaginated([buildGeneration()], new Pagination(1, 20, 1, 1))),
        ),
      getGenerationKeys: vi
        .fn()
        .mockReturnValue(of(new ApiResponsePaginated([buildKey(10)], new Pagination(1, 50, 1, 1)))),
      getKey: vi.fn().mockReturnValue(of(new ApiResponse(buildKeyDetail(10)))),
      startGeneration: vi
        .fn()
        .mockReturnValue(of(new ApiResponse({ id: 99, status: GenerationStatus.PENDING }))),
      saveKey: vi.fn().mockReturnValue(of(new ApiResponse('ok'))),
      deleteKey: vi.fn().mockReturnValue(of(new ApiResponse('ok'))),
      deleteGeneration: vi.fn().mockReturnValue(of(new ApiResponse('ok'))),
      invalidate: vi.fn(),
    };
    snackbarSpy = { openSnackBar: vi.fn() };
    errorHandlerSpy = { handleError: vi.fn() };
    confirmationSpy = { confirm: vi.fn() };
    translateSpy = {
      instant: vi.fn((k: string) => k),
      get: vi.fn(() => of({})),
      onLangChange: { subscribe: vi.fn() },
      onTranslationChange: { subscribe: vi.fn() },
      onDefaultLangChange: { subscribe: vi.fn() },
    };

    await TestBed.configureTestingModule({
      imports: [AllocationGenerationHub],
      providers: [
        { provide: AllocationGenerationService, useValue: serviceSpy },
        { provide: SnackbarNotification, useValue: snackbarSpy },
        { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
        { provide: TranslateService, useValue: translateSpy },
      ],
    })
      .overrideComponent(AllocationGenerationHub, {
        set: {
          template: '',
          providers: [
            { provide: ConfirmationService, useValue: confirmationSpy },
            { provide: MessageService, useValue: { add: vi.fn() } },
          ],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();
  });

  // ── 1. Creation & initialization ───────────────────────────────────

  describe('initialization', () => {
    it('should create the component', async () => {
      await createComponent(false);
      expect(component).toBeTruthy();
    });

    it('should call listAlgorithms and listGenerations on ngOnInit', async () => {
      await createComponent();
      expect(serviceSpy.listAlgorithms).toHaveBeenCalled();
      expect(serviceSpy.listGenerations).toHaveBeenCalled();
    });

    it('should expose default signal values for non-service-driven state', async () => {
      // Use never-completing observables so service-driven signals stay at their constructor defaults.
      serviceSpy.listAlgorithms.mockReturnValue(new Subject());
      serviceSpy.listGenerations.mockReturnValue(new Subject());
      await createComponent(false);
      expect(component.algorithms()).toEqual([]);
      expect(component.algorithmsLoading()).toBe(true);
      expect(component.algorithmsError()).toBe(false);
      expect(component.selectedAlgorithm()).toBeUndefined();
      expect(component.file()).toBeNull();
      expect(component.fileError()).toBeNull();
      expect(component.submitting()).toBe(false);
      expect(component.submitAttempted()).toBe(false);
      expect(component.generations()).toEqual([]);
      expect(component.expandedGenerationId()).toBeNull();
      expect(component.expandedKeyId()).toBeNull();
    });
  });

  // ── 2. Algorithm loading ───────────────────────────────────────────

  describe('algorithm loading', () => {
    it('should populate algorithms and clear loading on success', async () => {
      const algos = [buildAlgorithm({ name: 'a' }), buildAlgorithm({ name: 'b' })];
      serviceSpy.listAlgorithms.mockReturnValue(of(new ApiResponse(algos)));
      await createComponent();
      expect(component.algorithms()).toEqual(algos);
      expect(component.algorithmsLoading()).toBe(false);
      expect(component.algorithmsError()).toBe(false);
    });

    it('should expose algorithmOptions derived from algorithms', async () => {
      const algos = [
        buildAlgorithm({ name: 'a', description: 'Algo A' }),
        buildAlgorithm({ name: 'b', description: '' }),
      ];
      serviceSpy.listAlgorithms.mockReturnValue(of(new ApiResponse(algos)));
      await createComponent();
      expect(component.algorithmOptions()).toEqual([
        { label: 'Algo A', value: 'a', meta: algos[0] },
        { label: 'b', value: 'b', meta: algos[1] },
      ]);
    });

    it('should set algorithmsError and clear loading on listAlgorithms error', async () => {
      serviceSpy.listAlgorithms.mockReturnValue(throwError(() => new Error('boom')));
      await createComponent();
      expect(component.algorithmsLoading()).toBe(false);
      expect(component.algorithmsError()).toBe(true);
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });
  });

  // ── 3. onAlgorithmSelected ─────────────────────────────────────────

  describe('onAlgorithmSelected', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should clear inputs form and selectedAlgorithm when name is null', () => {
      // First select an algorithm to populate the inputs FormRecord.
      component.onAlgorithmSelected('algo-1');
      expect(Object.keys(component.startForm.controls.inputs.controls).length).toBeGreaterThan(0);
      serviceSpy.getAlgorithm.mockClear();
      component.onAlgorithmSelected(null);
      expect(component.selectedAlgorithm()).toBeUndefined();
      expect(Object.keys(component.startForm.controls.inputs.controls)).toHaveLength(0);
      expect(serviceSpy.getAlgorithm).not.toHaveBeenCalled();
    });

    it('should fetch algorithm metadata and rebuild the inputs form', () => {
      const algo = buildAlgorithm();
      serviceSpy.getAlgorithm.mockReturnValue(of(new ApiResponse(algo)));
      component.onAlgorithmSelected('algo-1');
      expect(serviceSpy.getAlgorithm).toHaveBeenCalledWith('algo-1');
      expect(component.selectedAlgorithm()).toEqual(algo);
      const inputs = component.startForm.controls.inputs;
      expect(Object.keys(inputs.controls).sort()).toEqual(['enabled', 'label', 'threshold']);
      expect(inputs.controls['threshold'].value).toBe(50);
      expect(inputs.controls['enabled'].value).toBe(false);
      expect(inputs.controls['label'].value).toBeNull();
    });

    it('should mark required fields based on schema.required', () => {
      const algo = buildAlgorithm();
      serviceSpy.getAlgorithm.mockReturnValue(of(new ApiResponse(algo)));
      component.onAlgorithmSelected('algo-1');
      const inputs = component.startForm.controls.inputs;
      inputs.controls['threshold'].setValue(null);
      expect(inputs.controls['threshold'].errors?.['required']).toBeTruthy();
      inputs.controls['label'].setValue(null);
      // 'label' is not in required → null is acceptable
      expect(inputs.controls['label'].errors).toBeNull();
    });

    it('should call errorHandler on getAlgorithm error', () => {
      serviceSpy.getAlgorithm.mockReturnValue(throwError(() => new Error('nope')));
      component.onAlgorithmSelected('algo-1');
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });
  });

  // ── 4. File handling ───────────────────────────────────────────────

  describe('file handling', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should accept a valid CSV file via onFileSelected', () => {
      const file = makeFile('data.csv', 1024);
      component.onFileSelected(fileInputEvent(file));
      expect(component.file()).toBe(file);
      expect(component.fileError()).toBeNull();
    });

    it('should accept a valid XLSX file', () => {
      const file = makeFile('Data.XLSX', 2048);
      component.onFileSelected(fileInputEvent(file));
      expect(component.file()).toBe(file);
      expect(component.fileError()).toBeNull();
    });

    it('should reject an empty file with FILE_EMPTY error', () => {
      const file = makeFile('empty.csv', 0);
      component.onFileSelected(fileInputEvent(file));
      expect(component.file()).toBeNull();
      expect(component.fileError()).toBe('ALGORITHM_HUB.ERRORS.FILE_EMPTY');
    });

    it('should reject a too-large file with FILE_TOO_LARGE error', () => {
      const file = makeFile('huge.csv', 26 * 1024 * 1024);
      component.onFileSelected(fileInputEvent(file));
      expect(component.file()).toBeNull();
      expect(component.fileError()).toBe('ALGORITHM_HUB.ERRORS.FILE_TOO_LARGE');
    });

    it('should reject a file with an invalid extension', () => {
      const file = makeFile('bad.txt', 1024);
      component.onFileSelected(fileInputEvent(file));
      expect(component.file()).toBeNull();
      expect(component.fileError()).toBe('ALGORITHM_HUB.ERRORS.FILE_TYPE');
    });

    it('should clear file and error when no file is provided', () => {
      component.file.set(makeFile('x.csv', 1024));
      component.fileError.set('something');
      component.onFileSelected(fileInputEvent(null));
      expect(component.file()).toBeNull();
      expect(component.fileError()).toBeNull();
    });

    it('should handle drop events and preventDefault', () => {
      const file = makeFile('dropped.csv', 1024);
      const { event, preventDefault } = dropEvent(file);
      component.onFileDropped(event);
      expect(preventDefault).toHaveBeenCalled();
      expect(component.file()).toBe(file);
    });

    it('onDragOver should preventDefault', () => {
      const preventDefault = vi.fn();
      const event = { preventDefault } as unknown as DragEvent;
      component.onDragOver(event);
      expect(preventDefault).toHaveBeenCalled();
    });

    it('clearFile should reset file and fileError', () => {
      component.file.set(makeFile('x.csv', 1024));
      component.fileError.set('any');
      component.clearFile();
      expect(component.file()).toBeNull();
      expect(component.fileError()).toBeNull();
    });

    it('formatFileSize should produce human-readable sizes', () => {
      expect(component.formatFileSize(512)).toBe('512 B');
      expect(component.formatFileSize(2048)).toBe('2.0 KB');
      expect(component.formatFileSize(5 * 1024 * 1024)).toBe('5.00 MB');
    });
  });

  // ── 5. submitGeneration ────────────────────────────────────────────

  describe('submitGeneration', () => {
    beforeEach(async () => {
      await createComponent();
      // Wire a selected algorithm so the inputs FormRecord has controls
      serviceSpy.getAlgorithm.mockReturnValue(of(new ApiResponse(buildAlgorithm())));
      component.onAlgorithmSelected('algo-1');
      component.startForm.patchValue({
        algorithmName: 'algo-1',
        generationName: 'My Gen',
        injectionName: 'My Inj',
      });
    });

    it('should set submitAttempted and set fileError when no file is picked', () => {
      component.submitGeneration();
      expect(component.submitAttempted()).toBe(true);
      expect(component.fileError()).toBe('ALGORITHM_HUB.ERRORS.FILE_REQUIRED');
      expect(serviceSpy.startGeneration).not.toHaveBeenCalled();
    });

    it('should not call startGeneration when the form is invalid', () => {
      component.startForm.patchValue({ generationName: '' });
      component.file.set(makeFile('data.csv', 1024));
      component.submitGeneration();
      expect(serviceSpy.startGeneration).not.toHaveBeenCalled();
      expect(component.submitting()).toBe(false);
    });

    it('should call startGeneration on the happy path and reset form/file', () => {
      component.file.set(makeFile('data.csv', 1024));
      component.submitGeneration();
      expect(serviceSpy.startGeneration).toHaveBeenCalledTimes(1);
      const payload = serviceSpy.startGeneration.mock.calls[0][0] as CreateGenerationPayload;
      expect(payload.name).toBe('My Gen');
      expect(payload.injectionName).toBe('My Inj');
      expect(payload.algorithmName).toBe('algo-1');
      expect(payload.file.name).toBe('data.csv');
      expect(snackbarSpy.openSnackBar).toHaveBeenCalledWith(
        'ALGORITHM_HUB.SUCCESS.GENERATION_STARTED',
        VALIDATION_TYPE,
      );
      expect(component.file()).toBeNull();
      expect(component.submitting()).toBe(false);
      expect(component.submitAttempted()).toBe(false);
    });

    it('should refresh generations after a successful submit', () => {
      component.file.set(makeFile('data.csv', 1024));
      serviceSpy.listGenerations.mockClear();
      component.submitGeneration();
      expect(serviceSpy.invalidate).toHaveBeenCalled();
      expect(serviceSpy.listGenerations).toHaveBeenCalled();
    });

    it('should call errorHandler and clear submitting on submit error', () => {
      serviceSpy.startGeneration.mockReturnValue(throwError(() => new Error('fail')));
      component.file.set(makeFile('data.csv', 1024));
      component.submitGeneration();
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
      expect(component.submitting()).toBe(false);
    });

    it('should strip empty optional inputs but keep required ones', () => {
      component.startForm.controls.inputs.controls['threshold'].setValue(70);
      component.startForm.controls.inputs.controls['label'].setValue('');
      component.file.set(makeFile('data.csv', 1024));
      component.submitGeneration();
      const payload = serviceSpy.startGeneration.mock.calls[0][0] as CreateGenerationPayload;
      expect(payload.inputs['threshold']).toBe(70);
      expect(payload.inputs['label']).toBeUndefined();
    });
  });

  // ── 6. Generations list ───────────────────────────────────────────

  describe('generations list', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should populate generations, pagination and lastRefreshedAt on success', () => {
      const list = [buildGeneration({ id: 1 }), buildGeneration({ id: 2 })];
      const pagination = new Pagination(2, 20, 25, 2);
      serviceSpy.listGenerations.mockReturnValue(of(new ApiResponsePaginated(list, pagination)));
      component.loadGenerations(2);
      expect(component.generations()).toEqual(list);
      expect(component.generationsPagination().total_pages).toBe(2);
      expect(component.generationsFilter().page).toBe(2);
      expect(component.lastRefreshedAt()).not.toBeNull();
      expect(component.hasMorePages()).toBe(true);
    });

    it('should clear loading and call errorHandler on error', () => {
      serviceSpy.listGenerations.mockReturnValue(throwError(() => new Error('boom')));
      component.loadGenerations();
      expect(component.generationsLoading()).toBe(false);
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });

    it('refreshGenerations should invalidate cache and re-fetch the current page', () => {
      component.generationsFilter.update((f) => ({ ...f, page: 3 }));
      serviceSpy.listGenerations.mockClear();
      component.refreshGenerations();
      expect(serviceSpy.invalidate).toHaveBeenCalled();
      const callArg = serviceSpy.listGenerations.mock.calls[0][0] as GenerationQuery;
      expect(callArg.page).toBe(3);
    });

    it('goToPage should ignore invalid page numbers', () => {
      component.generationsPagination.set(new Pagination(1, 20, 0, 1));
      serviceSpy.listGenerations.mockClear();
      component.goToPage(0);
      component.goToPage(99);
      expect(serviceSpy.listGenerations).not.toHaveBeenCalled();
    });

    it('goToPage should re-fetch on a valid page', () => {
      component.generationsPagination.set(new Pagination(1, 20, 40, 2));
      serviceSpy.listGenerations.mockClear();
      component.goToPage(2);
      expect(serviceSpy.listGenerations).toHaveBeenCalled();
      expect(component.generationsFilter().page).toBe(2);
    });
  });

  // ── 7. Generation expansion ───────────────────────────────────────

  describe('toggleGeneration', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should expand and fetch keys for a new generation', () => {
      serviceSpy.getGenerationKeys.mockClear();
      component.toggleGeneration(5);
      expect(component.expandedGenerationId()).toBe(5);
      expect(serviceSpy.getGenerationKeys).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ page: 1 }),
      );
      expect(component.keysFor(5)).toEqual([buildKey(10)]);
    });

    it('should collapse the same generation without re-fetching', () => {
      component.toggleGeneration(5);
      serviceSpy.getGenerationKeys.mockClear();
      component.toggleGeneration(5);
      expect(component.expandedGenerationId()).toBeNull();
      expect(serviceSpy.getGenerationKeys).not.toHaveBeenCalled();
    });

    it('should not re-fetch when expanding a generation whose keys are cached', () => {
      component.toggleGeneration(5); // fetches
      serviceSpy.getGenerationKeys.mockClear();
      component.toggleGeneration(7); // different one - fetches
      expect(serviceSpy.getGenerationKeys).toHaveBeenCalledTimes(1);
      serviceSpy.getGenerationKeys.mockClear();
      component.toggleGeneration(5); // toggles 7 off implicitly via switch
      // Now expanding 5 should not re-fetch because it's cached
      expect(serviceSpy.getGenerationKeys).not.toHaveBeenCalled();
    });

    it('should call errorHandler if loadKeysForGeneration fails', () => {
      serviceSpy.getGenerationKeys.mockReturnValue(throwError(() => new Error('x')));
      component.toggleGeneration(9);
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
      expect(component.isKeysLoadingFor(9)).toBe(false);
    });
  });

  // ── 8. Key expansion ──────────────────────────────────────────────

  describe('toggleKey', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should expand a key and fetch its detail', () => {
      component.toggleKey(11);
      expect(component.expandedKeyId()).toBe(11);
      expect(serviceSpy.getKey).toHaveBeenCalledWith(11);
    });

    it('should collapse the same key without re-fetching', () => {
      component.toggleKey(11);
      serviceSpy.getKey.mockClear();
      component.toggleKey(11);
      expect(component.expandedKeyId()).toBeNull();
      expect(serviceSpy.getKey).not.toHaveBeenCalled();
    });

    it('should store the detail by id on success', () => {
      const detail = buildKeyDetail(11);
      serviceSpy.getKey.mockReturnValue(of(new ApiResponse(detail)));
      component.toggleKey(11);
      expect(component.keyExpandStateFor(0).detailById.get(11)).toEqual(detail);
    });

    it('should call errorHandler on detail fetch error', () => {
      serviceSpy.getKey.mockReturnValue(throwError(() => new Error('nope')));
      component.toggleKey(11);
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });
  });

  // ── 9. Save / Delete with confirmation ────────────────────────────

  describe('save / delete', () => {
    beforeEach(async () => {
      await createComponent();
    });

    function fireAccept(): void {
      const calls = confirmationSpy.confirm.mock.calls;
      const args = calls[calls.length - 1][0] as Confirmation;
      const accept = args.accept as () => void;
      accept();
    }

    it('saveKey should confirm and call service.saveKey on accept', () => {
      component.saveKey(33);
      expect(confirmationSpy.confirm).toHaveBeenCalled();
      fireAccept();
      expect(serviceSpy.saveKey).toHaveBeenCalledWith({ id_key: 33 });
      expect(snackbarSpy.openSnackBar).toHaveBeenCalledWith(
        'ALGORITHM_HUB.SUCCESS.KEY_SAVED',
        VALIDATION_TYPE,
      );
    });

    it('saveKey should report errors via errorHandler', () => {
      serviceSpy.saveKey.mockReturnValue(throwError(() => new Error('fail')));
      component.saveKey(33);
      fireAccept();
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });

    it('deleteKey should remove the key from the cached maps on success', () => {
      // pre-load some keys for a generation, including the one to be deleted
      component.toggleGeneration(1);
      serviceSpy.getKey.mockReturnValue(of(new ApiResponse(buildKeyDetail(10))));
      component.toggleKey(10);
      expect(component.keyExpandStateFor(0).detailById.has(10)).toBe(true);

      component.deleteKey(10);
      fireAccept();
      expect(serviceSpy.deleteKey).toHaveBeenCalledWith(10);
      expect(component.keysFor(1)?.find((k) => k.id === 10)).toBeUndefined();
      expect(component.keyExpandStateFor(0).detailById.has(10)).toBe(false);
      expect(component.expandedKeyId()).toBeNull();
    });

    it('deleteKey should report errors via errorHandler', () => {
      serviceSpy.deleteKey.mockReturnValue(throwError(() => new Error('boom')));
      component.deleteKey(10);
      fireAccept();
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });

    it('deleteGeneration should remove the generation and its cached children', () => {
      // seed the generations list with the target
      component.generations.set([buildGeneration({ id: 1 }), buildGeneration({ id: 2 })]);
      component.toggleGeneration(1); // populates keysByGeneration for 1
      component.deleteGeneration(1);
      fireAccept();
      expect(serviceSpy.deleteGeneration).toHaveBeenCalledWith(1);
      expect(component.generations().map((g) => g.id)).toEqual([2]);
      expect(component.keysFor(1)).toBeUndefined();
      expect(component.expandedGenerationId()).toBeNull();
    });

    it('deleteGeneration should report errors via errorHandler', () => {
      serviceSpy.deleteGeneration.mockReturnValue(throwError(() => new Error('fail')));
      component.deleteGeneration(1);
      fireAccept();
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });
  });

  // ── 10. Template helpers ──────────────────────────────────────────

  describe('template helpers', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('isGenerationExpanded reflects expandedGenerationId', () => {
      component.expandedGenerationId.set(7);
      expect(component.isGenerationExpanded(7)).toBe(true);
      expect(component.isGenerationExpanded(8)).toBe(false);
    });

    it('isKeysLoadingFor reflects keysLoadingId', () => {
      component.toggleGeneration(7); // resolves synchronously thanks to of(), so loading is back to null
      expect(component.isKeysLoadingFor(7)).toBe(false);
    });

    it('keyExpandStateFor exposes the current expansion snapshot', () => {
      component.expandedKeyId.set(42);
      const state = component.keyExpandStateFor(1);
      expect(state.expandedKeyId).toBe(42);
      expect(state.loadingId).toBeNull();
      expect(state.detailById).toBeInstanceOf(Map);
    });
  });
});
