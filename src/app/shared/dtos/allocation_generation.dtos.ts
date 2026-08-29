import { Sort } from './query.dtos';
import { IncompleteMeterDTO, PreviewBlockerDTO } from './crm_data_source.dtos';

export type UiSection = 'main' | 'advanced';

export type JsonSchemaType = 'integer' | 'number' | 'string' | 'boolean';

export interface JsonSchemaProperty {
  type: JsonSchemaType;
  title?: string;
  description?: string;
  default?: string | number | boolean | null;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  'ui:section'?: UiSection;
}

export interface JsonSchemaObject {
  type: 'object';
  title?: string;
  required?: string[];
  properties: Record<string, JsonSchemaProperty>;
}

export interface AlgorithmMetadata {
  name: string;
  description: string;
  version: string;
  queue: string;
  input_schema: JsonSchemaObject;
  tags: string[];
  timeout_seconds: number | null;
}

export enum GenerationStatus {
  PENDING = 0,
  SUCCESS = 1,
  FAILED = 2,
}

export interface GenerationPartialDTO {
  id: number;
  name: string;
  status: GenerationStatus;
}

export interface GenerationQuery {
  page: number;
  page_size: number;
  name?: string;
  status?: GenerationStatus;
  sort_id?: Sort;
  sort_name?: Sort;
  sort_status?: Sort;
}

export interface AllocationKeyPartialDTO {
  id: number;
  name: string;
  description: string;
  surplus_total: number;
}

export interface AllocationKeyQuery {
  page: number;
  page_size: number;
  name?: string;
  sort_id?: Sort;
  sort_name?: Sort;
  sort_surplus?: Sort;
}

export interface AllocationConsumerDTO {
  id: number;
  name: string;
  energy_allocated_percentage: number;
}

export interface AllocationIterationDTO {
  id: number;
  number: number;
  energy_allocated_percentage: number;
  surplus_total: number;
  consumers: AllocationConsumerDTO[];
}

export interface AllocationKeyDetailDTO extends AllocationKeyPartialDTO {
  iterations: AllocationIterationDTO[];
}

export type AlgorithmInputValue = string | number | boolean | null;

export interface CreateGenerationPayload {
  file: File;
  name: string;
  injectionName: string;
  algorithmName: string;
  inputs: Record<string, AlgorithmInputValue>;
}

export interface CreateGenerationResponse {
  id: number;
  status: GenerationStatus;
}

export interface SaveKeyPayload {
  id_key: number;
}

/**
 * Start a generation from the meter readings already in OptimCE.
 *
 * No `file` and no `injectionName`: the production profile is summed from the
 * meters themselves, which is why this path asks the manager for less than the
 * upload one does.
 */
export interface CreateGenerationFromCrmPayload {
  name: string;
  algorithmName: string;
  inputs: Record<string, AlgorithmInputValue>;
  idSharingOperation: number;
  /** `YYYY-MM-DD`, inclusive. */
  periodStart: string;
  periodEnd: string;
}

/** Response of `GET /generation/crm-data-preview`. */
export interface CrmGenerationPreviewDTO {
  /** The single flag the submit button binds to. */
  can_generate: boolean;
  /** Meters that drew energy and will therefore be participants in the key. */
  meter_count: number;
  reading_count: number;
  first_timestamp: string | null;
  last_timestamp: string | null;
  total_consumption_kwh: number;
  total_injection_kwh: number;
  incomplete_meters: IncompleteMeterDTO[];
  blockers: PreviewBlockerDTO[];
}
