import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { vi } from 'vitest';

import { KeyCreationModeDialog } from './key-creation-mode-dialog';

describe('KeyCreationModeDialog', () => {
  let component: KeyCreationModeDialog;
  let fixture: ComponentFixture<KeyCreationModeDialog>;
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    dialogRefSpy = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [KeyCreationModeDialog, TranslateModule.forRoot()],
      providers: [{ provide: DynamicDialogRef, useValue: dialogRefSpy }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(KeyCreationModeDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  // ── 1. Creation ─────────────────────────────────────────────────

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should offer exactly the two creation modes', () => {
    expect(component.options.map((option) => option.mode)).toEqual(['full', 'step']);
  });

  // ── 2. Choosing a mode ──────────────────────────────────────────

  describe('choose', () => {
    it('should close with "full"', () => {
      component.choose('full');
      expect(dialogRefSpy.close).toHaveBeenCalledWith('full');
    });

    it('should close with "step"', () => {
      component.choose('step');
      expect(dialogRefSpy.close).toHaveBeenCalledWith('step');
    });
  });

  describe('close', () => {
    it('should close with null so the caller does not navigate', () => {
      component.close();
      expect(dialogRefSpy.close).toHaveBeenCalledWith(null);
    });
  });

  // ── 3. Template ─────────────────────────────────────────────────

  describe('template', () => {
    it('should render one activatable card per mode', () => {
      fixture.detectChanges();
      const cards = (fixture.nativeElement as HTMLElement).querySelectorAll('[role="button"]');
      expect(cards.length).toBe(2);
    });

    it('should close with the mode when a card is clicked', () => {
      fixture.detectChanges();
      const card = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
        '[data-testid="key-creation-mode__card--step"]',
      );
      card?.click();
      expect(dialogRefSpy.close).toHaveBeenCalledWith('step');
    });

    it('should close with the mode when a focused card is activated with Enter', () => {
      fixture.detectChanges();
      const card = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
        '[data-testid="key-creation-mode__card--full"]',
      );
      card?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(dialogRefSpy.close).toHaveBeenCalledWith('full');
    });
  });
});
