import { Sort } from './query.dtos';

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
