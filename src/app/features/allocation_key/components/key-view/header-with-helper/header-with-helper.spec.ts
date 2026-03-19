import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { IHeaderParams } from 'ag-grid-community';
import { vi } from 'vitest';

import { HeaderWithHelper } from './header-with-helper';

type HeaderWithHelperParams = IHeaderParams & {
  tooltip?: string;
  label?: string;
  click?: (tooltip: string) => void;
};

describe('HeaderWithHelper', () => {
  let component: HeaderWithHelper;
  let fixture: ComponentFixture<HeaderWithHelper>;

  async function createComponent(): Promise<void> {
    fixture = TestBed.createComponent(HeaderWithHelper);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderWithHelper, TranslateModule.forRoot()],
    }).compileComponents();
  });

  // ── 1. Creation ─────────────────────────────────────────────────────

  describe('creation', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should create the component', () => {
      expect(component).toBeTruthy();
    });
  });

  // ── 2. agInit ───────────────────────────────────────────────────────

  describe('agInit', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should set params signal with label', () => {
      component.agInit({
        label: 'Test Label',
        tooltip: 'Tip',
      } as unknown as HeaderWithHelperParams);
      expect(component.params()?.label).toBe('Test Label');
    });

    it('should set params signal with tooltip', () => {
      component.agInit({
        label: 'L',
        tooltip: 'Help tooltip',
      } as unknown as HeaderWithHelperParams);
      expect(component.params()?.tooltip).toBe('Help tooltip');
    });
  });

  // ── 3. refresh ──────────────────────────────────────────────────────

  describe('refresh', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should return true', () => {
      expect(component.refresh({} as IHeaderParams)).toBe(true);
    });
  });

  // ── 4. onClick ──────────────────────────────────────────────────────

  describe('onClick', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should call params.click with tooltip when tooltip exists', () => {
      const clickSpy = vi.fn();
      component.agInit({
        tooltip: 'Help text',
        click: clickSpy,
      } as unknown as HeaderWithHelperParams);
      component.onClick();
      expect(clickSpy).toHaveBeenCalledWith('Help text');
    });

    it('should not call click when tooltip is undefined', () => {
      const clickSpy = vi.fn();
      component.agInit({ click: clickSpy } as unknown as HeaderWithHelperParams);
      component.onClick();
      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('should not throw when click function is undefined', () => {
      component.agInit({ tooltip: 'text' } as unknown as HeaderWithHelperParams);
      expect(() => component.onClick()).not.toThrow();
    });

    it('should not throw when params is undefined', () => {
      expect(() => component.onClick()).not.toThrow();
    });
  });
});
