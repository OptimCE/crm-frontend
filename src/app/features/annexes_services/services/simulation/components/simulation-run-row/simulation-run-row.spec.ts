import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { vi } from 'vitest';

import {
  SimulationDetailDTO,
  SimulationPartialDTO,
  SimulationStatus,
} from '../../../../../../shared/dtos/simulation.dtos';
import { SimulationRunRow } from './simulation-run-row';

// ── Helpers ──────────────────────────────────────────────────────────

function buildRun(overrides: Partial<SimulationPartialDTO> = {}): SimulationPartialDTO {
  return {
    id: 1,
    name: 'run-1',
    status: SimulationStatus.PENDING,
    id_key: 10,
    key_name: 'key-10',
    ...overrides,
  };
}

// ── Test Suite ───────────────────────────────────────────────────────

describe('SimulationRunRow', () => {
  let component: SimulationRunRow;
  let fixture: ComponentFixture<SimulationRunRow>;

  async function createWith(
    run: SimulationPartialDTO = buildRun(),
    inputs: Partial<{
      expanded: boolean;
      detail: SimulationDetailDTO | undefined;
      detailLoading: boolean;
    }> = {},
  ): Promise<void> {
    fixture = TestBed.createComponent(SimulationRunRow);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('run', run);
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
    await TestBed.configureTestingModule({
      imports: [SimulationRunRow, TranslateModule.forRoot()],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(SimulationRunRow, { set: { template: '' } })
      .compileComponents();
  });

  // ── 1. Creation ────────────────────────────────────────────────────

  describe('creation', () => {
    it('should create the component', async () => {
      await createWith();
      expect(component).toBeTruthy();
    });
  });

  // ── 2. variant computed ────────────────────────────────────────────

  describe('variant', () => {
    it('should return "success" for SUCCESS status', async () => {
      await createWith(buildRun({ status: SimulationStatus.SUCCESS }));
      expect(component.variant()).toBe('success');
    });

    it('should return "failed" for FAILED status', async () => {
      await createWith(buildRun({ status: SimulationStatus.FAILED }));
      expect(component.variant()).toBe('failed');
    });

    it('should return "pending" for PENDING status', async () => {
      await createWith(buildRun({ status: SimulationStatus.PENDING }));
      expect(component.variant()).toBe('pending');
    });
  });

  // ── 3. statusKey computed ──────────────────────────────────────────

  describe('statusKey', () => {
    it('should return SUCCESS key for SUCCESS status', async () => {
      await createWith(buildRun({ status: SimulationStatus.SUCCESS }));
      expect(component.statusKey()).toBe('SIMULATION_HUB.STATUS.SUCCESS');
    });

    it('should return FAILED key for FAILED status', async () => {
      await createWith(buildRun({ status: SimulationStatus.FAILED }));
      expect(component.statusKey()).toBe('SIMULATION_HUB.STATUS.FAILED');
    });

    it('should return PENDING key for PENDING status', async () => {
      await createWith(buildRun({ status: SimulationStatus.PENDING }));
      expect(component.statusKey()).toBe('SIMULATION_HUB.STATUS.PENDING');
    });
  });

  // ── 4. Default inputs ──────────────────────────────────────────────

  describe('default inputs', () => {
    it('should default detail to undefined and detailLoading to false', async () => {
      await createWith();
      expect(component.detail()).toBeUndefined();
      expect(component.detailLoading()).toBe(false);
    });

    it('should expose the provided optional inputs', async () => {
      const detail = {
        ...buildRun(),
        error_message: null,
        has_timeseries: false,
        key_result: null,
      };
      await createWith(buildRun(), { detail, detailLoading: true });
      expect(component.detail()).toBe(detail);
      expect(component.detailLoading()).toBe(true);
    });
  });

  // ── 5. Outputs ─────────────────────────────────────────────────────

  describe('outputs', () => {
    it('toggled should emit a run id to subscribers', async () => {
      await createWith(buildRun({ id: 7 }));
      const spy = vi.fn();
      component.toggled.subscribe(spy);
      component.toggled.emit(component.run().id);
      expect(spy).toHaveBeenCalledWith(7);
    });

    it('deleteRun should emit a run id to subscribers', async () => {
      await createWith(buildRun({ id: 9 }));
      const spy = vi.fn();
      component.deleteRun.subscribe(spy);
      component.deleteRun.emit(component.run().id);
      expect(spy).toHaveBeenCalledWith(9);
    });
  });
});
