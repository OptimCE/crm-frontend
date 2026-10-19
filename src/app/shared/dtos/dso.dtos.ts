/**
 * DSO (GRD) lookup: crm-backend's `/dso` routes, which relay the internal
 * dso-lookup service (data from belgian-dso-map).
 *
 * The backend answers `/dso/resolve` with 200 in every case. When dso-lookup is
 * off, slow or down, the answer is `available: false` / `status: 'unavailable'`,
 * and `/dso/operators` answers `[]`: the meter form then keeps its static list and
 * nothing is prefilled. Creating a meter never depends on this service.
 */

export type DsoRegion = 'WAL' | 'VLA' | 'BRU';

/** Place names as the federal register spells them. `de` may repeat `fr`. */
export interface DsoNames {
  fr: string;
  nl: string;
  de: string;
}

export interface DsoOperatorDTO {
  /** Stable id stored in `meter_data.grd` ("ores", "fluvius-imewo", "elia"). */
  id: string;
  /** `grtl` = Elia's local transmission grid; `gas_foreign` = Enexis (gas only). */
  kind: 'grd' | 'grtl' | 'gas_foreign';
  /** Display name, identical to `GRD_OPTIONS` ("ORES", "Fluvius Imewo"). */
  name: string;
  legal_name: string;
  region: string;
  elec: boolean;
  gas: boolean;
  website: string;
  regulator: string;
  tariffs_url: string;
  /** False for operators a lookup never returns (Elia). */
  lookup: boolean;
  /** Set once the operator merged into another one; it is then no longer offered. */
  replaced_by: string | null;
}

export interface DsoCommuneDTO {
  /** NIS (INS) code, 5 digits as a string. */
  ins: string;
  names: DsoNames;
  region: DsoRegion;
  /** ISO 3166-2 code (`BE-WNA`), empty in Brussels. */
  province: string;
}

export interface DsoSectionDTO {
  section_key: string;
  names: DsoNames;
  postcodes: string[];
  /** The section's electricity operator, so the form can prefill when they all agree. */
  elec_operator: string;
}

export interface DsoNoteDTO {
  key: string;
  fr: string;
  nl: string;
  de: string;
  en: string;
}

export interface DsoResultDTO {
  ins: string;
  commune: DsoNames;
  section: DsoSectionDTO | null;
  region: DsoRegion;
  regulator: string;
  /**
   * `operator` runs the network; `designated` is the GRD the regulator designated.
   * They differ in a few places (flag `operator_differs`). The meter form prefills
   * the OPERATOR only, never `designated` and never gas.
   */
  elec: { operator: string; designated: string };
  gas: { status: 'designated' | 'none' | 'foreign'; operator: string | null };
  /** Canonical order: `transition`, `operator_differs`, `to_confirm`, `propane_note`. */
  flags: string[];
  note: DsoNoteDTO | null;
  source_ids: string[];
  valid_from: string | null;
  data_version: string;
}

export type DsoResolveStatus =
  | 'ok'
  | 'choose_commune'
  | 'choose_section'
  | 'not_found'
  | 'unavailable';

export type DsoWarningCode = 'REGION_OUTSIDE_COMMUNITY_REGULATOR' | 'EAN_SIBELGA_OUTSIDE_BRUSSELS';

/**
 * Informative only, never blocking. Translated under `METER.GRD_WARNING.<code>`.
 *
 * - `REGION_OUTSIDE_COMMUNITY_REGULATOR`: `{address_regulator, community_regulator}`.
 * - `EAN_SIBELGA_OUTSIDE_BRUSSELS`: `{region}`.
 */
export interface DsoWarningDTO {
  code: DsoWarningCode;
  params: Record<string, string>;
}

export interface DsoEanCheckDTO {
  format: boolean;
  belgian_prefix: boolean;
  gs1_check: boolean | null;
  known_operator: 'sibelga' | null;
}

export interface DsoResolutionDTO {
  available: boolean;
  status: DsoResolveStatus;
  /** Set for `choose_commune`, and with one entry for `choose_section`. */
  communes?: DsoCommuneDTO[];
  sections?: DsoSectionDTO[];
  result?: DsoResultDTO;
  warnings: DsoWarningDTO[];
  /** belgian-dso-map version (`2026.10.0`, `-draft` on unreleased data). */
  data_version?: string;
  ean_check?: DsoEanCheckDTO;
}

/**
 * Query of `GET /dso/resolve`. Every field is optional.
 *
 * - `nis_code` and `post_name` come from a picked register address only (never from
 *   typed text: BeSt's city is the commune, not the locality).
 * - `ins` and `section` narrow a `choose_commune` / `choose_section` answer.
 * - `ean` adds an informative check of the EAN's prefix.
 */
export interface DsoResolveQuery {
  nis_code?: number;
  postcode?: string;
  city?: string;
  post_name?: string;
  ins?: string;
  section?: string;
  ean?: string;
}
