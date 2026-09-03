import { FormGroup } from '@angular/forms';
import { AddressSuggestionDTO } from '../../dtos/geocoding.dtos';

/**
 * How the picker finds the five address controls in whatever form it sits in.
 *
 * Pure and TestBed-free on purpose, like `encode-new-member-prefill.ts` — the
 * decisions worth testing live here and can be tested without rendering
 * PrimeNG under jsdom.
 *
 * The six address forms in this app disagree about almost everything: two
 * naming conventions (flat `home_address_street` vs nested
 * `headquarters_address.street`), three validation strategies (per-control
 * `Validators.required`, a flat-prefix cross-field validator, and a nested
 * all-or-nothing group validator), and two ways of hiding the billing block
 * (one REMOVES the controls, the other DISABLES them). A component that owned
 * the inputs would have to understand all of that. Addressing the controls by
 * PATH instead reduces it to a lookup table, because `FormGroup.get()` accepts
 * a dotted path.
 */
export interface AddressFieldNames {
  street: string;
  number: string;
  supplement: string;
  postcode: string;
  city: string;
}

export interface AddressFieldSource {
  group: FormGroup;
  names: AddressFieldNames;
}

export interface AddressFieldValues {
  street: string;
  number: string;
  supplement: string;
  postcode: string;
  city: string;
}

/** `home_address` -> `home_address_street`, … (member, profile, meter forms). */
export function prefixedAddressNames(prefix: string): AddressFieldNames {
  return {
    street: `${prefix}_street`,
    number: `${prefix}_number`,
    supplement: `${prefix}_supplement`,
    postcode: `${prefix}_postcode`,
    city: `${prefix}_city`,
  };
}

/** `headquarters_address` -> `headquarters_address.street`, … (community form). */
export function nestedAddressNames(groupName: string): AddressFieldNames {
  return {
    street: `${groupName}.street`,
    number: `${groupName}.number`,
    supplement: `${groupName}.supplement`,
    postcode: `${groupName}.postcode`,
    city: `${groupName}.city`,
  };
}

/** Bare control names, for a form whose address group IS the root. */
export function plainAddressNames(): AddressFieldNames {
  return {
    street: 'street',
    number: 'number',
    supplement: 'supplement',
    postcode: 'postcode',
    city: 'city',
  };
}

/**
 * Read the five values as strings.
 *
 * Reads each control individually rather than through `group.value`, because
 * `FormGroup.value` omits DISABLED children and `user-update-dialog` disables
 * the billing block instead of removing it — the values would silently vanish.
 * An `AbstractControl` keeps its `.value` while disabled, so this is safe.
 *
 * A control that does not exist reads as empty rather than throwing: the member
 * wizard genuinely removes its billing controls when "same address" is ticked.
 */
export function readAddressFields(source: AddressFieldSource): AddressFieldValues {
  const read = (path: string): string => {
    const value: unknown = source.group.get(path)?.value;
    if (typeof value === 'string') {
      return value;
    }
    // `community-info` typed its house-number control as a number for years, and
    // a form may still be patched from an API that sends one.
    if (typeof value === 'number') {
      return String(value);
    }
    // null, undefined, or — if someone ever binds an autocomplete straight to a
    // domain control — an object. Empty beats rendering '[object Object]' into
    // an address line and shipping it to a PDF.
    return '';
  };
  return {
    street: read(source.names.street),
    number: read(source.names.number),
    supplement: read(source.names.supplement),
    postcode: read(source.names.postcode),
    city: read(source.names.city),
  };
}

/**
 * A stable identity for what is currently typed.
 *
 * This is what stops a stale coordinate being submitted. Pick
 * "Rue de la Station 12", then hand-edit the number to 14, and the coordinate
 * captured with the pick now points at the wrong building — a lie the map would
 * render confidently. Comparing fingerprints at submit time makes the
 * invalidation explicit and testable instead of relying on remembering to clear
 * a signal in every edit handler.
 *
 * Case- and whitespace-insensitive: re-typing "RUE" over "Rue" is not a move.
 * `supplement` is included — a box number is part of the address.
 */
export function addressFingerprint(fields: AddressFieldValues): string {
  return [fields.street, fields.number, fields.supplement, fields.postcode, fields.city]
    .map((part) => part.trim().replace(/\s+/g, ' ').toLowerCase())
    .join('|');
}

/** All four required fields filled. `supplement` is optional everywhere. */
export function isAddressComplete(fields: AddressFieldValues): boolean {
  return [fields.street, fields.number, fields.postcode, fields.city].every(
    (part) => part.trim() !== '',
  );
}

/**
 * Nothing typed at all.
 *
 * Distinct from "incomplete": the profile and community forms both allow a
 * fully empty address, and probing one would warn about an address the user
 * never claimed to have.
 */
export function isAddressEmpty(fields: AddressFieldValues): boolean {
  return [fields.street, fields.number, fields.supplement, fields.postcode, fields.city].every(
    (part) => part.trim() === '',
  );
}

/**
 * The values a picked suggestion should write into the form.
 *
 * A street-level row carries no house number, so it deliberately leaves the
 * existing one alone rather than blanking it — picking a street to correct the
 * spelling should not wipe the number already typed.
 */
export function fieldsFromSuggestion(
  suggestion: AddressSuggestionDTO,
  current: AddressFieldValues,
): AddressFieldValues {
  return {
    street: suggestion.street,
    number: suggestion.number ?? current.number,
    supplement: current.supplement,
    postcode: suggestion.postcode || current.postcode,
    city: suggestion.city || current.city,
  };
}

/**
 * The coordinate captured when a suggestion was picked, if it is still valid.
 *
 * Returns null when the user has edited away from the pick, which is the whole
 * point — see {@link addressFingerprint}.
 */
export function geoFromPick(
  pick: AddressSuggestionDTO | null,
  pickedFingerprint: string | null,
  current: AddressFieldValues,
): { latitude: number; longitude: number; best_address_id?: string; country?: string } | null {
  if (!pick || pickedFingerprint === null) {
    return null;
  }
  if (pickedFingerprint !== addressFingerprint(current)) {
    return null;
  }
  if (pick.latitude === undefined || pick.longitude === undefined) {
    return null;
  }
  return {
    latitude: pick.latitude,
    longitude: pick.longitude,
    best_address_id: pick.best_address_id,
    country: pick.country,
  };
}
