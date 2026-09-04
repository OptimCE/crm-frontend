/**
 * How good a stored coordinate is.
 *
 * Mirrors the backend's `AddressGeoPrecision`. Ordered best-to-worst on purpose:
 * MANUAL is a pin a human placed and is never overwritten by a later batch.
 * `MeterGeoPrecision` in `meter.types.ts` is the same scale seen from the meter
 * side — this is the address-level name for it.
 */
export enum AddressGeoPrecision {
  /** Placed by hand. Never overwritten. */
  MANUAL = 1,
  /** Matched to the building. */
  ROOFTOP = 2,
  /** Matched to the street, not the house number. */
  STREET = 3,
  /** Municipality centroid — the whole commune shares one point. */
  MUNICIPALITY = 4,
}

/** A street row has no house number and no coordinate; an address row has both. */
export type AddressSuggestionKind = 'street' | 'address';

/**
 * One pickable row from the federal BeSt Address register.
 *
 * `id` is the picker's `dataKey` and is deliberately NOT `best_address_id`:
 * street rows have no address id, and a fallback provider may have none at all.
 */
export interface AddressSuggestionDTO {
  id: string;
  kind: AddressSuggestionKind;
  /** Ready to render — the backend owns formatting so every row reads alike. */
  label: string;
  street: string;
  number?: string;
  postcode: string;
  city: string;
  country: string;
  latitude?: number;
  longitude?: number;
  precision?: AddressGeoPrecision;
  best_address_id?: string;
  nis_code?: number;
}

/**
 * Whether an address can be placed on the map.
 *
 * `found: false` is a normal answer, not an error. The form shows a warning and
 * the user saves anyway if they want to — the picker is advisory, never a gate.
 */
export interface AddressPreviewDTO {
  found: boolean;
  latitude?: number;
  longitude?: number;
  precision?: AddressGeoPrecision;
  source?: string;
  /** "Did you mean" rows, so a warning comes with a way out of it. */
  suggestions: AddressSuggestionDTO[];
}

/** Query for the preview endpoint. All four are required by the backend DTO. */
export interface AddressPreviewQuery {
  street: string;
  number: string;
  postcode: string;
  city: string;
  supplement?: string;
}
