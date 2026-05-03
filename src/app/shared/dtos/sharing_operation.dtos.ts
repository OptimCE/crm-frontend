import { PaginationQuery, Sort } from './query.dtos';
import { SharingKeyStatus, SharingOperationType } from '../types/sharing_operation.types';
import { KeyPartialDTO } from './key.dtos';
import { MeterDataStatus } from '../types/meter.types';
/**
 * Query parameters for filtering and paginating a list of sharing operations.
 */
export interface SharingOperationPartialQuery extends PaginationQuery {
  name?: string;
  type?: string;
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
 * DTO for creating a new sharing operation.
 */
export interface CreateSharingOperationDTO {
  name: string;
  type: SharingOperationType;
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
 * DTO for uploading consumption data (file upload).
 */
export interface AddConsumptionDataDTO {
  id_sharing_operation: number;
  // file: Express.Multer.File; TODO: Fix this
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
