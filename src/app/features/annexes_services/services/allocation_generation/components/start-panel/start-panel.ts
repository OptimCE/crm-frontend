import { Component, computed, input, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Checkbox } from 'primeng/checkbox';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';

import {
  JsonSchemaObject,
  JsonSchemaProperty,
  UiSection,
} from '../../../../../../shared/dtos/allocation_generation.dtos';

interface RenderedField {
  key: string;
  prop: JsonSchemaProperty;
  required: boolean;
}

@Component({
  selector: 'app-start-panel',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, InputNumber, InputText, Checkbox],
  templateUrl: './start-panel.html',
  styleUrl: './start-panel.css',
})
export class StartPanel {
  readonly schema = input.required<JsonSchemaObject>();
  readonly inputsForm = input.required<FormGroup>();

  readonly advancedOpen = signal(false);

  readonly mainFields = computed<RenderedField[]>(() => this.fieldsForSection('main'));
  readonly advancedFields = computed<RenderedField[]>(() => this.fieldsForSection('advanced'));

  toggleAdvanced(): void {
    this.advancedOpen.update((open) => !open);
  }

  private fieldsForSection(section: UiSection): RenderedField[] {
    const schema = this.schema();
    const required = new Set(schema.required ?? []);
    return Object.entries(schema.properties)
      .filter(([, prop]) => (prop['ui:section'] ?? 'main') === section)
      .map(([key, prop]) => ({ key, prop, required: required.has(key) }));
  }
}
