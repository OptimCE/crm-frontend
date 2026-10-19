import { signal } from '@angular/core';
import { AddressSuggestionDTO } from '../../dtos/geocoding.dtos';
import { AddressGeoState, AddressPicked } from './address-autocomplete';
import { AddressFieldValues, addressFingerprint, geoFromPick } from './address-field-source';

/** The extra fields a picked suggestion contributes to an address payload. */
export interface PickedAddressGeo {
  latitude: number;
  longitude: number;
  best_address_id?: string;
  country?: string;
}

/**
 * What a picked suggestion tells the GRD lookup that typed text cannot: the
 * commune's NIS code and the locality inside it. Sent as GET parameters, never
 * stored.
 */
export interface PickedDsoHint {
  nis_code?: number;
  post_name?: string;
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

  /**
   * The register's commune code and locality name, for the GRD lookup, or null if
   * the form no longer matches the pick (the rule of {@link geoFor}) or the pick
   * carried neither.
   *
   * Without it the lookup still runs on the typed postcode and city; it just asks
   * more often which locality the address is in.
   */
  dsoHintFor(current: AddressFieldValues): PickedDsoHint | null {
    if (!this.pick || this.fingerprint === null) {
      return null;
    }
    if (this.fingerprint !== addressFingerprint(current)) {
      return null;
    }
    const hint: PickedDsoHint = {
      ...(this.pick.nis_code !== undefined && this.pick.nis_code !== null
        ? { nis_code: this.pick.nis_code }
        : {}),
      ...(this.pick.post_name?.trim() ? { post_name: this.pick.post_name.trim() } : {}),
    };
    return Object.keys(hint).length > 0 ? hint : null;
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
