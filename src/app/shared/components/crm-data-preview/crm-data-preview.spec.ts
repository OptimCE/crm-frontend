import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { CrmDataPreview, CrmPreviewView } from './crm-data-preview';

// ── Helpers ──────────────────────────────────────────────────────────

function buildPreview(overrides: Partial<CrmPreviewView> = {}): CrmPreviewView {
  return {
    ok: true,
    meterCount: 2,
    readingCount: 2880,
    firstTimestamp: '2025-02-01T00:00:00Z',
    lastTimestamp: '2025-02-28T23:45:00Z',
    totalConsumptionKwh: 1234.5,
    totalInjectionKwh: 987.6,
    incompleteMeters: [],
    blockers: [],
    ...overrides,
  };
}

// ── Test Suite ───────────────────────────────────────────────────────

describe('CrmDataPreview', () => {
  let component: CrmDataPreview;
  let fixture: ComponentFixture<CrmDataPreview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrmDataPreview, TranslateModule.forRoot()],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(CrmDataPreview, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(CrmDataPreview);
    component = fixture.componentInstance;
  });

  // ── 1. The green state ─────────────────────────────────────────────

  it('should be clean when there is nothing at all to flag', () => {
    fixture.componentRef.setInput('preview', buildPreview());
    expect(component.isClean()).toBe(true);
    expect(component.hasBlockers()).toBe(false);
    expect(component.hasWarnings()).toBe(false);
  });

  it('should not be clean before a period has been chosen', () => {
    expect(component.isClean()).toBe(false);
  });

  // ── 2. Amber: runnable, but worth saying something about ───────────

  it('should not be clean when a meter has gaps, even though the run is allowed', () => {
    // "Warn but allow": ok stays true, but the panel must not look green.
    fixture.componentRef.setInput(
      'preview',
      buildPreview({
        incompleteMeters: [
          { ean: '541448000000000001', readings: 2000, expected: 2880, missing: 880 },
        ],
      }),
    );
    expect(component.hasWarnings()).toBe(true);
    expect(component.isClean()).toBe(false);
    expect(component.preview()?.ok).toBe(true);
  });

  it('should not be clean when a participant is unmatched', () => {
    fixture.componentRef.setInput(
      'preview',
      buildPreview({ matchedParticipants: ['A'], unmatchedParticipants: ['C0'] }),
    );
    expect(component.unmatched()).toEqual(['C0']);
    expect(component.isClean()).toBe(false);
  });

  // ── 3. Red ─────────────────────────────────────────────────────────

  it('should report blockers', () => {
    fixture.componentRef.setInput(
      'preview',
      buildPreview({
        ok: false,
        blockers: [{ error_code: 2019, message: 'Duplicates found', detail: 'EAN 5414…' }],
      }),
    );
    expect(component.hasBlockers()).toBe(true);
    expect(component.isClean()).toBe(false);
  });

  // ── 4. Participants default to empty, not undefined ────────────────

  it('should treat a generation preview (no participants) as having none', () => {
    // The generation payload carries no participant lists at all; the template
    // branches on length, so these must be arrays rather than undefined.
    fixture.componentRef.setInput('preview', buildPreview());
    expect(component.matched()).toEqual([]);
    expect(component.unmatched()).toEqual([]);
  });
});
