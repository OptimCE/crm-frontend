import { PaginationQuery, Sort } from './query.dtos';
import { SharingKeyStatus, SharingOperationType } from '../types/sharing_operation.types';
import { KeyPartialDTO } from './key.dtos';
import { MeterDataStatus } from '../types/meter.types';
import { MunicipalityPartialDTO } from './municipality.dtos';
/**
 * Query parameters for filtering and paginating a list of sharing operations.
 */
export interface SharingOperationPartialQuery extends PaginationQuery {
  name?: string;
  type?: string;
  /** Filter operations to those covering at least one of these municipality NIS codes. */
  municipality_nis_codes?: number[];
  sort_name?: Sort;
  sort_type?: Sort;
}

export enum SharingOperationMetersQueryType {
  PAST = 1,
  NOW = 2,
  FUTURE = 3,
}

export interface SharingOperationMetersQuery extends PaginationQuery {
  street?: string;
  postcode?: number;
  address_number?: number;
  city?: string;
  supplement?: string;
  EAN?: string;
  meter_number?: string;
  status?: MeterDataStatus;
  holder_id?: number;
  /** PAST tab range-overlap filter: lower bound (`YYYY-MM-DD`). */
  start_date_from?: string;
  /** PAST tab range-overlap filter: upper bound (`YYYY-MM-DD`). */
  end_date_to?: string;
  /** FUTURE tab snapshot date (`YYYY-MM-DD`). Defaults to tomorrow on the backend. */
  future_at?: string;
  type: SharingOperationMetersQueryType;
}

/**
 * Query parameters for retrieving sharing operation consumption data.
 */
export interface SharingOperationConsumptionQuery {
  date_start?: string;
  date_end?: string;
}

/**
 * Simplified DTO for a sharing operation (partial view), typically used in lists.
 */
export interface SharingOperationPartialDTO {
  id: number;
  name: string;
  type: SharingOperationType;
  municipalities: MunicipalityPartialDTO[];
}
/**
 * DTO representing a key associated with a sharing operation.
 */
export interface SharingOperationKeyDTO {
  id: number;
  key: KeyPartialDTO;
  start_date: Date;
  end_date: Date;
  status: SharingKeyStatus;
}
/**
 * Full DTO including keys and history for a sharing operation.
 */
export interface SharingOperationDTO extends SharingOperationPartialDTO {
  is_public: boolean;
  /** Regulator inherited (read-only) from the parent community. */
  community_regulator?: string;
  key: SharingOperationKeyDTO;
  key_waiting_approval?: SharingOperationKeyDTO;
}

/**
 * DTO containing time-series consumption/injection data for a sharing operation.
 */
export interface SharingOpConsumptionDTO {
  id: number;
  timestamps: string[];
  gross: number[];
  net: number[];
  shared: number[];
  inj_gross: number[];
  inj_net: number[];
  inj_shared: number[];
}

/**
 * Monthly consumption-data coverage for a sharing operation. One entry per month
 * (Brussels calendar) that has any data; `month` is `'YYYY-MM'`, `count` is the
 * number of 15-minute rows present that month (a completeness signal).
 */
export interface SharingOpConsumptionCoverageDTO {
  month: string;
  count: number;
}

/**
 * DTO for creating a new sharing operation. Municipalities are optional at
 * creation; the operation defaults to private and can only be made public
 * once at least one municipality is attached.
 */
export interface CreateSharingOperationDTO {
  name: string;
  type: SharingOperationType;
  municipality_nis_codes?: number[];
}

/**
 * DTO for replacing the full set of municipalities linked to a sharing operation.
 * Empty arrays are allowed only on private operations — the backend rejects
 * clearing municipalities on a public operation.
 */
export interface UpdateSharingOperationMunicipalitiesDTO {
  id_sharing: number;
  municipality_nis_codes: number[];
}

/**
 * DTO for updating an existing sharing operation. All fields are optional;
 * at least one must be provided. When `municipality_nis_codes` is included,
 * it replaces the existing set.
 */
export interface UpdateSharingOperationDTO {
  name?: string;
  type?: SharingOperationType;
  municipality_nis_codes?: number[];
}

/**
 * DTO for associating a key with a sharing operation.
 */
export interface AddKeyToSharingOperationDTO {
  id_key: number;
  id_sharing: number;
}

/**
 * DTO for adding meters to a sharing operation.
 */
export interface AddMeterToSharingOperationDTO {
  id_sharing: number;
  /** Calendar date `YYYY-MM-DD` — no time/zone. */
  date: string;
  ean_list: string[];
}

/**
 * DTO for updating the status of a key in a sharing operation.
 */
export interface PatchKeyToSharingOperationDTO {
  id_key: number;
  id_sharing: number;
  status: SharingKeyStatus;
  date: Date;
}

/**
 * DTO for updating the status of a meter within a sharing operation.
 */
export interface PatchMeterToSharingOperationDTO {
  id_meter: string;
  id_sharing: number;
  status: MeterDataStatus;
  /** Calendar date `YYYY-MM-DD` — no time/zone. */
  date: string;
}

/**
 * DTO for removing a meter from a sharing operation.
 *
 * Two modes:
 *  - default (`hard_delete` falsy): close the meter's participation by appending an
 *    INACTIVE record starting at `date` (required).
 *  - `hard_delete = true`: physically delete a not-yet-started future record. `date`
 *    is ignored and the backend rejects the call if the meter has already started.
 */
export interface RemoveMeterFromSharingOperationDTO {
  id_meter: string;
  id_sharing: number;
  /** Calendar date `YYYY-MM-DD` — required unless `hard_delete` is true. */
  date?: string;
  hard_delete?: boolean;
}

/**
 * DTO for updating the visibility of a sharing operation.
 */
export interface PatchSharingOperationVisibilityDTO {
  id_sharing: number;
  is_public: boolean;
}
