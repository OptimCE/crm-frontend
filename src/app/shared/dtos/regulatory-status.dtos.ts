/**
 * `regulatory_link_status.regulatory_status` in the core: what the GRD and the
 * regulator have authorised for a meter or a key of an operation, as the
 * administrative annexe keeps it in step with its procedures.
 */
export enum RegulatoryStatus {
  TO_NOTIFY = 1,
  PENDING_GRD = 2,
  PENDING_REGULATOR = 3,
  AUTHORIZED = 4,
  ACTIVE = 5,
  LEAVING = 6,
  ENDED = 7,
  REFUSED = 8,
  /** Filed, then cancelled or excluded before it was authorised: nothing to show. */
  WITHDRAWN = 9,
}

export enum RegulatorySubjectType {
  METER = 1,
  KEY = 2,
}

/** One subject's latest episode (crm-backend `GET /regulatory/status`). */
export interface RegulatoryStatusDTO {
  id: string;
  id_sharing_operation: number;
  subject_type: RegulatorySubjectType;
  /** The EAN, or the key's id. */
  subject_ref: string;
  regulatory_status: RegulatoryStatus;
  valid_from: string | null;
  /** Its last day in the operation. */
  valid_to: string | null;
  /** The annexe procedure that drives the status: the badge's link. */
  regulatory_ref: string | null;
  updated_at: string;
}

export interface RegulatoryStatusQuery {
  /** Every operation of the community when omitted (the global meters list). */
  id_sharing_operation?: number;
  subject_type?: RegulatorySubjectType;
  /** One or several EANs (or key ids), at most 200. */
  subject_ref?: string | string[];
  /** `YYYY-MM-DD`: prefer the episode whose authorised period covers it. */
  date?: string;
}
