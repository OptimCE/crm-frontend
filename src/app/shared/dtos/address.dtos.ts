
/**
 * DTO for creating a new address.
 */
export interface CreateAddressDTO {
  street: string;
  number: number;
  city: string;
  postcode: string;
  supplement?: string;
}
/**
 * DTO for updating an existing address.
 * All fields are optional.
 */
export interface UpdateAddressDTO {
  street?: string;
  number?: number;
  city?: string;
  postcode?: string;
  supplement?: string;
}
/**
 * DTO representing a full address.
 */
export interface AddressDTO {
  id: number;
  street: string;
  number: number;
  postcode: string;
  supplement?: string;
  city: string;
}
