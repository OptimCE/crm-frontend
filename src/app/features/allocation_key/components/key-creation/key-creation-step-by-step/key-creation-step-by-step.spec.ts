import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { vi } from 'vitest';

import { KeyCreationStepByStep } from './key-creation-step-by-step';
import { BackArrow } from '../../../../../layout/back-arrow/back-arrow';
import { EventBusService } from '../../../../../core/services/event_bus/eventbus.service';
import { SnackbarNotification } from '../../../../../shared/services-ui/snackbar.notifcation.service';
import { ERROR_TYPE } from '../../../../../core/dtos/notification';

@Component({ selector: 'app-back-arrow', standalone: true, template: '' })
class BackArrowStub {
  readonly url = input.required<string>();
  readonly text = input.required<string>();
}

describe('KeyCreationStepByStep', () => {
  let component: KeyCreationStepByStep;
  let fixture: ComponentFixture<KeyCreationStepByStep>;
  let eventBusSpy: { emit: ReturnType<typeof vi.fn> };
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };
  let translateSpy: { instant: ReturnType<typeof vi.fn> };
  let snackbarSpy: { openSnackBar: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    eventBusSpy = { emit: vi.fn() };
    routerSpy = { navigate: vi.fn().mockResolvedValue(true) };
    translateSpy = { instant: vi.fn((key: string) => key) };
    snackbarSpy = { openSnackBar: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [KeyCreationStepByStep],
      providers: [
        { provide: EventBusService, useValue: eventBusSpy },
        { provide: Router, useValue: routerSpy },
        { provide: TranslateService, useValue: translateSpy },
        { provide: SnackbarNotification, useValue: snackbarSpy },
      ],
    })
      .overrideComponent(KeyCreationStepByStep, {
        remove: { imports: [BackArrow] },
        add: { imports: [BackArrowStub] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(KeyCreationStepByStep);
    component = fixture.componentInstance;
    component.ngOnInit();
  });

  // ── Helpers ──────────────────────────────────────────────────────────

  /** Drive the component through step 1 with the given consumer count. */
  function completeFirstStep(count: number): void {
    component.formFirstStep.patchValue({ nb_consumers: count });
    component.submitFirstForm();
  }

  /** Drive the component through step 2 with auto-generated names. */
  function completeSecondStep(count: number): void {
    completeFirstStep(count);
    for (let i = 0; i < count; i++) {
      component.formSecondStep.patchValue({ [`consumer_name_${i}`]: `Consumer ${i}` });
    }
    component.submitSecondForm();
  }

  /** Fill iteration forms with given (type, percentage) pairs and submit. */
  function fillIterations(pairs: [number, number][]): void {
    // Ensure we have the right number of iteration forms
    while (component.formIterations().length < pairs.length) {
      component.addIteration(component.formIterations().length);
    }
    pairs.forEach(([type, pct], i) => {
      component.formIterations()[i].patchValue({ type: String(type), inj_percentage: pct });
    });
  }

  // ── 1. Initialization ───────────────────────────────────────────────

  describe('ngOnInit', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should initialise formFirstStep with nb_consumers control', () => {
      const ctrl = component.formFirstStep.get('nb_consumers');
      expect(ctrl).toBeTruthy();
      if (!ctrl) throw new Error('Expected nb_consumers control to exist');
      // required + min(1) validators
      ctrl.setValue('');
      expect(ctrl.valid).toBe(false);
      ctrl.setValue(0);
      expect(ctrl.valid).toBe(false);
      ctrl.setValue(1);
      expect(ctrl.valid).toBe(true);
    });

    it('should initialise lastForm with key_name and key_description controls', () => {
      expect(component.lastForm.get('key_name')).toBeTruthy();
      expect(component.lastForm.get('key_description')).toBeTruthy();
      // both required
      expect(component.lastForm.valid).toBe(false);
      component.lastForm.patchValue({ key_name: 'K', key_description: 'D' });
      expect(component.lastForm.valid).toBe(true);
    });
  });

  // ── 2. submitFirstForm ──────────────────────────────────────────────

  describe('submitFirstForm', () => {
    it('should do nothing when form is invalid', () => {
      component.submitFirstForm();
      expect(component.secondStep()).toBe(false);
      expect(component.nbConsumers).toBe(-1);
    });

    it('should set nbConsumers and create formSecondStep on first valid submit', () => {
      completeFirstStep(3);
      expect(component.nbConsumers).toBe(3);
      expect(component.secondStep()).toBe(true);
      expect(Object.keys(component.formSecondStep.controls).length).toBe(3);
    });

    it('should add controls when consumer count increases', () => {
      completeFirstStep(2);
      expect(Object.keys(component.formSecondStep.controls).length).toBe(2);

      component.formFirstStep.patchValue({ nb_consumers: 4 });
      component.submitFirstForm();
      expect(component.nbConsumers).toBe(4);
      expect(Object.keys(component.formSecondStep.controls).length).toBe(4);
    });

    it('should remove controls when consumer count decreases', () => {
      completeFirstStep(4);
      expect(Object.keys(component.formSecondStep.controls).length).toBe(4);

      component.formFirstStep.patchValue({ nb_consumers: 2 });
      component.submitFirstForm();
      expect(component.nbConsumers).toBe(2);
      expect(Object.keys(component.formSecondStep.controls).length).toBe(2);
    });

    it('should splice consumers and recompute iterations when count decreases with existing iterations', () => {
      completeSecondStep(3);

      // Fill and submit iteration to populate component.iterations
      fillIterations([[2, 100]]);
      component.submitIteration();

      expect(component.iterations.length).toBeGreaterThan(0);
      const iterBefore = component.iterations.length;

      // Now decrease consumers
      component.formFirstStep.patchValue({ nb_consumers: 2 });
      component.submitFirstForm();

      expect(component.nbConsumers).toBe(2);
      // iterations should still exist but be recomputed
      expect(component.iterations.length).toBe(iterBefore);
      component.iterations.forEach((iter) => {
        expect(iter.consumers.length).toBe(2);
      });
    });
  });

  // ── 3. controls getter ──────────────────────────────────────────────

  describe('controls getter', () => {
    it('should return the keys of formSecondStep controls', () => {
      completeFirstStep(3);
      expect(component.controls).toEqual(['consumer_name_0', 'consumer_name_1', 'consumer_name_2']);
    });
  });

  // ── 4. submitSecondForm ─────────────────────────────────────────────

  describe('submitSecondForm', () => {
    it('should show snackbar error and return early if first step is invalid', () => {
      component.formFirstStep.patchValue({ nb_consumers: '' });
      component.submitSecondForm();
      expect(snackbarSpy.openSnackBar).toHaveBeenCalledWith(
        'KEY.ERRORS.FIRST_STEP_ERROR',
        ERROR_TYPE,
      );
    });

    it('should create consumers array from form values', () => {
      completeSecondStep(2);
      expect(component.consumers.length).toBe(2);
      expect(component.consumers[0].name).toBe('Consumer 0');
      expect(component.consumers[1].name).toBe('Consumer 1');
    });

    it('should create first iteration form group if none exist', () => {
      completeSecondStep(2);
      expect(component.formIterations().length).toBe(1);
    });

    it('should not add extra iteration forms on subsequent calls', () => {
      completeSecondStep(2);
      expect(component.formIterations().length).toBe(1);

      // Call again (e.g. user edits names)
      component.submitSecondForm();
      expect(component.formIterations().length).toBe(1);
    });
  });

  // ── 5. computeIteration ─────────────────────────────────────────────

  describe('computeIteration', () => {
    beforeEach(() => {
      completeSecondStep(3);
    });

    it('should set consumer percentages to -1 for prorata (type 1)', () => {
      const iter = component.computeIteration(1, 50, 1);
      iter.consumers.forEach((c) => {
        expect(c.energy_allocated_percentage).toBe(-1);
      });
    });

    it('should divide equally for egalitarian (type 2)', () => {
      const iter = component.computeIteration(2, 60, 1);
      iter.consumers.forEach((c) => {
        expect(c.energy_allocated_percentage).toBeCloseTo(1 / 3);
      });
    });

    it('should convert inj_percentage to decimal fraction', () => {
      const iter = component.computeIteration(1, 75, 1);
      expect(iter.energy_allocated_percentage).toBeCloseTo(0.75);
    });

    it('should deep copy consumers (no shared references)', () => {
      const iter = component.computeIteration(2, 50, 1);
      iter.consumers[0].name = 'MODIFIED';
      expect(component.consumers[0].name).not.toBe('MODIFIED');
    });

    it('should set the iteration number correctly', () => {
      const iter = component.computeIteration(1, 50, 3);
      expect(iter.number).toBe(3);
    });
  });

  // ── 6. addIteration ─────────────────────────────────────────────────

  describe('addIteration', () => {
    beforeEach(() => {
      completeSecondStep(2);
    });

    it('should add a new iteration form group', () => {
      expect(component.formIterations().length).toBe(1);
      component.addIteration(1);
      expect(component.formIterations().length).toBe(2);
    });

    it('should not exceed 3 iterations', () => {
      component.addIteration(1);
      component.addIteration(2);
      // Now at 3
      expect(component.formIterations().length).toBe(3);
      component.addIteration(3);
      expect(component.formIterations().length).toBe(3);
    });
  });

  // ── 7. getSumOfIter ─────────────────────────────────────────────────

  describe('getSumOfIter', () => {
    it('should return 0 when no iterations', () => {
      expect(component.getSumOfIter()).toBe(0);
    });

    it('should sum energy_allocated_percentage across iterations', () => {
      component.iterations = [
        { id: -1, number: 1, consumers: [], energy_allocated_percentage: 0.4 },
        { id: -1, number: 2, consumers: [], energy_allocated_percentage: 0.6 },
      ];
      expect(component.getSumOfIter()).toBeCloseTo(1.0);
    });
  });

  // ── 8. submitIteration ──────────────────────────────────────────────

  describe('submitIteration', () => {
    it('should show snackbar error if first step is invalid', () => {
      component.formFirstStep.patchValue({ nb_consumers: '' });
      component.submitIteration();
      expect(snackbarSpy.openSnackBar).toHaveBeenCalledWith(
        'KEY.ERRORS.FIRST_STEP_ERROR',
        ERROR_TYPE,
      );
    });

    it('should show snackbar error if second step is invalid', () => {
      completeFirstStep(2);
      // second step form controls are empty → invalid
      component.submitIteration();
      expect(snackbarSpy.openSnackBar).toHaveBeenCalledWith(
        'KEY.ERRORS.SECOND_STEP_ERROR',
        ERROR_TYPE,
      );
    });

    it('should return early if any iteration form is invalid', () => {
      completeSecondStep(2);
      // iteration form is empty → invalid
      component.submitIteration();
      expect(component.displayEnd()).toBe(false);
    });

    it('should set displayEnd to true when sum is ~100%', () => {
      completeSecondStep(2);
      fillIterations([[1, 100]]);
      component.submitIteration();
      expect(component.displayEnd()).toBe(true);
      expect(component.displayErrorInj()).toBe(false);
    });

    it('should set displayErrorInj when sum exceeds 101%', () => {
      completeSecondStep(2);
      fillIterations([[1, 50]]);
      component.submitIteration(); // 50% → auto-adds iter 2

      fillIterations([
        [1, 60],
        [1, 60],
      ]);
      component.submitIteration(); // 120% > 101%
      expect(component.displayErrorInj()).toBe(true);
    });

    it('should auto-add iteration when sum < 99% and fewer than 3 iterations', () => {
      completeSecondStep(2);
      fillIterations([[1, 30]]);
      component.submitIteration();
      // 30% < 99%, should have added another iteration form
      expect(component.formIterations().length).toBe(2);
      expect(component.displayEnd()).toBe(false);
    });

    it('should set displayErrorInj when sum < 99% and already 3 iterations', () => {
      completeSecondStep(2);
      fillIterations([
        [1, 10],
        [1, 10],
        [1, 10],
      ]);
      component.submitIteration(); // 30% < 99% but already 3 iters
      expect(component.displayErrorInj()).toBe(true);
    });
  });

  // ── 9. deleteIteration ──────────────────────────────────────────────

  describe('deleteIteration', () => {
    beforeEach(() => {
      completeSecondStep(2);
      component.addIteration(1);
      // Fill both iterations so component.iterations is populated
      fillIterations([
        [1, 50],
        [1, 50],
      ]);
      component.submitIteration();
    });

    it('should remove iteration at given index', () => {
      expect(component.formIterations().length).toBe(2);
      component.deleteIteration(0);
      expect(component.formIterations().length).toBe(1);
      expect(component.iterations.length).toBe(1);
    });

    it('should not remove if only 1 iteration remains', () => {
      component.deleteIteration(0);
      expect(component.formIterations().length).toBe(1);
      component.deleteIteration(0);
      expect(component.formIterations().length).toBe(1);
    });

    it('should reset displayErrorInj to false', () => {
      component.displayErrorInj.set(true);
      component.deleteIteration(0);
      expect(component.displayErrorInj()).toBe(false);
    });
  });

  // ── 10. submitKey ───────────────────────────────────────────────────

  describe('submitKey', () => {
    it('should show snackbar error if first step is invalid', () => {
      component.formFirstStep.patchValue({ nb_consumers: '' });
      component.submitKey();
      expect(snackbarSpy.openSnackBar).toHaveBeenCalledWith(
        'KEY.ERRORS.FIRST_STEP_ERROR',
        ERROR_TYPE,
      );
      expect(eventBusSpy.emit).not.toHaveBeenCalled();
    });

    it('should show snackbar error if second step is invalid', () => {
      completeFirstStep(2);
      component.submitKey();
      expect(snackbarSpy.openSnackBar).toHaveBeenCalledWith(
        'KEY.ERRORS.SECOND_STEP_ERROR',
        ERROR_TYPE,
      );
      expect(eventBusSpy.emit).not.toHaveBeenCalled();
    });

    it('should return early if iteration forms are invalid', () => {
      completeSecondStep(2);
      // iteration form still empty
      component.submitKey();
      expect(eventBusSpy.emit).not.toHaveBeenCalled();
    });

    it('should emit keyStepByStep event and navigate when all forms valid', () => {
      completeSecondStep(2);
      fillIterations([[2, 100]]);
      component.submitIteration(); // populates iterations, sets displayEnd

      component.lastForm.patchValue({ key_name: 'Test Key', key_description: 'Desc' });
      component.submitKey();

      expect(eventBusSpy.emit).toHaveBeenCalledWith(
        'keyStepByStep',
        expect.objectContaining({
          name: 'Test Key',
          description: 'Desc',
        }),
      );
      expect(routerSpy.navigate).toHaveBeenCalledWith(
        ['/keys/add'],
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        expect.objectContaining({
          state: expect.objectContaining({ keyData: expect.any(Object) }),
        }),
      );
    });

    it('should not emit or navigate if lastForm is invalid', () => {
      completeSecondStep(2);
      fillIterations([[2, 100]]);
      component.submitIteration();
      // lastForm still empty
      component.submitKey();
      expect(eventBusSpy.emit).not.toHaveBeenCalled();
      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });
  });
});
