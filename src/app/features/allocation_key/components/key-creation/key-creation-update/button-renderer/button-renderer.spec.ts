import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { vi } from 'vitest';

import { ButtonRenderer } from './button-renderer';
import { ICellRendererParams } from 'ag-grid-community';

// ── Helpers ────────────────────────────────────────────────────────

interface ButtonRendererParams extends ICellRendererParams {
  label: string;
  onClick: (params: { event: MouseEvent; rowData: unknown }) => void;
}

function buildParams(overrides: Partial<ButtonRendererParams> = {}): ButtonRendererParams {
  return {
    label: 'Delete',
    onClick: vi.fn(),
    value: null,
    valueFormatted: null,
    data: { id: 1 },
    node: { data: { id: 1 } } as unknown as ICellRendererParams['node'],
    colDef: {} as ICellRendererParams['colDef'],
    column: {} as ICellRendererParams['column'],
    api: {} as ICellRendererParams['api'],
    context: undefined,
    eGridCell: document.createElement('div'),
    eParentOfValue: document.createElement('div'),
    formatValue: vi.fn(),
    getValue: vi.fn(),
    setValue: vi.fn(),
    refreshCell: vi.fn(),
    registerRowDragger: vi.fn(),
    setTooltip: vi.fn(),
    rowIndex: 0,
    fullWidth: false,
    pinned: null,
    ...overrides,
  } as unknown as ButtonRendererParams;
}

// ── Test Suite ─────────────────────────────────────────────────────

describe('ButtonRenderer', () => {
  let component: ButtonRenderer;
  let fixture: ComponentFixture<ButtonRenderer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonRenderer],
    })
      .overrideComponent(ButtonRenderer, {
        add: { schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ButtonRenderer);
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

  it('should have undefined params and null label by default', () => {
    expect(component.params()).toBeUndefined();
    expect(component.label()).toBeNull();
  });

  // ── 2. agInit ───────────────────────────────────────────────────

  describe('agInit', () => {
    it('should set params signal', () => {
      const params = buildParams();
      component.agInit(params);
      expect(component.params()).toBe(params);
    });

    it('should set label from params', () => {
      component.agInit(buildParams({ label: 'Remove' }));
      expect(component.label()).toBe('Remove');
    });

    it('should default label to null when params.label is empty', () => {
      component.agInit(buildParams({ label: '' }));
      expect(component.label()).toBeNull();
    });
  });

  // ── 3. refresh ──────────────────────────────────────────────────

  describe('refresh', () => {
    it('should return true', () => {
      expect(component.refresh({})).toBe(true);
    });
  });

  // ── 4. onClick ──────────────────────────────────────────────────

  describe('onClick', () => {
    it('should call params.onClick with event and rowData', () => {
      const onClickSpy = vi.fn();
      const rowData = { id: 42, name: 'Test' };
      const params = buildParams({
        onClick: onClickSpy,
        node: { data: rowData } as unknown as ICellRendererParams['node'],
      });
      component.agInit(params);

      const event = new MouseEvent('click');
      component.onClick(event);

      expect(onClickSpy).toHaveBeenCalledWith({ event, rowData });
    });

    it('should do nothing when params is undefined', () => {
      expect(() => component.onClick(new MouseEvent('click'))).not.toThrow();
    });
  });

  // ── 5. Template rendering ───────────────────────────────────────

  describe('template', () => {
    it('should render a p-button element', () => {
      component.agInit(buildParams({ label: 'Delete' }));
      fixture.detectChanges();
      const button = (fixture.nativeElement as HTMLElement).querySelector('p-button');
      expect(button).toBeTruthy();
    });
  });
});
