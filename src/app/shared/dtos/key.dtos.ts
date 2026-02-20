import { PaginationQuery, Sort } from './query.dtos';

/**
 * DTO for querying keys with pagination and filtering.
 */
export interface KeyPartialQuery extends PaginationQuery {
  description?: string;
  name?: string;
  sort_name?: Sort;
  sort_description?: Sort;
}

/**
 * Partial DTO representing a key (summary view).
 */
export interface KeyPartialDTO {
  id: number;
  name: string;
  description: string;
}
/**
 * DTO representing a consumer within an iteration.
 */
export interface ConsumerDTO {
  id: number;
  name: string;
  energy_allocated_percentage: number;
}
/**
 * DTO representing an iteration of the key distribution.
 */
export interface IterationDTO {
  id: number;
  number: number;
  energy_allocated_percentage: number;
  consumers: ConsumerDTO[];
}
/**
 * Full DTO representing a key, including its iterations.
 */
export interface KeyDTO extends KeyPartialDTO {
  iterations: IterationDTO[];
}

/**
 * DTO for creating a new consumer.
 */
export interface CreateConsumerDTO {
  name: string;
  energy_allocated_percentage: number;
}

/**
 * DTO for creating a new iteration.
 */
export interface CreateIterationDTO {
  number: number;
  energy_allocated_percentage: number;
  consumers: CreateConsumerDTO[];
}

/**
 * DTO for creating a new key.
 */
export interface CreateKeyDTO {
  name: string;
  description: string;
  iterations: CreateIterationDTO[];
}

/**
 * DTO for updating an existing key.
 */
export interface UpdateKeyDTO {
  id: number;
  name: string;
  description: string;
  iterations: CreateIterationDTO[];
}
