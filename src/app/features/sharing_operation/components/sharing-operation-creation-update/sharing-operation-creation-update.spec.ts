import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { TranslateModule } from '@ngx-translate/core';
import { DynamicDialogRef } from 'primeng/dynamicdialog';

import { SharingOperationCreationUpdate } from './sharing-operation-creation-update';
import { SharingOperationService } from '../../../../shared/services/sharing_operation.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SharingOperationType } from '../../../../shared/types/sharing_operation.types';

describe('SharingOperationCreationUpdate', () => {
  let component: SharingOperationCreationUpdate;
  let fixture: ComponentFixture<SharingOperationCreationUpdate>;

  let sharingOpServiceSpy: { createSharingOperation: ReturnType<typeof vi.fn> };
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    sharingOpServiceSpy = { createSharingOperation: vi.fn() };
    dialogRefSpy = { close: vi.fn() };
    errorHandlerSpy = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SharingOperationCreationUpdate, TranslateModule.forRoot()],
      providers: [
        { provide: SharingOperationService, useValue: sharingOpServiceSpy },
        { provide: DynamicDialogRef, useValue: dialogRefSpy },
        { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(SharingOperationCreationUpdate, {
        set: {
          imports: [TranslateModule],
          template: '',
          providers: [{ provide: ErrorMessageHandler, useValue: errorHandlerSpy }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(SharingOperationCreationUpdate);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  // =============================================
  // 1. Component Creation & Initialization
  // =============================================

  describe('creation and initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize formAddSharingOp with name and type controls on ngOnInit', () => {
      expect(component.formAddSharingOp).toBeDefined();
      expect(component.formAddSharingOp.get('name')).toBeTruthy();
      expect(component.formAddSharingOp.get('type')).toBeTruthy();
    });

    it('should set both name and type controls as required validators', () => {
      const nameControl = component.formAddSharingOp.get('name');
      const typeControl = component.formAddSharingOp.get('type');

      expect(nameControl).toBeTruthy();
      expect(typeControl).toBeTruthy();

      nameControl?.setValue(null);
      typeControl?.setValue(null);

      expect(nameControl?.hasError('required')).toBe(true);
      expect(typeControl?.hasError('required')).toBe(true);
    });
  });

  // =============================================
  // 2. Categories Setup
  // =============================================

  describe('setupECCategory', () => {
    it('should populate categories signal with 3 items after translation resolves', () => {
      expect(component.categories().length).toBe(3);
    });

    it('should set correct keys (LOCAL, CER, CEC) for categories', () => {
      const keys = component.categories().map((c) => c.key);
      expect(keys).toEqual([
        SharingOperationType.LOCAL,
        SharingOperationType.CER,
        SharingOperationType.CEC,
      ]);
    });
  });

  // =============================================
  // 3. Form Validation
  // =============================================

  describe('form validation', () => {
    it('should mark form as invalid when empty', () => {
      expect(component.formAddSharingOp.invalid).toBe(true);
    });

    it('should mark form as invalid when only name is provided', () => {
      component.formAddSharingOp.patchValue({ name: 'Test' });
      expect(component.formAddSharingOp.invalid).toBe(true);
    });

    it('should mark form as invalid when only type is provided', () => {
      component.formAddSharingOp.patchValue({ type: SharingOperationType.LOCAL });
      expect(component.formAddSharingOp.invalid).toBe(true);
    });

    it('should mark form as valid when both name and type are provided', () => {
      component.formAddSharingOp.patchValue({
        name: 'Test Operation',
        type: SharingOperationType.CER,
      });
      expect(component.formAddSharingOp.valid).toBe(true);
    });
  });

  // =============================================
  // 4. onSubmitForm — Guard
  // =============================================

  describe('onSubmitForm — guard', () => {
    it('should not call service when form is invalid', () => {
      component.onSubmitForm();
      expect(sharingOpServiceSpy.createSharingOperation).not.toHaveBeenCalled();
    });
  });

  // =============================================
  // 5. onSubmitForm — Success
  // =============================================

  describe('onSubmitForm — success', () => {
    beforeEach(() => {
      component.formAddSharingOp.patchValue({
        name: 'My Operation',
        type: SharingOperationType.LOCAL,
      });
    });

    it('should call createSharingOperation with correct DTO when form is valid', () => {
      sharingOpServiceSpy.createSharingOperation.mockReturnValue(of({ data: 'ok' }));

      component.onSubmitForm();

      expect(sharingOpServiceSpy.createSharingOperation).toHaveBeenCalledWith({
        name: 'My Operation',
        type: SharingOperationType.LOCAL,
      });
    });

    it('should close dialog with true on successful response', () => {
      sharingOpServiceSpy.createSharingOperation.mockReturnValue(of({ data: 'ok' }));

      component.onSubmitForm();

      expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
    });
  });

  // =============================================
  // 6. onSubmitForm — Error Handling
  // =============================================

  describe('onSubmitForm — error handling', () => {
    beforeEach(() => {
      component.formAddSharingOp.patchValue({
        name: 'My Operation',
        type: SharingOperationType.CEC,
      });
    });

    it('should call errorHandler.handleError when response is falsy', () => {
      sharingOpServiceSpy.createSharingOperation.mockReturnValue(of(null));

      component.onSubmitForm();

      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(null);
    });

    it('should call errorHandler.handleError on service error', () => {
      const error = new Error('Network error');
      sharingOpServiceSpy.createSharingOperation.mockReturnValue(throwError(() => error));

      component.onSubmitForm();

      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(error);
    });
  });
});
