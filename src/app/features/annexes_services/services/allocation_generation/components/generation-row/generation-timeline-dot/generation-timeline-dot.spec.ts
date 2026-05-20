import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GenerationStatus } from '../../../../../../../shared/dtos/allocation_generation.dtos';
import { GenerationTimelineDot } from './generation-timeline-dot';

describe('GenerationTimelineDot', () => {
  let component: GenerationTimelineDot;
  let fixture: ComponentFixture<GenerationTimelineDot>;

  async function setupWith(status: GenerationStatus, label?: string): Promise<void> {
    fixture = TestBed.createComponent(GenerationTimelineDot);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('status', status);
    if (label !== undefined) {
      fixture.componentRef.setInput('label', label);
    }
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GenerationTimelineDot],
    }).compileComponents();
  });

  // ── 1. Creation ────────────────────────────────────────────────────

  describe('creation', () => {
    it('should create the component', async () => {
      await setupWith(GenerationStatus.PENDING);
      expect(component).toBeTruthy();
    });
  });

  // ── 2. variant computed ────────────────────────────────────────────

  describe('variant', () => {
    it('should map SUCCESS to "success"', async () => {
      await setupWith(GenerationStatus.SUCCESS);
      expect(component.variant()).toBe('success');
    });

    it('should map FAILED to "failed"', async () => {
      await setupWith(GenerationStatus.FAILED);
      expect(component.variant()).toBe('failed');
    });

    it('should map PENDING to "pending"', async () => {
      await setupWith(GenerationStatus.PENDING);
      expect(component.variant()).toBe('pending');
    });
  });

  // ── 3. Rendering ───────────────────────────────────────────────────

  describe('rendering', () => {
    function dot(): HTMLElement {
      return (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="generation-timeline-dot"]',
      ) as HTMLElement;
    }

    it('should apply the success modifier class for SUCCESS', async () => {
      await setupWith(GenerationStatus.SUCCESS);
      expect(dot().classList.contains('timeline-dot--success')).toBe(true);
      expect(dot().classList.contains('timeline-dot--pending')).toBe(false);
      expect(dot().classList.contains('timeline-dot--failed')).toBe(false);
    });

    it('should apply the failed modifier class for FAILED', async () => {
      await setupWith(GenerationStatus.FAILED);
      expect(dot().classList.contains('timeline-dot--failed')).toBe(true);
    });

    it('should apply the pending modifier class for PENDING', async () => {
      await setupWith(GenerationStatus.PENDING);
      expect(dot().classList.contains('timeline-dot--pending')).toBe(true);
    });

    it('should reflect the label input via aria-label when provided', async () => {
      await setupWith(GenerationStatus.SUCCESS, 'Run #42');
      expect(dot().getAttribute('aria-label')).toBe('Run #42');
    });

    it('should omit aria-label when label input is not set', async () => {
      await setupWith(GenerationStatus.SUCCESS);
      expect(dot().getAttribute('aria-label')).toBeNull();
    });
  });
});
