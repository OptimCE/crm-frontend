import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { DynamicDialogConfig } from 'primeng/dynamicdialog';

import { MeterDeactivation } from './meter-deactivation';

// ── Test Suite ─────────────────────────────────────────────────────

describe('MeterDeactivation', () => {
  let component: MeterDeactivation;
  let fixture: ComponentFixture<MeterDeactivation>;

  const dialogConfigMock = {
    data: { ean: 'EAN001234567890' },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeterDeactivation],
      providers: [{ provide: DynamicDialogConfig, useValue: dialogConfigMock }],
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

  // ── 4. calendarOpen signal ──────────────────────────────────────

  describe('calendarOpen', () => {
    it('should default to false', () => {
      expect(component.calendarOpen()).toBe(false);
    });

    it('should be settable', () => {
      component.calendarOpen.set(true);
      expect(component.calendarOpen()).toBe(true);
    });
  });
});
