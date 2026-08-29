import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import {
  ApiResponse,
  ApiResponsePaginated,
  Pagination,
} from '../../../../../../core/dtos/api.response';
import { VALIDATION_TYPE } from '../../../../../../core/dtos/notification';
import { KeyPartialDTO } from '../../../../../../shared/dtos/key.dtos';
import {
  CreateSimulationResponse,
  CrmSimulationPreviewDTO,
  SimulationStatus,
} from '../../../../../../shared/dtos/simulation.dtos';
import { SharingOperationPartialDTO } from '../../../../../../shared/dtos/sharing_operation.dtos';
import { KeyService } from '../../../../../../shared/services/key.service';
import { SharingOperationService } from '../../../../../../shared/services/sharing_operation.service';
import { SimulationService } from '../../../../../../shared/services/simulation.service';
import { ErrorMessageHandler } from '../../../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../../../shared/services-ui/snackbar.notifcation.service';
import { SimulationStartPanel } from './simulation-start-panel';

// ── Helpers ──────────────────────────────────────────────────────────

function buildKey(overrides: Partial<KeyPartialDTO> = {}): KeyPartialDTO {
  return { id: 1, name: 'key-1', description: 'first key', ...overrides };
}

function keysResponse(keys: KeyPartialDTO[]): ApiResponsePaginated<KeyPartialDTO[]> {
  return new ApiResponsePaginated(keys, new Pagination(1, 200, keys.length, 1));
}

function startResponse(): ApiResponse<CreateSimulationResponse> {
  return new ApiResponse({ id: 99, status: SimulationStatus.PENDING });
}

function buildOperation(
  overrides: Partial<SharingOperationPartialDTO> = {},
): SharingOperationPartialDTO {
  return { id: 7, name: 'Public Solar Sharing', type: 1, municipalities: [], ...overrides };
}

function operationsResponse(
  operations: SharingOperationPartialDTO[],
): ApiResponsePaginated<SharingOperationPartialDTO[]> {
  return new ApiResponsePaginated(operations, new Pagination(1, 200, operations.length, 1));
}

function previewResponse(
  overrides: Partial<CrmSimulationPreviewDTO> = {},
): ApiResponse<CrmSimulationPreviewDTO> {
  return new ApiResponse({
    can_simulate: true,
    matched_participants: ['541448000000000001'],
    unmatched_participants: [],
    meter_count: 2,
    reading_count: 2880,
    first_timestamp: '2025-02-01T00:00:00Z',
    last_timestamp: '2025-02-28T23:45:00Z',
    total_consumption_kwh: 1234.5,
    total_injection_kwh: 987.6,
    incomplete_meters: [],
    blockers: [],
    ...overrides,
  });
}

