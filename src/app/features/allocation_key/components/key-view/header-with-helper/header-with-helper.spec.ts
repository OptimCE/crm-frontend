import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { IHeaderParams } from 'ag-grid-community';
import { Popover } from 'primeng/popover';
import { vi } from 'vitest';

import { HeaderWithHelper } from './header-with-helper';

type HeaderWithHelperParams = IHeaderParams & {
  tooltip?: string;
  label?: string;
};

describe('HeaderWithHelper', () => {
  let component: HeaderWithHelper;
  let fixture: ComponentFixture<HeaderWithHelper>;

  async function createComponent(): Promise<void> {
    fixture = TestBed.createComponent(HeaderWithHelper);
    component = fixture.componentInstance;
    fixture.detectChanges();
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

    it('should default isOpen to false', () => {
      expect(component.isOpen()).toBe(false);
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

    it('should render the label in the header text', () => {
      component.agInit({
        label: 'My Column',
        tooltip: 'desc',
      } as unknown as HeaderWithHelperParams);
      fixture.detectChanges();

      const text = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
        '[data-testid="header-helper__label--text"]',
      );
      expect(text?.textContent?.trim()).toBe('My Column');
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

    it('should toggle the popover when clicked', () => {
      const toggleSpy = vi.fn();
      const popoverStub = { toggle: toggleSpy } as unknown as Popover;
      vi.spyOn(component, 'popover').mockReturnValue(popoverStub);

      const event = new MouseEvent('click');
      component.onClick(event);

      expect(toggleSpy).toHaveBeenCalledWith(event);
    });

    it('should stop event propagation', () => {
      const popoverStub = { toggle: vi.fn() } as unknown as Popover;
      vi.spyOn(component, 'popover').mockReturnValue(popoverStub);

      const event = new MouseEvent('click');
      const stopSpy = vi.spyOn(event, 'stopPropagation');

      component.onClick(event);

      expect(stopSpy).toHaveBeenCalled();
    });

    it('should not throw when popover is undefined', () => {
      vi.spyOn(component, 'popover').mockReturnValue(undefined);
      expect(() => component.onClick(new MouseEvent('click'))).not.toThrow();
    });
  });
});
