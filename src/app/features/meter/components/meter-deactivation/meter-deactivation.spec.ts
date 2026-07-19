import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';

import { MeterDeactivation } from './meter-deactivation';
import { MeterService } from '../../../../shared/services/meter.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { ApiResponse } from '../../../../core/dtos/api.response';

// ── Test Suite ─────────────────────────────────────────────────────

describe('MeterDeactivation', () => {
  let component: MeterDeactivation;
  let fixture: ComponentFixture<MeterDeactivation>;

  const dialogConfigMock = {
    data: { ean: 'EAN001234567890' },
  };

  const meterServiceSpy = {
    deactivateMeter: vi.fn().mockReturnValue(of(new ApiResponse('OK'))),
  };
  const dialogRefSpy = { close: vi.fn() };
  const errorHandlerSpy = { handleError: vi.fn() };

  beforeEach(async () => {
    meterServiceSpy.deactivateMeter.mockClear();
    dialogRefSpy.close.mockClear();
    errorHandlerSpy.handleError.mockClear();

    await TestBed.configureTestingModule({
      imports: [MeterDeactivation, TranslateModule.forRoot()],
      providers: [
        { provide: DynamicDialogConfig, useValue: dialogConfigMock },
        { provide: DynamicDialogRef, useValue: dialogRefSpy },
        { provide: MeterService, useValue: meterServiceSpy },
        { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MeterDeactivation);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. Creation ─────────────────────────────────────────────────

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ── 2. Config injection ─────────────────────────────────────────

  describe('config data', () => {
    it('should read ean from DynamicDialogConfig data', () => {
      expect(component.ean).toBe('EAN001234567890');
    });
  });

  // ── 3. Form initialization ──────────────────────────────────────

  describe('deleteForm', () => {
    it('should initialize with an empty date control', () => {
      expect(component.deleteForm.get('date')?.value).toBe('');
    });

    it('should be invalid when date is empty', () => {
      expect(component.deleteForm.valid).toBe(false);
    });

    it('should have required validator on date control', () => {
      const dateControl = component.deleteForm.get('date');
      dateControl?.setValue('');
      expect(dateControl?.hasError('required')).toBe(true);
    });

    it('should become valid when date has a value', () => {
      component.deleteForm.get('date')?.setValue('2026-01-15');
      expect(component.deleteForm.valid).toBe(true);
    });
  });

  // ── 4. onSubmit ─────────────────────────────────────────────────

  describe('onSubmit', () => {
    it('should not call the service when the form is invalid', () => {
      component.onSubmit();
      expect(meterServiceSpy.deactivateMeter).not.toHaveBeenCalled();
    });

    it('should call deactivateMeter and close the dialog on success', () => {
      component.deleteForm.get('date')?.setValue(new Date(2026, 0, 15) as unknown as string);
      component.onSubmit();
      expect(meterServiceSpy.deactivateMeter).toHaveBeenCalledWith(
        'EAN001234567890',
        expect.any(String),
      );
      expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
    });

    it('should surface the error and not close the dialog on failure', () => {
      meterServiceSpy.deactivateMeter.mockReturnValueOnce(
        throwError(() => new ApiResponse('boom')),
      );
      component.deleteForm.get('date')?.setValue(new Date(2026, 0, 15) as unknown as string);
      component.onSubmit();
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith('boom');
      expect(dialogRefSpy.close).not.toHaveBeenCalled();
    });
  });
});
