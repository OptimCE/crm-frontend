import { AddressDTO, CreateAddressDTO } from './address.dtos';

/**
 * DTO representing a user's profile and contact information.
 */
export interface UserDTO {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  nrn?: string | null;
  phone_number?: string | null;
  email: string;
  iban?: string | null;
  /** Preferred language, persisted server-side. Null until actively chosen. */
  locale?: string | null;
  home_address?: AddressDTO;
  billing_address?: AddressDTO;
}

/**
 * DTO for updating user information.
 * All fields are optional; only provided fields will be updated.
 */
export interface UpdateUserDTO {
  first_name?: string;
  last_name?: string;
  nrn?: string;
  phone_number?: string;
  iban?: string;
  /**
   * Preferred language. Persisted so the notification delivery layer can pick an
   * email template: this app otherwise keeps the choice in localStorage, and a
   * message sent hours later has no browser to ask.
   */
  locale?: string;
  home_address?: CreateAddressDTO;
  billing_address?: CreateAddressDTO;
}
