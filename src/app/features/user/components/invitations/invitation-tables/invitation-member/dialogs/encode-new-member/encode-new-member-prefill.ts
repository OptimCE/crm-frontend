import { ApiResponse } from '../../../../../../../../core/dtos/api.response';
import { AddressDTO } from '../../../../../../../../shared/dtos/address.dtos';
import { UserDTO } from '../../../../../../../../shared/dtos/user.dtos';
import { MemberType } from '../../../../../../../../shared/types/member.types';

/**
 * Pure mapping from the signed-in user's own profile onto the self-encode wizard.
 *
 * A user invited to self-encode retypes what `GET /users/` already holds: name,
 * national number, phone, IBAN and both addresses. This module decides *what*
 * gets copied where; the component only applies the result. Keeping the decision
 * here is what makes it testable — component specs need a TestBed, which this
 * repo's pinned Node cannot run.
 *
 * Two naming traps are deliberately preserved rather than "fixed":
 * the wizard's `name` control is the **first** name and `surname` is the **last**
 * name (see `MEMBER.ADD.INFORMATIONS.*_LABEL` in the step template), and the
 * manager block repeats the same pair with a `_manager` suffix.
 */

/** Patches to apply to the three form groups of the wizard. */
export interface ProfilePrefill {
  /** Values for the step-1 `formData` group, keyed by control name. */
  informations: Record<string, string>;
  /** Values for the step-2 `addressForm` group, keyed by control name. */
  address: Record<string, string>;
  /** Value for the step-3 `ibanForm` group, or null when the profile has none. */
  iban: string | null;
  /** True when billing is absent or field-identical to home. */
  sameAddress: boolean;
}

/**
 * Reject the 200-with-a-message failure envelope.
 *
 * The backend reuses the success envelope for failures: HTTP 200, `data` as a
 * translated string, non-zero `error_code`. Duplicated per feature in this repo
 * (`home-format.ts`, `dashboard-format.ts`) rather than shared.
 */
export function envelopeData<T>(response: ApiResponse<T | string> | null | undefined): T | null {
  if (!response) return null;
  const { data, error_code } = response;
  if (error_code !== undefined && error_code !== 0) return null;
  if (typeof data === 'string') return null;
  return (data ?? null) as T | null;
}

/**
 * A profile value worth copying.
 *
 * Blank is not a value: emitting `''` would write over a control for no gain and
 * would inflate the "N fields filled" count with fields the user still has to
 * type. Only a non-empty string survives.
 */
function usable(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Copy `value` into `target[key]` when there is something to copy. */
function put(target: Record<string, string>, key: string, value: string | null | undefined): void {
  const kept = usable(value);
  if (kept !== null) target[key] = kept;
}

/** Flatten one address onto the `home_`/`billing_` prefixed controls. */
function putAddress(
  target: Record<string, string>,
  prefix: 'home_address' | 'billing_address',
  address: AddressDTO | undefined,
): void {
  if (!address) return;
  put(target, `${prefix}_street`, address.street);
  // The control is a text input; `AddressDTO.number` is numeric.
  put(target, `${prefix}_number`, address.number != null ? String(address.number) : null);
  put(target, `${prefix}_postcode`, address.postcode);
  put(target, `${prefix}_supplement`, address.supplement);
  put(target, `${prefix}_city`, address.city);
}

/** True when the two addresses would produce the same five control values. */
function sameAddresses(home: AddressDTO | undefined, billing: AddressDTO | undefined): boolean {
  // No billing on file means "same as home" — that is what the checkbox says.
  if (!billing) return true;
  if (!home) return false;
  return (
    usable(home.street) === usable(billing.street) &&
    home.number === billing.number &&
    usable(home.postcode) === usable(billing.postcode) &&
    usable(home.supplement) === usable(billing.supplement) &&
    usable(home.city) === usable(billing.city)
  );
}

/**
 * Build the patches for the member type currently selected.
 *
 * @param type `-1` while the user has not chosen yet, in which case there is
 *   nothing to fill: the step-1 controls do not exist and whether the address
 *   applies at all depends on the answer.
 * @param withManager whether the "gestionnaire" block is currently on the form.
 *   Always true for a company; opt-in for an individual.
 */
export function buildProfilePrefill(
  user: UserDTO,
  type: MemberType | -1,
  withManager: boolean,
): ProfilePrefill {
  const informations: Record<string, string> = {};
  const address: Record<string, string> = {};
  let iban: string | null = null;

  if (type === MemberType.INDIVIDUAL) {
    put(informations, 'id', user.nrn);
    put(informations, 'name', user.first_name);
    put(informations, 'surname', user.last_name);
    put(informations, 'email', user.email);
    put(informations, 'phone', user.phone_number);
    // `socialRate` has no profile equivalent — the user must answer it.

    putAddress(address, 'home_address', user.home_address);
    // Only the real billing address: when there is none, `sameAddress` is true and
    // the billing controls are removed from the form entirely.
    putAddress(address, 'billing_address', user.billing_address);
    iban = usable(user.iban);
  }

  // The manager is the natural person representing the member — that is the
  // invited user. For a company this is the only thing worth copying: its name,
  // company number, VAT, IBAN and registered address are not the user's own.
  if (type !== -1 && withManager) {
    put(informations, 'NRN_manager', user.nrn);
    put(informations, 'name_manager', user.first_name);
    put(informations, 'surname_manager', user.last_name);
    put(informations, 'email_manager', user.email);
    put(informations, 'phone_manager', user.phone_number);
  }

  return {
    informations,
    address,
    iban,
    sameAddress:
      type === MemberType.INDIVIDUAL && sameAddresses(user.home_address, user.billing_address),
  };
}

/** How many controls this prefill would populate. Drives the confirmation copy. */
export function countPatched(prefill: ProfilePrefill): number {
  const addressKeys = prefill.sameAddress
    ? // The billing controls are removed from the form when "same address" is on,
      // so the billing half of the patch never lands and must not be counted.
      Object.keys(prefill.address).filter((key) => !key.startsWith('billing_address')).length
    : Object.keys(prefill.address).length;
  return Object.keys(prefill.informations).length + addressKeys + (prefill.iban !== null ? 1 : 0);
}
