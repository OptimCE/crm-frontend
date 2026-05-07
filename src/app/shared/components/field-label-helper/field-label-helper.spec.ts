import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { Popover } from 'primeng/popover';
import { vi } from 'vitest';

import { FieldLabelHelper } from './field-label-helper';

describe('FieldLabelHelper', () => {
  let component: FieldLabelHelper;
  let fixture: ComponentFixture<FieldLabelHelper>;

  async function createComponent(
    inputs: {
      label?: string;
      tooltip?: string;
      forId?: string;
      required?: boolean;
    } = {},
  ): Promise<void> {
    fixture = TestBed.createComponent(FieldLabelHelper);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('label', inputs.label ?? 'Test label');
    fixture.componentRef.setInput('tooltip', inputs.tooltip ?? 'Test tooltip');
    if (inputs.forId !== undefined) {
      fixture.componentRef.setInput('forId', inputs.forId);
    }
    if (inputs.required !== undefined) {
      fixture.componentRef.setInput('required', inputs.required);
    }
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FieldLabelHelper, TranslateModule.forRoot()],
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

  // ── 2. Label rendering ───────────────────────────────────────────────

  describe('label rendering', () => {
    it('renders a <label> element when forId is provided', async () => {
      await createComponent({ forId: 'myInput' });
      const label = (fixture.nativeElement as HTMLElement).querySelector<HTMLLabelElement>('label');
      expect(label).toBeTruthy();
      expect(label?.getAttribute('for')).toBe('myInput');
    });

    it('renders a <span> element when forId is omitted', async () => {
      await createComponent();
      const span = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
        'span.field-label',
      );
      expect(span).toBeTruthy();
      expect((fixture.nativeElement as HTMLElement).querySelector('label')).toBeNull();
    });

    it('shows the label text', async () => {
      await createComponent({ label: 'Withdrawal power (kVA)' });
      const host = fixture.nativeElement as HTMLElement;
      expect(host.textContent).toContain('Withdrawal power (kVA)');
    });

    it('shows * when required is true', async () => {
      await createComponent({ required: true });
      const host = fixture.nativeElement as HTMLElement;
      expect(host.textContent).toContain('*');
    });

    it('hides * when required is false', async () => {
      await createComponent({ required: false });
      const host = fixture.nativeElement as HTMLElement;
      expect(host.textContent).not.toContain('*');
    });
  });

  // ── 3. onClick ──────────────────────────────────────────────────────

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

  // ── 4. Popover state ────────────────────────────────────────────────

  describe('popover state', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('sets isOpen to true on popover show', () => {
      component.isOpen.set(true);
      expect(component.isOpen()).toBe(true);
    });

    it('sets isOpen to false on popover hide', () => {
      component.isOpen.set(true);
      component.isOpen.set(false);
      expect(component.isOpen()).toBe(false);
    });
  });
});
