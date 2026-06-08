import { Component, computed, inject, input, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Checkbox } from 'primeng/checkbox';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';

import { ErrorHandlerComponent } from '../../../../../../shared/components/error.handler/error.handler.component';
import {
  JsonSchemaObject,
  JsonSchemaProperty,
  UiSection,
} from '../../../../../../shared/dtos/allocation_generation.dtos';
import { ErrorAdded } from '../../../../../../shared/types/error.types';

interface RenderedField {
  key: string;
  prop: JsonSchemaProperty;
  required: boolean;
}

@Component({
  selector: 'app-start-panel',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    InputNumber,
    InputText,
    Checkbox,
    ErrorHandlerComponent,
  ],
  templateUrl: './start-panel.html',
  styleUrl: './start-panel.css',
})
export class StartPanel {
  private readonly translate = inject(TranslateService);

  readonly schema = input.required<JsonSchemaObject>();
  readonly inputsForm = input.required<FormGroup>();

  readonly advancedOpen = signal(false);

  // Min/max are the only non-required validators applied to schema inputs;
  // the error-handler's defaults already cover `required`.
  readonly fieldErrors: ErrorAdded = {
    min: (params) =>
      this.translate.instant('ALGORITHM_HUB.ERRORS.MIN_VALUE', { min: params['min'] }) as string,
    max: (params) =>
      this.translate.instant('ALGORITHM_HUB.ERRORS.MAX_VALUE', { max: params['max'] }) as string,
  };

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