function makeFile(name: string, size: number): File {
  const blob = new Blob([new Uint8Array(Math.min(size, 8))], { type: 'text/csv' });
  const file = new File([blob], name, { type: 'text/csv' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

function fileInputEvent(file: File | null): {
  event: Event;
  input: { files: File[]; value: string };
} {
  const input = { files: file ? [file] : [], value: 'x' };
  return { event: { target: input } as unknown as Event, input };
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

describe('SimulationStartPanel', () => {
  let component: SimulationStartPanel;
  let fixture: ComponentFixture<SimulationStartPanel>;

  let simulationServiceSpy: {
    startSimulation: ReturnType<typeof vi.fn>;
    startSimulationFromCrm: ReturnType<typeof vi.fn>;
    previewCrmData: ReturnType<typeof vi.fn>;
  };
  let sharingOperationServiceSpy: { getSharingOperationList: ReturnType<typeof vi.fn> };
  let keyServiceSpy: { getKeysList: ReturnType<typeof vi.fn> };
  let snackbarSpy: { openSnackBar: ReturnType<typeof vi.fn> };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };

  async function createComponent(initialize = true): Promise<void> {
    fixture = TestBed.createComponent(SimulationStartPanel);
    component = fixture.componentInstance;
    if (initialize) {
      component.ngOnInit();
    }
    await fixture.whenStable();
  }

  /** Fill every required field with a valid value (uses a valid CSV file). */
  function fillValidForm(): File {
    const file = makeFile('data.csv', 2048);
    component.onFileSelected(fileInputEvent(file).event);
    component.form.patchValue({
      idKey: 5,
      simulationName: 'My simulation',
      injectionName: 'Injection A',
    });
    return file;
  }

  beforeEach(async () => {
    simulationServiceSpy = {
      startSimulation: vi.fn().mockReturnValue(of(startResponse())),
      startSimulationFromCrm: vi.fn().mockReturnValue(of(startResponse())),
      previewCrmData: vi.fn().mockReturnValue(of(previewResponse())),
    };
    sharingOperationServiceSpy = {
      getSharingOperationList: vi.fn().mockReturnValue(of(operationsResponse([buildOperation()]))),
    };
    keyServiceSpy = { getKeysList: vi.fn().mockReturnValue(of(keysResponse([buildKey()]))) };
    snackbarSpy = { openSnackBar: vi.fn() };
    errorHandlerSpy = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SimulationStartPanel, TranslateModule.forRoot()],
      providers: [
        { provide: SimulationService, useValue: simulationServiceSpy },
        { provide: KeyService, useValue: keyServiceSpy },
        { provide: SharingOperationService, useValue: sharingOperationServiceSpy },
        { provide: SnackbarNotification, useValue: snackbarSpy },
        { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(SimulationStartPanel, { set: { template: '' } })
      .compileComponents();
  });

  // ── 1. Creation & default state ────────────────────────────────────

  describe('creation', () => {
    it('should create with default signal values', async () => {
      // Zoneless change detection flushes the first CD (and thus ngOnInit) during
      // whenStable(); a never-completing keys request keeps the signals at defaults.
      keyServiceSpy.getKeysList.mockReturnValue(new Subject());
      await createComponent(false);
      expect(component).toBeTruthy();
      expect(component.keys()).toEqual([]);
      expect(component.keysLoading()).toBe(true);
      expect(component.keysError()).toBe(false);
      expect(component.file()).toBeNull();
      expect(component.submitting()).toBe(false);
    });
  });

  // ── 2. loadKeys (ngOnInit) ─────────────────────────────────────────

  describe('loadKeys', () => {
    it('should populate keys and clear loading on success', async () => {
      keyServiceSpy.getKeysList.mockReturnValue(
        of(keysResponse([buildKey({ id: 1 }), buildKey({ id: 2 })])),
      );
      await createComponent();
      expect(keyServiceSpy.getKeysList).toHaveBeenCalledWith({
        page: 1,
        limit: 200,
        sort_name: 'ASC',
      });
      expect(component.keys().length).toBe(2);
      expect(component.keysLoading()).toBe(false);
      expect(component.keysError()).toBe(false);
    });

    it('should fall back to an empty list when the payload is not an array', async () => {
      keyServiceSpy.getKeysList.mockReturnValue(
        of(new ApiResponsePaginated('error', new Pagination())),
      );
      await createComponent();
      expect(component.keys()).toEqual([]);
      expect(component.keysLoading()).toBe(false);
    });

    it('should flag an error and stay not-loading on failure', async () => {
      keyServiceSpy.getKeysList.mockReturnValue(throwError(() => new ApiResponse('boom')));
      await createComponent();
      expect(component.keysError()).toBe(true);
      expect(component.keysLoading()).toBe(false);
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith('boom');
    });

    it('should keep loading while the request is pending', async () => {
      keyServiceSpy.getKeysList.mockReturnValue(new Subject());
      await createComponent();
      expect(component.keysLoading()).toBe(true);
    });
  });

  // ── 3. keyOptions computed ─────────────────────────────────────────

  describe('keyOptions', () => {
    it('should map keys to picker options', async () => {
      keyServiceSpy.getKeysList.mockReturnValue(
        of(keysResponse([buildKey({ id: 3, name: 'Alpha', description: 'desc' })])),
      );
      await createComponent();
      expect(component.keyOptions()).toEqual([{ label: 'Alpha', value: 3, description: 'desc' }]);
    });
  });

  // ── 4. File handling & validation ──────────────────────────────────

  describe('file handling', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should accept a valid csv and reset the input value', () => {
      const file = makeFile('data.csv', 1024);
      const { event, input } = fileInputEvent(file);
      component.onFileSelected(event);
      expect(component.file()).toBe(file);
      expect(component.form.controls.file.value).toBe(file);
      expect(component.form.controls.file.valid).toBe(true);
      expect(input.value).toBe('');
    });

    it('should accept xlsx and xls extensions', () => {
      component.onFileSelected(fileInputEvent(makeFile('data.xlsx', 1024)).event);
      expect(component.file()?.name).toBe('data.xlsx');
      component.onFileSelected(fileInputEvent(makeFile('data.xls', 1024)).event);
      expect(component.file()?.name).toBe('data.xls');
    });

    it('should reject an empty file', () => {
      component.onFileSelected(fileInputEvent(makeFile('empty.csv', 0)).event);
      expect(component.file()).toBeNull();
      expect(component.form.controls.file.errors?.['fileEmpty']).toBe(true);
    });

    it('should reject a file larger than 25 MB', () => {
      component.onFileSelected(fileInputEvent(makeFile('big.csv', 26 * 1024 * 1024)).event);
      expect(component.file()).toBeNull();
      expect(component.form.controls.file.errors?.['fileTooLarge']).toBe(true);
    });

    it('should reject an unsupported extension', () => {
      component.onFileSelected(fileInputEvent(makeFile('notes.txt', 1024)).event);
      expect(component.file()).toBeNull();
      expect(component.form.controls.file.errors?.['fileType']).toBe(true);
    });

    it('should clear the file when no file is selected', () => {
      component.onFileSelected(fileInputEvent(makeFile('data.csv', 1024)).event);
      component.onFileSelected(fileInputEvent(null).event);
      expect(component.file()).toBeNull();
      expect(component.form.controls.file.value).toBeNull();
    });

    it('onFileDropped should apply the dropped file and preventDefault', () => {
      const { event, preventDefault } = dropEvent(makeFile('drop.csv', 1024));
      component.onFileDropped(event);
      expect(preventDefault).toHaveBeenCalled();
      expect(component.file()?.name).toBe('drop.csv');
    });

    it('onDragOver should preventDefault', () => {
      const { event, preventDefault } = dropEvent(null);
      component.onDragOver(event);
      expect(preventDefault).toHaveBeenCalled();
    });

    it('clearFile should null the file and the control', () => {
      component.onFileSelected(fileInputEvent(makeFile('data.csv', 1024)).event);
      component.clearFile();
      expect(component.file()).toBeNull();
      expect(component.form.controls.file.value).toBeNull();
    });
  });

  // ── 5. formatFileSize ──────────────────────────────────────────────

  describe('formatFileSize', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should format bytes', () => {
      expect(component.formatFileSize(512)).toBe('512 B');
    });

    it('should format kilobytes', () => {
      expect(component.formatFileSize(2048)).toBe('2.0 KB');
    });

    it('should format megabytes', () => {
      expect(component.formatFileSize(5 * 1024 * 1024)).toBe('5.00 MB');
    });
  });

  // ── 6. submit ──────────────────────────────────────────────────────

  describe('submit', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should not call the service when the form is invalid', () => {
      component.submit();
      expect(simulationServiceSpy.startSimulation).not.toHaveBeenCalled();
      expect(component.form.touched).toBe(true);
    });

    it('should start the simulation with the form payload on a valid submit', () => {
      const launched = vi.fn();
      component.launched.subscribe(launched);
      const file = fillValidForm();

      component.submit();

      expect(simulationServiceSpy.startSimulation).toHaveBeenCalledTimes(1);
      expect(simulationServiceSpy.startSimulation).toHaveBeenCalledWith({
        file,
        name: 'My simulation',
        idKey: 5,
        injectionName: 'Injection A',
      });
      expect(component.submitting()).toBe(false);
      expect(snackbarSpy.openSnackBar).toHaveBeenCalledWith(
        'SIMULATION_HUB.SUCCESS.SIMULATION_STARTED',
        VALIDATION_TYPE,
      );
      expect(component.file()).toBeNull();
      expect(component.form.controls.simulationName.value).toBe('');
      expect(launched).toHaveBeenCalledTimes(1);
    });

    it('should surface an error and not emit launched on failure', () => {
      simulationServiceSpy.startSimulation.mockReturnValue(
        throwError(() => new ApiResponse('nope')),
      );
      const launched = vi.fn();
      component.launched.subscribe(launched);
      fillValidForm();

      component.submit();

      expect(component.submitting()).toBe(false);
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith('nope');
      expect(launched).not.toHaveBeenCalled();
    });
  });

  // ── CRM data source ────────────────────────────────────────────────
  //
  // The source toggle moves required-ness between two sets of controls. The
  // failure mode worth pinning is an invisible required control silently
  // blocking submit, so most of these assert on form validity rather than on
  // what the (blanked) template renders.

  describe('CRM data source', () => {
    /** Switch to the CRM source and fill everything it needs. */
    function selectCrmSource(): void {
      component.onSourceChange('crm');
      component.form.patchValue({
        idKey: 5,
        simulationName: 'My simulation',
        idSharingOperation: 7,
        periodStart: new Date(2025, 1, 1),
        periodEnd: new Date(2025, 1, 28),
      });
    }

    it('should default to the file source', async () => {
      await createComponent();
      expect(component.usingCrmSource()).toBe(false);
      expect(component.form.controls.inputSource.value).toBe('file');
    });

    it('should default the period to the last complete month', async () => {
      await createComponent();
      const start = component.form.controls.periodStart.value;
      const end = component.form.controls.periodEnd.value;
      if (!start || !end) throw new Error('the default period was not applied');
      // Whatever "today" is, the default window must sit entirely in the past
      // and start on the 1st — the current month is partial by definition.
      expect(start.getDate()).toBe(1);
      expect(end.getTime()).toBeLessThan(new Date().getTime());
      expect(start.getTime()).toBeLessThan(end.getTime());
    });

    it('should stop requiring the file once the CRM source is chosen', async () => {
      await createComponent();
      selectCrmSource();
      expect(component.form.controls.file.valid).toBe(true);
      expect(component.form.controls.injectionName.valid).toBe(true);
      expect(component.form.valid).toBe(true);
    });

    it('should require the operation and period on the CRM source', async () => {
      await createComponent();
      component.onSourceChange('crm');
      component.form.patchValue({
        idKey: 5,
        simulationName: 'My simulation',
        idSharingOperation: null,
        periodStart: null,
        periodEnd: null,
      });
      expect(component.form.valid).toBe(false);
    });

    it('should restore the file requirement when switching back', async () => {
      // The reverse direction matters just as much: a leftover required on
      // periodStart would block the file path with no visible error.
      await createComponent();
      selectCrmSource();
      component.onSourceChange('file');
      expect(component.form.controls.file.valid).toBe(false);
      component.form.patchValue({ injectionName: 'Injection A' });
      component.onFileSelected(fileInputEvent(makeFile('data.csv', 2048)).event);
      expect(component.form.valid).toBe(true);
    });

    it('should load the sharing operations and auto-select a lone one', async () => {
      await createComponent();
      component.onSourceChange('crm');
      await fixture.whenStable();
      expect(sharingOperationServiceSpy.getSharingOperationList).toHaveBeenCalled();
      expect(component.form.controls.idSharingOperation.value).toBe(7);
    });

    it('should not auto-select when several operations exist', async () => {
      sharingOperationServiceSpy.getSharingOperationList.mockReturnValue(
        of(operationsResponse([buildOperation(), buildOperation({ id: 8, name: 'Wind' })])),
      );
      await createComponent();
      component.onSourceChange('crm');
      await fixture.whenStable();
      expect(component.form.controls.idSharingOperation.value).toBeNull();
    });

    it('should map a clean preview into the view model', async () => {
      await createComponent();
      selectCrmSource();
      component.onSourceChange('crm');
      await fixture.whenStable();
      const preview = component.crmPreview();
      expect(preview?.ok).toBe(true);
      expect(preview?.matchedParticipants).toEqual(['541448000000000001']);
      expect(component.crmReady()).toBe(true);
    });

    it('should block submission when participants do not match a meter', async () => {
      simulationServiceSpy.previewCrmData.mockReturnValue(
        of(
          previewResponse({
            can_simulate: false,
            matched_participants: [],
            unmatched_participants: ['C0', 'C1'],
            blockers: [{ error_code: 2117, message: 'no match', detail: 'C0, C1' }],
          }),
        ),
      );
      await createComponent();
      selectCrmSource();
      component.onSourceChange('crm');
      await fixture.whenStable();

      expect(component.crmReady()).toBe(false);
      component.submit();
      expect(simulationServiceSpy.startSimulationFromCrm).not.toHaveBeenCalled();
    });

    it('should send local dates, never UTC-shifted ones', async () => {
      await createComponent();
      selectCrmSource();
      component.onSourceChange('crm');
      await fixture.whenStable();
      component.submit();

      expect(simulationServiceSpy.startSimulationFromCrm).toHaveBeenCalledWith({
        name: 'My simulation',
        idKey: 5,
        idSharingOperation: 7,
        // 1 February local midnight must not become 31 January.
        periodStart: '2025-02-01',
        periodEnd: '2025-02-28',
      });
      expect(simulationServiceSpy.startSimulation).not.toHaveBeenCalled();
    });

    it('should keep the period after a successful CRM run', async () => {
      // Re-running the same period against another key is the common next step.
      await createComponent();
      selectCrmSource();
      component.onSourceChange('crm');
      await fixture.whenStable();
      component.submit();

      expect(snackbarSpy.openSnackBar).toHaveBeenCalledWith(
        'SIMULATION_HUB.SUCCESS.SIMULATION_STARTED',
        VALIDATION_TYPE,
      );
      expect(component.form.controls.periodStart.value).toBeTruthy();
      expect(component.form.controls.idSharingOperation.value).toBe(7);
      expect(component.form.controls.simulationName.value).toBe('');
    });

    it('should surface a failed preview in the panel rather than as a toast', async () => {
      simulationServiceSpy.previewCrmData.mockReturnValue(throwError(() => new Error('offline')));
      await createComponent();
      selectCrmSource();
      component.onSourceChange('crm');
      await fixture.whenStable();

      expect(component.crmPreviewFailed()).toBe(true);
      expect(component.crmPreview()).toBeNull();
      expect(errorHandlerSpy.handleError).not.toHaveBeenCalled();
    });

    it('should not call the preview before a key is chosen', async () => {
      await createComponent();
      component.onSourceChange('crm');
      component.form.patchValue({
        idKey: null,
        idSharingOperation: 7,
        periodStart: new Date(2025, 1, 1),
        periodEnd: new Date(2025, 1, 28),
      });
      simulationServiceSpy.previewCrmData.mockClear();
      component.onSourceChange('crm');
      await fixture.whenStable();
      expect(simulationServiceSpy.previewCrmData).not.toHaveBeenCalled();
    });
  });
});
