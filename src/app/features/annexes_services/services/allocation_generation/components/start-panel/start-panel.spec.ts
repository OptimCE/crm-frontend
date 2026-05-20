import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, FormRecord } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import {
  JsonSchemaObject,
  JsonSchemaProperty,
} from '../../../../../../shared/dtos/allocation_generation.dtos';
import { StartPanel } from './start-panel';

// ── Helpers ──────────────────────────────────────────────────────────

function buildSchema(
  properties: Record<string, JsonSchemaProperty> = {},
  required: string[] = [],
): JsonSchemaObject {
  return { type: 'object', properties, required };
}

function buildInputsForm(controls: Record<string, FormControl> = {}): FormGroup {
  return new FormGroup({ inputs: new FormRecord(controls) });
}

// ── Test Suite ───────────────────────────────────────────────────────

describe('StartPanel', () => {
  let component: StartPanel;
  let fixture: ComponentFixture<StartPanel>;

  async function createWith(schema: JsonSchemaObject, form: FormGroup): Promise<void> {
    fixture = TestBed.createComponent(StartPanel);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('schema', schema);
    fixture.componentRef.setInput('inputsForm', form);
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StartPanel, TranslateModule.forRoot()],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(StartPanel, { set: { template: '' } })
      .compileComponents();
  });

  // ── 1. Creation ────────────────────────────────────────────────────

  describe('creation', () => {
    it('should create with an empty schema', async () => {
      await createWith(buildSchema(), buildInputsForm());
      expect(component).toBeTruthy();
      expect(component.mainFields()).toEqual([]);
      expect(component.advancedFields()).toEqual([]);
    });
  });

  // ── 2. Field partitioning ──────────────────────────────────────────

  describe('field partitioning', () => {
    const schema = buildSchema(
      {
        alpha: { type: 'number', 'ui:section': 'main' },
        beta: { type: 'string', 'ui:section': 'advanced' },
        gamma: { type: 'boolean' }, // no section → defaults to main
      },
      ['alpha'],
    );

    beforeEach(async () => {
      await createWith(schema, buildInputsForm());
    });

    it('mainFields should include properties with section "main" and unspecified', () => {
      const keys = component.mainFields().map((f) => f.key);
      expect(keys).toEqual(expect.arrayContaining(['alpha', 'gamma']));
      expect(keys).not.toContain('beta');
    });

    it('advancedFields should include only properties with section "advanced"', () => {
      const keys = component.advancedFields().map((f) => f.key);
      expect(keys).toEqual(['beta']);
    });

    it('should expose required flags derived from schema.required', () => {
      const alpha = component.mainFields().find((f) => f.key === 'alpha');
      const gamma = component.mainFields().find((f) => f.key === 'gamma');
      const beta = component.advancedFields().find((f) => f.key === 'beta');
      expect(alpha?.required).toBe(true);
      expect(gamma?.required).toBe(false);
      expect(beta?.required).toBe(false);
    });

    it('should expose the original property descriptor on each field', () => {
      const alpha = component.mainFields().find((f) => f.key === 'alpha');
      expect(alpha?.prop).toEqual(schema.properties['alpha']);
    });
  });

  // ── 3. advancedOpen toggle ─────────────────────────────────────────

  describe('toggleAdvanced', () => {
    beforeEach(async () => {
      await createWith(buildSchema(), buildInputsForm());
    });

    it('should default to closed', () => {
      expect(component.advancedOpen()).toBe(false);
    });

    it('should flip on each call', () => {
      component.toggleAdvanced();
      expect(component.advancedOpen()).toBe(true);
      component.toggleAdvanced();
      expect(component.advancedOpen()).toBe(false);
    });
  });

  // ── 4. Form binding integration ────────────────────────────────────

  describe('form binding', () => {
    it('should expose the same form passed via input', async () => {
      const form = buildInputsForm({ alpha: new FormControl<number | null>(42) });
      await createWith(buildSchema({ alpha: { type: 'number', 'ui:section': 'main' } }), form);
      expect(component.inputsForm()).toBe(form);
      const inputs = component.inputsForm().controls['inputs'] as FormRecord<FormControl>;
      expect(inputs.controls['alpha'].value).toBe(42);
    });

    it('should reflect form value updates after construction', async () => {
      const alpha = new FormControl<number | null>(null);
      const form = buildInputsForm({ alpha });
      await createWith(
        buildSchema({ alpha: { type: 'number', 'ui:section': 'main' } }, ['alpha']),
        form,
      );
      alpha.setValue(7);
      expect((component.inputsForm().controls['inputs'] as FormRecord).value).toEqual({
        alpha: 7,
      });
    });
  });
});
