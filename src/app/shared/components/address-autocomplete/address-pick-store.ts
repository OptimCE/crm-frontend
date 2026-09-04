import { signal } from '@angular/core';
import { AddressSuggestionDTO } from '../../dtos/geocoding.dtos';
import { AddressGeoState, AddressPicked } from './address-autocomplete';
import { AddressFieldValues, geoFromPick } from './address-field-source';

/** The extra fields a picked suggestion contributes to an address payload. */
export interface PickedAddressGeo {
  latitude: number;
  longitude: number;
  best_address_id?: string;
  country?: string;
}

/**
 * Holds what the picker produced for ONE address block, until submit.
 *
 * Exists so the six forms do not each reinvent the same three-line dance, and
 * so the part that is easy to get wrong lives in one tested place.
 *
 * Deliberately NOT hidden form controls, which is the obvious alternative:
 *
 *  - Both wizards render their address step inside a `p-stepper`
 *    `<ng-template #content>`. By the final submit that panel — and any
 *    `viewChild` into it — is destroyed, so the value has to have been pushed
 *    up while it was alive.
 *  - `member-creation-update` REMOVES its billing controls on "same address"
 *    and `user-update-dialog` DISABLES them; hidden coordinate controls would
 *    have to be added, removed and disabled in lockstep, in the same method
 *    that already had a validator bug.
 *  - A hidden control silently carries a STALE coordinate into the payload
 *    after the user edits the street — the worst outcome this feature could
 *    produce. {@link geoFor} makes that invalidation explicit instead.
 */
export class AddressPickStore {
  /** What the strip is currently saying, for a parent that wants to react. */
  readonly geo = signal<AddressGeoState>({ kind: 'idle' });

  private pick: AddressSuggestionDTO | null = null;
  private fingerprint: string | null = null;

  /** Wire to `(addressPicked)`. */
  remember(event: AddressPicked): void {
    this.pick = event.suggestion;
    this.fingerprint = event.fingerprint;
  }

  /** Wire to `(geoChange)`. */
  observe(state: AddressGeoState): void {
    this.geo.set(state);
  }

  /**
   * The coordinate to submit, or null if the form no longer matches the pick.
   *
   * Call with the values being submitted, not with what was picked.
   */
  geoFor(current: AddressFieldValues): PickedAddressGeo | null {
    return geoFromPick(this.pick, this.fingerprint, current);
  }

  /** True when the user was warned that this address cannot be located. */
  isUnlocated(): boolean {
    return this.geo().kind === 'not_found';
  }

  /** For a form that reuses one store across a reset. */
  clear(): void {
    this.pick = null;
    this.fingerprint = null;
    this.geo.set({ kind: 'idle' });
  }
}

/**
 * Merge a picked coordinate into an address payload.
 *
 * `latitude`/`longitude` reach the backend as a caller-supplied pin, which
 * `AddressRepository.addAddress` stores directly — so a register pick lands on
 * the map without waiting for a geocoder round trip.
 */
export function withPickedGeo<T extends object>(address: T, geo: PickedAddressGeo | null): T {
  if (!geo) {
    return address;
  }
  return {
    ...address,
    latitude: geo.latitude,
    longitude: geo.longitude,
    ...(geo.best_address_id ? { best_address_id: geo.best_address_id } : {}),
    ...(geo.country ? { country: geo.country } : {}),
  };
}
