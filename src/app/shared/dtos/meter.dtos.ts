import { PaginationQuery } from './query.dtos';
import { AddressDTO, CreateAddressDTO } from './address.dtos';
import { MembersPartialDTO } from './member.dtos';
import {
  ClientType,
  InjectionStatus,
  MeterDataStatus,
  MeterGeoPrecision,
  MeterRate,
  PhaseCategory,
  ProductionChain,
  ReadingFrequency,
  TarifGroup,
} from '../types/meter.types';
import { SharingOperationPartialDTO } from './sharing_operation.dtos';

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
  holder?: MembersPartialDTO;
  status: MeterDataStatus;
  /**
   * Start date (`YYYY-MM-DD`) of the meter data record selected for this view.
   * In sharing-operation tabs, lets the UI tell whether the row is a future-only
   * scheduled record (eligible for hard delete) or already-active.
   */
  start_date?: string;
  /** End date (`YYYY-MM-DD`) of the meter data record selected for this view, if closed. */
  end_date?: string;
  sharing_operation?: SharingOperationPartialDTO;
  /**
   * Injection status of the meter data record selected for this view.
   * `null`/absent means the meter is a pure offtake point — a consumer.
   * Use {@link isConsumerMeter} rather than testing this directly: the frontend enum carries an
   * extra `NONE` member that the backend expresses as `null`.
   */
  injection_status?: InjectionStatus | null;
}

/**
 * Whether a meter is a pure offtake point (a consumer) rather than an injection/production point.
 *
 * The backend leaves `injection_status` null for consumers, while the frontend enum also has a
 * `NONE` member — both must count as "consumer".
 */
export function isConsumerMeter(meter: Pick<PartialMeterDTO, 'injection_status'>): boolean {
  return meter.injection_status == null || meter.injection_status === InjectionStatus.NONE;
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
  start_date: string;
  end_date?: string;
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
  holder?: MembersPartialDTO;
  tarif_group: TarifGroup;
  phases_number: PhaseCategory;
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
  start_date: string;

  end_date?: string;

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
  phases_number: PhaseCategory;
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
  phases_number: PhaseCategory;
  reading_frequency: ReadingFrequency;
}

export interface DeleteFutureMeterDataDTO {
  id_meter_data: number;
  active_previous_meter_data?: boolean;
}

/**
 * Query for the meters map. Same filters as the list; the map is not paginated,
 * so `page`/`limit` are deliberately excluded rather than sent and ignored.
 */
export type MeterMapQuery = Omit<MeterPartialQuery, 'page' | 'limit'>;

/** One plottable meter. */
export interface MeterMapPointDTO {
  EAN: string;
  latitude: number;
  longitude: number;
  geo_precision: MeterGeoPrecision | null;
  status: MeterDataStatus;
  /** Null/absent means a pure offtake point — a consumer. See {@link isConsumerMeter}. */
  injection_status?: InjectionStatus | null;
  holder_name?: string;
  sharing_operation_id?: number;
  sharing_operation_name?: string;
  /** Only set by the member-scoped endpoint, whose meters can span communities. */
  community_name?: string;
}

/**
 * The meters map payload.
 *
 * The counters are load-bearing, not diagnostics: at launch most addresses have
 * no coordinates, and without them the map would show a fraction of the
 * community as though it were the whole of it.
 */
export interface MeterMapDTO {
  points: MeterMapPointDTO[];
  /** Meters passing the filters, geocoded or not. */
  total_matching: number;
  /** Of those, the ones that have coordinates. */
  total_plottable: number;
  missing_coordinates: number;
  /** True when `cap` cut the result short. */
  truncated: boolean;
  cap: number;
}

/** Whether a point's coordinate is precise enough to be treated as an address. */
export function isExactMeterPoint(point: Pick<MeterMapPointDTO, 'geo_precision'>): boolean {
  return point.geo_precision !== null && point.geo_precision <= MeterGeoPrecision.STREET;
}
