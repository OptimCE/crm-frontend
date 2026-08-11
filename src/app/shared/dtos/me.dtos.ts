import { CommunityDTO } from './community.dtos';
import { DocumentExposedDTO, DocumentQueryDTO } from './document.dtos';
import { MeterPartialQuery, MetersDTO, PartialMeterDTO } from './meter.dtos';
import { CompanyDTO, IndividualDTO, MemberPartialQuery, MembersPartialDTO } from './member.dtos';
import { SharingOperationType } from '../types/sharing_operation.types';

export interface MeMemberPartialQuery extends MemberPartialQuery {
  community_name?: string;
}

export interface MeMetersPartialQuery extends MeterPartialQuery {
  community_name?: string;
}

export interface MeDocumentPartialQuery extends DocumentQueryDTO {
  community_name?: string;
}

/** Which fields of a member record must be filled in for it to be usable. */
export type MemberMissingField =
  | 'name'
  | 'iban'
  | 'nrn'
  | 'email'
  | 'vat_number'
  | 'home_address'
  | 'billing_address'
  | 'sub_type_row';

export interface MeMembersPartialDTO extends MembersPartialDTO {
  community: CommunityDTO;
  /**
   * Which fields of this record are still blank, e.g. `['iban']`.
   *
   * **`undefined` means "not evaluated", NOT "complete."** Completeness is only
   * answerable when the sub-type row and both addresses are loaded, which
   * `GET /me/members` does and the queries embedding a member as a meter's
   * `holder` do not. Render nothing rather than a clean bill of health.
   *
   * `sub_type_row` is the one value that does not name a form field: the
   * `individual`/`company` row is missing entirely, which is also what makes
   * `GET /me/members/:id` fail — so it must not offer an edit link.
   */
  missing_fields?: MemberMissingField[];
}

export interface MeIndividualDTO extends IndividualDTO {
  community: CommunityDTO;
}

export interface MeCompanyDTO extends CompanyDTO {
  community: CommunityDTO;
}

export interface MePartialMeterDTO extends PartialMeterDTO {
  community: CommunityDTO;
}

export interface MeMeterDTO extends MetersDTO {
  community: CommunityDTO;
}

export interface MeDocumentDTO extends DocumentExposedDTO {
  community: CommunityDTO;
}

/** Lean sharing-operation reference carried by an allocation share. */
export interface MeAllocationOperationRef {
  id: number;
  name: string;
  type: SharingOperationType;
}

export interface MeAllocationMemberRef {
  id: number;
  name: string;
}

export interface MeAllocationKeyRef {
  id: number;
  name: string;
  /** Validity window of the operation-to-key link, not of the key itself. */
  start_date: string;
  end_date: string | null;
}

export interface MeAllocationIterationShare {
  iteration_id: number;
  iteration_number: number;
  /** Fraction of the key's energy routed through this iteration. */
  iteration_share: number;
  /** null when this EAN is not listed as a consumer of this iteration. */
  consumer_share: number | null;
  is_prorata: boolean;
  /** `iteration_share × consumer_share`; 0 when absent, null when prorata. */
  contribution: number | null;
}

/**
 * One (community, sharing operation, meter) the caller holds, with their share
 * of the allocation key in force.
 *
 * **`matched` is the field that matters.** `consumer.name` in an allocation key
 * is free text with no foreign key to a meter — only *conventionally* an EAN.
 * `matched: false` means the key does not identify this meter, which the UI must
 * render as "not listed in this key", NEVER as 0 %: the member is not receiving
 * nothing, the key simply does not say.
 */
export interface MeAllocationShareDTO {
  community: CommunityDTO;
  sharing_operation: MeAllocationOperationRef;
  ean: string;
  member: MeAllocationMemberRef;
  holding_start_date: string;
  holding_end_date: string | null;
  /** null when the operation has no approved key valid on the evaluation date. */
  key: MeAllocationKeyRef | null;
  matched: boolean;
  match_basis: 'ean_consumer_name' | null;
  is_prorata: boolean;
  /** Σ contributions. null when unmatched, keyless, or prorata. */
  effective_share: number | null;
  iterations: MeAllocationIterationShare[];
}

export interface MeAllocationSharesDTO {
  /** Resolved evaluation date (`YYYY-MM-DD`). */
  at: string;
  shares: MeAllocationShareDTO[];
}

export interface MeAllocationSharesQuery {
  /** Evaluate the key and ownership windows on this date (`YYYY-MM-DD`). */
  at?: string;
}

/** kWh over the summarised window. "Shared" = exchanged inside the community. */
export interface MeEnergyTotals {
  gross_kwh: number;
  shared_kwh: number;
  inj_gross_kwh: number;
  inj_shared_kwh: number;
}

export interface MeEnergyMeterDTO {
  ean: string;
  meter_number: string | null;
  community: CommunityDTO;
  totals: MeEnergyTotals;
  /**
   * False when this meter produced NO reading in the window.
   *
   * The sibling of `MeAllocationShareDTO.matched`, and it carries the same
   * obligation: render it as "no reading yet", **never** as `0 kWh`. The member
   * did not consume nothing — we simply do not know.
   */
  has_data: boolean;
}

export interface MeEnergySummaryDTO {
  /** Inclusive calendar bounds of the summarised month (`YYYY-MM-DD`). */
  period: { start: string; end: string };
  /** Sum over `meters`, across every community. */
  totals: MeEnergyTotals;
  meters: MeEnergyMeterDTO[];
}

export interface MeEnergySummaryQuery {
  /** Calendar month as `YYYY-MM`. Defaults to the last CLOSED month. */
  month?: string;
}
