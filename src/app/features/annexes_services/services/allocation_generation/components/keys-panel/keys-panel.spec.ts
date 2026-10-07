import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LangChangeEvent, TranslateService } from '@ngx-translate/core';
import { createGrid, GridApi, IHeaderComp } from 'ag-grid-community';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';

import {
  AllocationKeyDetailDTO,
  AllocationKeyPartialDTO,
} from '../../../../../../shared/dtos/allocation_generation.dtos';
import { HeaderWithHelper } from '../../../../../allocation_key/components/key-view/header-with-helper/header-with-helper';
import { registerAllocationGenerationAgGridModules } from '../../ag-grid-setup';
import { KeysPanel } from './keys-panel';

// ── Helpers ──────────────────────────────────────────────────────────

/** French thousands separator (narrow no-break space) and percent-sign space. */
const NNBSP = String.fromCharCode(0x202f);
const NBSP = String.fromCharCode(0xa0);

/** The colDef properties AG Grid ties to TooltipModule (COLUMN_DEFINITION_MOD_VALIDATIONS). */
const TOOLTIP_MODULE_PROPS: readonly string[] = [
  'headerTooltip',
  'headerTooltipValueGetter',
  'tooltipField',
  'tooltipValueGetter',
  'tooltipComponentSelector',
];

/** Stands in for HeaderWithHelper, an Angular component that a vanilla grid cannot render. */
class StubHeader implements IHeaderComp {
  private readonly gui = document.createElement('span');

  getGui(): HTMLElement {
    return this.gui;
  }

  refresh(): boolean {
    return true;
  }
}

function buildKey(overrides: Partial<AllocationKeyPartialDTO> = {}): AllocationKeyPartialDTO {
  return {
    id: 1,
    name: 'key-1',
    description: 'desc',
    surplus_total: 12.345,
    ...overrides,
  };
}

function buildDetail(): AllocationKeyDetailDTO {
  return {
    ...buildKey(),
    iterations: [
      {
        id: 1,
        number: 1,
        energy_allocated_percentage: 0.5,
        surplus_total: 0,
        consumers: [
          { id: 10, name: 'Consumer A', energy_allocated_percentage: 0.6 },
          { id: 11, name: 'Consumer B', energy_allocated_percentage: 0.4 },
        ],
      },
      {
        id: 2,
        number: 2,
        energy_allocated_percentage: 0.25,
        surplus_total: 0,
        consumers: [{ id: 12, name: 'Consumer C', energy_allocated_percentage: -1 }],
      },
    ],
  };
}

// ── Test Suite ───────────────────────────────────────────────────────

