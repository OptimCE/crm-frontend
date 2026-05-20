import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { vi } from 'vitest';

import {
  AllocationKeyDetailDTO,
  AllocationKeyPartialDTO,
  GenerationPartialDTO,
  GenerationStatus,
} from '../../../../../../shared/dtos/allocation_generation.dtos';
import { GenerationRow, KeyExpandState } from './generation-row';

// ── Helpers ──────────────────────────────────────────────────────────

function buildGeneration(overrides: Partial<GenerationPartialDTO> = {}): GenerationPartialDTO {
  return {
    id: 1,
    name: 'generation-1',
    status: GenerationStatus.PENDING,
    ...overrides,
  };
}

function buildKey(id: number): AllocationKeyPartialDTO {
  return { id, name: `key-${id}`, description: '', surplus_total: 0 };
}

function buildKeyDetail(id: number): AllocationKeyDetailDTO {
  return { ...buildKey(id), iterations: [] };
}

function buildExpandState(overrides: Partial<KeyExpandState> = {}): KeyExpandState {
  return {
    expandedKeyId: null,
    detailById: new Map(),
    loadingId: null,
    ...overrides,
  };
}

// ── Test Suite ───────────────────────────────────────────────────────

describe('GenerationRow', () => {
  let component: GenerationRow;
  let fixture: ComponentFixture<GenerationRow>;

  async function createWith(
    generation: GenerationPartialDTO = buildGeneration(),
    inputs: Partial<{
      expanded: boolean;
      keys: AllocationKeyPartialDTO[] | undefined;
      keysLoading: boolean;
      keyExpandState: KeyExpandState;
    }> = {},
  ): Promise<void> {
    fixture = TestBed.createComponent(GenerationRow);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('generation', generation);
    fixture.componentRef.setInput('expanded', inputs.expanded ?? false);
    if (inputs.keys !== undefined) {
      fixture.componentRef.setInput('keys', inputs.keys);
    }
    if (inputs.keysLoading !== undefined) {
      fixture.componentRef.setInput('keysLoading', inputs.keysLoading);
    }
    if (inputs.keyExpandState !== undefined) {
      fixture.componentRef.setInput('keyExpandState', inputs.keyExpandState);
    }
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GenerationRow, TranslateModule.forRoot()],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(GenerationRow, {
        set: { template: '' },
      })
      .compileComponents();
  });

  // ── 1. Creation ────────────────────────────────────────────────────

  describe('creation', () => {
    it('should create the component', async () => {
      await createWith();
      expect(component).toBeTruthy();
    });
  });

  // ── 2. statusKey computed ──────────────────────────────────────────

  describe('statusKey', () => {
    it('should return SUCCESS key for SUCCESS status', async () => {
      await createWith(buildGeneration({ status: GenerationStatus.SUCCESS }));
      expect(component.statusKey()).toBe('ALGORITHM_HUB.STATUS.SUCCESS');
    });

    it('should return FAILED key for FAILED status', async () => {
      await createWith(buildGeneration({ status: GenerationStatus.FAILED }));
      expect(component.statusKey()).toBe('ALGORITHM_HUB.STATUS.FAILED');
    });

    it('should return PENDING key for PENDING status', async () => {
      await createWith(buildGeneration({ status: GenerationStatus.PENDING }));
      expect(component.statusKey()).toBe('ALGORITHM_HUB.STATUS.PENDING');
    });
  });

  // ── 3. Outputs ─────────────────────────────────────────────────────

  describe('outputs', () => {
    it('onToggle should emit the generation id', async () => {
      await createWith(buildGeneration({ id: 7 }));
      const spy = vi.fn();
      component.toggled.subscribe(spy);
      component.onToggle();
      expect(spy).toHaveBeenCalledWith(7);
    });

    it('onDelete should stop event propagation and emit the generation id', async () => {
      await createWith(buildGeneration({ id: 9 }));
      const spy = vi.fn();
      component.deleteGeneration.subscribe(spy);
      const stopPropagation = vi.fn();
      const event = { stopPropagation } as unknown as MouseEvent;
      component.onDelete(event);
      expect(stopPropagation).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(9);
    });

    it('onToggleKey should emit the key id', async () => {
      await createWith();
      const spy = vi.fn();
      component.toggleKey.subscribe(spy);
      component.onToggleKey(123);
      expect(spy).toHaveBeenCalledWith(123);
    });

    it('onSaveKey should emit the key id', async () => {
      await createWith();
      const spy = vi.fn();
      component.saveKey.subscribe(spy);
      component.onSaveKey(456);
      expect(spy).toHaveBeenCalledWith(456);
    });

    it('onDeleteKey should emit the key id', async () => {
      await createWith();
      const spy = vi.fn();
      component.deleteKey.subscribe(spy);
      component.onDeleteKey(789);
      expect(spy).toHaveBeenCalledWith(789);
    });
  });

  // ── 4. keyExpandState helpers ──────────────────────────────────────

  describe('keyExpandState helpers', () => {
    it('isKeyExpanded should return true when expandedKeyId matches', async () => {
      await createWith(buildGeneration(), {
        keyExpandState: buildExpandState({ expandedKeyId: 11 }),
      });
      expect(component.isKeyExpanded(11)).toBe(true);
      expect(component.isKeyExpanded(12)).toBe(false);
    });

    it('isKeyExpanded should return false when no key is expanded', async () => {
      await createWith(buildGeneration(), { keyExpandState: buildExpandState() });
      expect(component.isKeyExpanded(11)).toBe(false);
    });

    it('isKeyLoading should return true when loadingId matches', async () => {
      await createWith(buildGeneration(), {
        keyExpandState: buildExpandState({ loadingId: 22 }),
      });
      expect(component.isKeyLoading(22)).toBe(true);
      expect(component.isKeyLoading(33)).toBe(false);
    });

    it('detailFor should return the detail when present', async () => {
      const detail = buildKeyDetail(44);
      await createWith(buildGeneration(), {
        keyExpandState: buildExpandState({ detailById: new Map([[44, detail]]) }),
      });
      expect(component.detailFor(44)).toBe(detail);
    });

    it('detailFor should return undefined when missing', async () => {
      await createWith(buildGeneration(), { keyExpandState: buildExpandState() });
      expect(component.detailFor(99)).toBeUndefined();
    });
  });

  // ── 5. Default inputs ──────────────────────────────────────────────

  describe('default inputs', () => {
    it('should default keysLoading to false and keys to undefined', async () => {
      await createWith();
      expect(component.keysLoading()).toBe(false);
      expect(component.keys()).toBeUndefined();
    });

    it('should default keyExpandState to a no-op snapshot', async () => {
      await createWith();
      const state = component.keyExpandState();
      expect(state.expandedKeyId).toBeNull();
      expect(state.loadingId).toBeNull();
      expect(state.detailById.size).toBe(0);
    });
  });
});
