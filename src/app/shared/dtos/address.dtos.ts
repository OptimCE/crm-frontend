/**
 * DTO for creating a new address.
 */
export interface CreateAddressDTO {
  street: string;
  /** House number as text: `12A`, `12-14` and `1/3` are all real BeSt entries. */
  number: string;
  city: string;
  postcode: string;
  supplement?: string;
  /** ISO-3166-1 alpha-2. Omitted means BE, which the database defaults to. */
  country?: string;
  /** Set only when the address was picked from the BeSt Address register. */
  best_address_id?: string;
}
/**
 * DTO for updating an existing address.
 * All fields are optional.
 */
export interface UpdateAddressDTO {
  street?: string;
  /** See {@link CreateAddressDTO.number}. */
  number?: string;
  city?: string;
  postcode?: string;
  supplement?: string;
  /** See {@link CreateAddressDTO.country}. */
  country?: string;
  /** See {@link CreateAddressDTO.best_address_id}. */
  best_address_id?: string;
}
/**
 * DTO representing a full address.
 */
export interface AddressDTO {
  id: number;
  street: string;
  /** See {@link CreateAddressDTO.number}. */
  number: string;
  postcode: string;
  supplement?: string;
  city: string;
  /**
   * ISO-3166-1 alpha-2. The API always sends it (the column is NOT NULL with a
   * `BE` default), so this is optional only because `AddressDTO` doubles as a
   * PAYLOAD type in the member and profile forms — they build one with
   * `id: -1` as a sentinel and post it. Requiring `country` would force those
   * builders to invent a country the user never chose, which is worse than the
   * missing guarantee. Tighten this when those payloads get their own type.
   */
  country?: string;
}