describe('KeysPanel', () => {
  let component: KeysPanel;
  let fixture: ComponentFixture<KeysPanel>;
  let translateSpy: {
    get: ReturnType<typeof vi.fn>;
    instant: ReturnType<typeof vi.fn>;
    getCurrentLang: ReturnType<typeof vi.fn>;
    onLangChange: Subject<LangChangeEvent>;
    onTranslationChange: { subscribe: ReturnType<typeof vi.fn> };
    onDefaultLangChange: { subscribe: ReturnType<typeof vi.fn> };
  };

  async function createWith(
    inputs: Partial<{
      key: AllocationKeyPartialDTO;
      expanded: boolean;
      detail: AllocationKeyDetailDTO | undefined;
      detailLoading: boolean;
    }> = {},
  ): Promise<void> {
    fixture = TestBed.createComponent(KeysPanel);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('key', inputs.key ?? buildKey());
    fixture.componentRef.setInput('expanded', inputs.expanded ?? false);
    if (inputs.detail !== undefined) {
      fixture.componentRef.setInput('detail', inputs.detail);
    }
    if (inputs.detailLoading !== undefined) {
      fixture.componentRef.setInput('detailLoading', inputs.detailLoading);
    }
    await fixture.whenStable();
  }

  beforeEach(async () => {
    translateSpy = {
      // Reflect the keys back as their own translations so we can assert headerName.
      get: vi.fn((keys: string[]) =>
        of(Object.fromEntries(keys.map((k) => [k, k])) as Record<string, string>),
      ),
      instant: vi.fn((k: string) => k),
      // The reader's language: English, so the figures below read as English.
      getCurrentLang: vi.fn(() => 'en'),
      onLangChange: new Subject<LangChangeEvent>(),
      onTranslationChange: { subscribe: vi.fn() },
      onDefaultLangChange: { subscribe: vi.fn() },
    };

    await TestBed.configureTestingModule({
      imports: [KeysPanel],
      providers: [{ provide: TranslateService, useValue: translateSpy }],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(KeysPanel, { set: { template: '' } })
      .compileComponents();
  });

  // ── 1. Creation ────────────────────────────────────────────────────

  describe('creation', () => {
    it('should create the component', async () => {
      await createWith();
      expect(component).toBeTruthy();
    });

    it('should load column definitions from TranslateService.get', async () => {
      await createWith();
      expect(translateSpy.get).toHaveBeenCalledTimes(1);
      const defs = component.colDefs();
      expect(defs).toHaveLength(4);
      expect(defs.map((d) => d.field)).toEqual([
        'number',
        'va_percentage',
        'name',
        'vp_percentage',
      ]);
    });

    it('should use translated header names', async () => {
      await createWith();
      const defs = component.colDefs();
      expect(defs[0].headerName).toBe('KEY.TABLE.COLUMNS.ITERATION_NUMBER_LABEL');
      expect(defs[1].headerName).toBe('KEY.TABLE.COLUMNS.VA_PERCENTAGE_LABEL');
      expect(defs[2].headerName).toBe('KEY.TABLE.COLUMNS.CONSUMER_NAME_LABEL');
      expect(defs[3].headerName).toBe('KEY.TABLE.COLUMNS.CONSUMER_VAP_LABEL');
    });
  });

  // ── 2. surplusFormatted ────────────────────────────────────────────

  describe('surplusFormatted', () => {
    it('should format a finite surplus to 2 decimals', async () => {
      await createWith({ key: buildKey({ surplus_total: 12.345 }) });
      expect(component.surplusFormatted()).toBe('12.35');
    });

    it('should format zero correctly', async () => {
      await createWith({ key: buildKey({ surplus_total: 0 }) });
      expect(component.surplusFormatted()).toBe('0.00');
    });

    it("should write the surplus in the reader's language", async () => {
      // BUG: `toFixed(2)` wrote a decimal point, and no grouping, in every language.
      translateSpy.getCurrentLang.mockReturnValue('fr');
      await createWith({ key: buildKey({ surplus_total: 1234.5 }) });
      expect(component.surplusFormatted()).toBe(`1${NNBSP}234,50`);
    });

    it('should return em dash for non-finite values', async () => {
      await createWith({ key: buildKey({ surplus_total: NaN as unknown as number }) });
      expect(component.surplusFormatted()).toBe('—');
    });
  });

  // ── 3. rowData ─────────────────────────────────────────────────────

  describe('rowData', () => {
    it('should return empty array when detail is undefined', async () => {
      await createWith();
      expect(component.rowData()).toEqual([]);
    });

    it('should flatten iterations and their consumers into rows', async () => {
      await createWith({ detail: buildDetail() });
      const rows = component.rowData();
      expect(rows).toHaveLength(3);
      expect(rows.map((r) => r.name)).toEqual(['Consumer A', 'Consumer B', 'Consumer C']);
    });

    it('should set iteration number/va_percentage only on the first row of each iteration', async () => {
      await createWith({ detail: buildDetail() });
      const rows = component.rowData();
      expect(rows[0].number).toBe(1);
      expect(rows[0].va_percentage).toBe('50.00%');
      expect(rows[1].number).toBeUndefined();
      expect(rows[1].va_percentage).toBeUndefined();
      expect(rows[2].number).toBe(2);
      expect(rows[2].va_percentage).toBe('25.00%');
    });

    it('should format consumer percentages and use the prorata label for -1', async () => {
      translateSpy.instant.mockImplementation((k: string) => `T(${k})`);
      await createWith({ detail: buildDetail() });
      const rows = component.rowData();
      expect(rows[0].vp_percentage).toBe('60.00%');
      expect(rows[1].vp_percentage).toBe('40.00%');
      expect(rows[2].vp_percentage).toBe('T(KEY.CREATE.PRORATA_LABEL)');
    });

    it("should write the percentages in the reader's language", async () => {
      // BUG: `toFixed(2) + '%'` wrote "50.00%" whatever the language.
      translateSpy.getCurrentLang.mockReturnValue('fr');
      await createWith({ detail: buildDetail() });
      const rows = component.rowData();
      expect(rows[0].va_percentage).toBe(`50,00${NBSP}%`);
      expect(rows[0].vp_percentage).toBe(`60,00${NBSP}%`);
    });

    it('should rewrite the rows when the reader switches language', async () => {
      await createWith({ detail: buildDetail() });
      expect(component.rowData()[0].va_percentage).toBe('50.00%');

      translateSpy.onLangChange.next({ lang: 'de', translations: {} });

      expect(component.rowData()[0].va_percentage).toBe(`50,00${NBSP}%`);
    });

    it('should track the iteration index on each row for color gradient', async () => {
      await createWith({ detail: buildDetail() });
      const rows = component.rowData();
      expect(rows[0].__iterationIndex).toBe(0);
      expect(rows[1].__iterationIndex).toBe(0);
      expect(rows[2].__iterationIndex).toBe(1);
    });
  });

  // ── 4. Outputs ─────────────────────────────────────────────────────

  describe('outputs', () => {
    it('onToggle should emit', async () => {
      await createWith();
      const spy = vi.fn();
      component.toggled.subscribe(spy);
      component.onToggle();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('onSave should stop propagation and emit', async () => {
      await createWith();
      const spy = vi.fn();
      component.save.subscribe(spy);
      const stopPropagation = vi.fn();
      const event = { stopPropagation } as unknown as MouseEvent;
      component.onSave(event);
      expect(stopPropagation).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('onDelete should stop propagation and emit', async () => {
      await createWith();
      const spy = vi.fn();
      component.delete.subscribe(spy);
      const stopPropagation = vi.fn();
      const event = { stopPropagation } as unknown as MouseEvent;
      component.onDelete(event);
      expect(stopPropagation).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  // ── 5. defaultColDef ───────────────────────────────────────────────

  describe('defaultColDef', () => {
    it('should expose width, flex and minWidth defaults', async () => {
      await createWith();
      expect(component.defaultColDef.width).toBe(200);
      expect(component.defaultColDef.flex).toBe(1);
      expect(component.defaultColDef.minWidth).toBe(120);
    });
  });

  // ── 6. AG Grid modules ─────────────────────────────────────────────

  describe('AG Grid modules', () => {
    let api: GridApi | undefined;

    afterEach(() => {
      api?.destroy();
      api = undefined;
      vi.restoreAllMocks();
    });

    // A colDef property whose module is missing does nothing, and AG Grid logs "error #200", in
    // production too. Spec files share AG Grid's registry (isolate: false), so this cannot see a
    // module that another spec registered first: allocation_key's specs register Tooltip.
    it('should need no AG Grid module beyond the ones the feature registers', async () => {
      await createWith({ detail: buildDetail() });
      registerAllocationGenerationAgGridModules();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      // The grid options of keys-panel.html.
      api = createGrid(document.createElement('div'), {
        columnDefs: component
          .colDefs()
          .map((def) => (def.headerComponent ? { ...def, headerComponent: StubHeader } : def)),
        rowData: component.rowData(),
        defaultColDef: component.defaultColDef,
        domLayout: 'autoHeight',
      });

      const missingModules = consoleError.mock.calls
        .map((args) => args.map(String).join(' '))
        .filter((message) => message.includes('error #200'));
      expect(missingModules).toEqual([]);
    });

    it('should leave the header help to HeaderWithHelper', async () => {
      await createWith();
      const help = component
        .colDefs()
        .filter((def) => def.headerComponent === HeaderWithHelper)
        .map((def) => [def.field, (def.headerComponentParams as { tooltip: string }).tooltip]);
      expect(help).toEqual([
        ['number', 'KEY.TABLE.COLUMNS.ITERATION_TOOLTIP'],
        ['va_percentage', 'KEY.TABLE.COLUMNS.VA_PERCENTAGE_TOOLTIP'],
        ['vp_percentage', 'KEY.TABLE.COLUMNS.CONSUMER_VAP_TOOLTIP'],
      ]);

      // BUG: headerTooltip repeated that text, but it needs TooltipModule, which this feature does
      // not register: the grid logged "error #200", or showed a second tooltip once /keys had
      // registered the module. The grid above is blind to it after such a leak, so check here.
      const tooltipProps = component
        .colDefs()
        .flatMap((def) => TOOLTIP_MODULE_PROPS.filter((prop) => prop in def));
      expect(tooltipProps).toEqual([]);
    });
  });
});
