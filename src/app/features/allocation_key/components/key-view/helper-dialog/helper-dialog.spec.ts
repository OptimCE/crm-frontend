import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { vi } from 'vitest';

import { HelperDialog } from './helper-dialog';

describe('HelperDialog', () => {
  let component: HelperDialog;
  let fixture: ComponentFixture<HelperDialog>;

  let dialogConfigMock: { data: { displayText?: string } | undefined };
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };

  async function createComponent(): Promise<void> {
    fixture = TestBed.createComponent(HelperDialog);
    component = fixture.componentInstance;
    component.ngOnInit();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    dialogConfigMock = { data: { displayText: 'Default help text' } };
    dialogRefSpy = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [HelperDialog],
      providers: [
        { provide: DynamicDialogConfig, useValue: dialogConfigMock },
        { provide: DynamicDialogRef, useValue: dialogRefSpy },
      ],
    }).compileComponents();
  });

  // ── 1. Creation ─────────────────────────────────────────────────────

  it('should create the component', async () => {
    await createComponent();
    expect(component).toBeTruthy();
  });

  // ── 2. ngOnInit ─────────────────────────────────────────────────────

  describe('ngOnInit', () => {
    describe('with valid displayText', () => {
      beforeEach(async () => {
        dialogConfigMock.data = { displayText: 'Help content' };
        await createComponent();
      });

      it('should set displayedText from config data', () => {
        expect(component.displayedText).toBe('Help content');
      });

      it('should not close the dialog', () => {
        expect(dialogRefSpy.close).not.toHaveBeenCalled();
      });
    });

    describe('with missing data', () => {
      beforeEach(async () => {
        dialogConfigMock.data = undefined;
        await createComponent();
      });

      it('should close the dialog when data is missing', () => {
        expect(dialogRefSpy.close).toHaveBeenCalled();
      });
    });

    describe('with missing displayText', () => {
      beforeEach(async () => {
        dialogConfigMock.data = {};
        await createComponent();
      });

      it('should close the dialog when displayText is falsy', () => {
        expect(dialogRefSpy.close).toHaveBeenCalled();
      });
    });
  });
});
