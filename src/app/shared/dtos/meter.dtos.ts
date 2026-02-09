import {PaginationQuery} from './query.dtos';
import {AddressDTO, CreateAddressDTO} from './address.dtos';
import {MembersPartialDTO} from './member.dtos';
import {
  ClientType,
  InjectionStatus, MeterDataStatus,
  MeterRate,
  ProductionChain,
  ReadingFrequency,
  TarifGroup
} from '../types/meter.types';
import {SharingOperationPartialDTO} from './sharing_operation.dtos';

/**
 * Query parameters for filtering and paginating a list of meters.
 */
export interface MeterPartialQuery extends PaginationQuery {
  street?: string;
  postcode?: number;
  address_number?: number;
  city?: string;
  supplement?: string;
  EAN?: string;
  meter_number?: string;
  status?: MeterDataStatus;
  sharing_operation_id?: number;
  not_sharing_operation_id?: number;
  holder_id?: number;
}

/**
 * Query parameters for retrieving meter consumption data.
 */
export interface MeterConsumptionQuery {
  date_start?: string;
  date_end?: string;
}

/**
 * Simplified DTO for a meter (partial view), typically used in lists.
 */
export interface PartialMeterDTO {
  EAN: string;
  meter_number: string;
  address: AddressDTO;
  holder?: MembersPartialDTO
  status: MeterDataStatus;
  sharing_operation?: SharingOperationPartialDTO;
}

/**
 * DTO representing detailed meter configuration and status for a specific period (history/current/future).
 */
export interface MetersDataDTO {
  id: number;
  description: string;
  sampling_power: number;
  status: MeterDataStatus;
  amperage: number;
  rate: MeterRate;
  client_type: ClientType;
  start_date: Date;
  end_date?: Date;
  injection_status: InjectionStatus;
  production_chain: ProductionChain;
  totalGenerating_capacity: number;
  member?: MembersPartialDTO;
  grd: string;
  sharing_operation?: SharingOperationPartialDTO;
}

/**
 * Full DTO including physical properties and timeline of data configurations.
 */
export interface MetersDTO {
  EAN: string;
  meter_number: string;
  address: AddressDTO;
  holder?: MembersPartialDTO
  tarif_group: TarifGroup;
  phases_number: number;
  reading_frequency: ReadingFrequency;
  meter_data?: MetersDataDTO;
  meter_data_history?: MetersDataDTO[];
  futur_meter_data?: MetersDataDTO[];
}

/**
 * DTO containing time-series consumption/injection data.
 */
export interface MeterConsumptionDTO {
  /**
   * EAN code.
   */

  EAN: string;
  /**
   * Array of timestamps.
   */

  timestamps: string[];
  /**
   * Gross consumption values.
   */

  gross: number[];
  /**
   * Net consumption values.
   */

  net: number[];
  /**
   * Shared consumption values.
   */

  shared: number[];
  /**
   * Gross injection values.
   */

  inj_gross: number[];
  /**
   * Net injection values.
   */

  inj_net: number[];
  /**
   * Shared injection values.
   */

  inj_shared: number[];
}

/**
 * DTO for creating or updating a MeterData configuration period.
 */
export interface CreateMeterDataDTO {
  start_date: Date;

  end_date?: Date;

  status: MeterDataStatus;

  rate: MeterRate;

  client_type: ClientType;

  description?: string;

  sampling_power?: number;

  amperage?: number;

  grd?: string;

  injection_status?: InjectionStatus;

  production_chain?: ProductionChain;

  total_generating_capacity?: number;

  member_id?: number;

  sharing_operation_id?: number;
}

/**
 * DTO for creating a new physical meter and its initial configuration.
 */
export interface CreateMeterDTO {

  EAN: string;
  meter_number: string;
  address: CreateAddressDTO;
  tarif_group: TarifGroup;
  phases_number: number;
  reading_frequency: ReadingFrequency;
  initial_data: CreateMeterDataDTO;
}


/**
 * DTO for patching meter data configuration.
 * Requires EAN to identify the meter to update.
 */
export interface PatchMeterDataDTO extends CreateMeterDataDTO {
  EAN: string;
}
export interface UpdateMeterDTO {
  EAN: string;
  meter_number: string;
  address: CreateAddressDTO;
  tarif_group: TarifGroup;
  phases_number: number;
  reading_frequency: ReadingFrequency;
}
