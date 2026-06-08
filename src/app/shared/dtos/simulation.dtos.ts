import { Sort } from './query.dtos';

/** Mirrors the simulation-key microservice's SimulationStatus (IntEnum). */
export enum SimulationStatus {
  PENDING = 0,
  SUCCESS = 1,
  FAILED = 2,
}

/** List-row view of a simulation run. */
export interface SimulationPartialDTO {
  id: number;
  name: string;
  status: SimulationStatus;
  id_key: number;
  key_name: string;
}

export interface SimulationConsumerResultDTO {
  name: string;
  energy_allocated_percentage: number;
  consumption_total: number;
  energy_allocated_total: number;
  energy_allocated_consumed_total: number;
  residual_volume_total: number;
  surplus_total: number;
}

export interface SimulationIterationResultDTO {
  number: number;
  energy_allocated_percentage: number;
  consumption_total: number;
  energy_allocated_total: number;
  energy_allocated_consumed_total: number;
  residual_volume_total: number;
  surplus_total: number;
  sharing_rate_total: number;
  self_sufficiency_rate_total: number;
  consumers: SimulationConsumerResultDTO[];
}

export interface SimulationKeyResultDTO {
  name: string;
  description: string;
  consumption_total: number;
  energy_allocated_total: number;
  energy_allocated_consumed_total: number;
  residual_volume_total: number;
  surplus_total: number;
  self_sufficiency_rate_total: number;
  sharing_rate_total: number;
  iterations: SimulationIterationResultDTO[];
}

/** Full view of a simulation: scalar result tree + time-series availability. */
export interface SimulationDetailDTO extends SimulationPartialDTO {
  error_message: string | null;
  has_timeseries: boolean;
  key_result: SimulationKeyResultDTO | null;
}

export interface SimulationConsumerTimeseriesDTO {
  name: string;
  consumption: number[];
  energy_allocated: number[];
  energy_allocated_consumed: number[];
  residual_volume: number[];
  surplus: number[];
}

export interface SimulationIterationTimeseriesDTO {
  number: number;
  consumption: number[];
  energy_allocated: number[];
  energy_allocated_consumed: number[];
  residual_volume: number[];
  surplus: number[];
  sharing_rate: number[];
  self_sufficiency_rate: number[];
  consumers: SimulationConsumerTimeseriesDTO[];
}

/** Per-timestep series for charting (one object per run in object storage). */
export interface SimulationTimeseriesDTO {
  iterations: SimulationIterationTimeseriesDTO[];
}

export interface SimulationQuery {
  page: number;
  page_size: number;
  name?: string;
  status?: SimulationStatus;
  sort_id?: Sort;
  sort_name?: Sort;
  sort_status?: Sort;
}

export interface CreateSimulationPayload {
  file: File;
  name: string;
  idKey: number;
  injectionName: string;
}

export interface CreateSimulationResponse {
  id: number;
  status: SimulationStatus;
}
