import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ConsumptionUpload } from './consumption-upload';
import { ApiResponse } from '../../../core/dtos/api.response';
import { SharingOperationService } from '../../services/sharing_operation.service';
import { ErrorMessageHandler } from '../../services-ui/error.message.handler';
import { SnackbarNotification } from '../../services-ui/snackbar.notifcation.service';

describe('ConsumptionUpload', () => {
  let component: ConsumptionUpload;
  let fixture: ComponentFixture<ConsumptionUpload>;

  let serviceSpy: { addConsumptionDataToSharing: ReturnType<typeof vi.fn> };
  let snackbarSpy: { openSnackBar: ReturnType<typeof vi.fn> };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };

  function createComponent(operationId = 1): void {
    fixture = TestBed.createComponent(ConsumptionUpload);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('operationId', operationId);
  }

  function selectFile(name = 'consumption.xlsx'): File {
    const file = new File(['x'], name, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    component.onFileSelected({ target: { files: [file] } } as unknown as Event);
    return file;
  }

  beforeEach(async () => {
    serviceSpy = {
      addConsumptionDataToSharing: vi.fn().mockReturnValue(of(new ApiResponse('OK'))),
    };
    snackbarSpy = { openSnackBar: vi.fn() };
    errorHandlerSpy = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ConsumptionUpload, TranslateModule.forRoot()],
      providers: [
        { provide: SharingOperationService, useValue: serviceSpy },
        { provide: SnackbarNotification, useValue: snackbarSpy },
      ],
    })
      .overrideComponent(ConsumptionUpload, {
        remove: { providers: [ErrorMessageHandler] },
        add: {
          providers: [{ provide: ErrorMessageHandler, useValue: errorHandlerSpy }],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    const translate = TestBed.inject(TranslateService);
    vi.spyOn(translate, 'instant').mockImplementation((key: string | string[]) => key as string);
  });

  it('should create', () => {
    createComponent();
    expect(component).toBeTruthy();
  });

  it('onFileSelected stores the file and makes the control valid', () => {
    createComponent();
    const file = selectFile();
    expect(component.fileConsumption()).toBe(file);
    expect(component.formGroup.get('fileConsumption')?.valid).toBe(true);
  });

  it('drag handlers toggle the dragging flag', () => {
    createComponent();
    const evt = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as DragEvent;
    component.onDragOver(evt);
    expect(component.dragging()).toBe(true);
    component.onDragLeave(evt);
    expect(component.dragging()).toBe(false);
  });

  it('onDrop stores a dropped file', () => {
    createComponent();
    const file = new File(['x'], 'drop.xlsx');
    component.onDrop({
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      dataTransfer: { files: [file] as unknown as FileList },
    } as unknown as DragEvent);
    expect(component.fileConsumption()).toBe(file);
    expect(component.dragging()).toBe(false);
  });

  it('submit does nothing when no file is selected', () => {
    createComponent();
    component.submit();
    expect(serviceSpy.addConsumptionDataToSharing).not.toHaveBeenCalled();
  });

  it('submit posts FormData with the file and operation id, and toasts on success', () => {
    createComponent(7);
    const file = selectFile();
    component.submit();

    expect(serviceSpy.addConsumptionDataToSharing).toHaveBeenCalledWith(expect.any(FormData), 7);
    const formData = serviceSpy.addConsumptionDataToSharing.mock.calls[0][0] as FormData;
    expect(formData.get('file')).toBe(file);
    expect(formData.get('id_sharing_operation')).toBe('7');
    expect(snackbarSpy.openSnackBar).toHaveBeenCalled();
  });

  it('emits (uploaded) on success', () => {
    createComponent();
    selectFile();
    let emitted = false;
    component.uploaded.subscribe(() => (emitted = true));
    component.submit();
    expect(emitted).toBe(true);
  });

  it('clears the control WITHOUT a false "required" error after a successful upload', () => {
    createComponent();
    selectFile();
    component.submit();

    // Regression: a bare formGroup.reset() used to re-trigger Validators.required.
    expect(component.fileConsumption()).toBeNull();
    expect(component.formGroup.get('fileConsumption')?.errors).toBeNull();
  });

  it('calls the error handler on a null response', () => {
    createComponent();
    selectFile();
    serviceSpy.addConsumptionDataToSharing.mockReturnValue(of(null));
    component.submit();
    expect(errorHandlerSpy.handleError).toHaveBeenCalled();
  });

  it('calls the error handler when the request fails', () => {
    createComponent();
    selectFile();
    serviceSpy.addConsumptionDataToSharing.mockReturnValue(throwError(() => new Error('boom')));
    component.submit();
    expect(errorHandlerSpy.handleError).toHaveBeenCalled();
  });
});
