import { AddressGeoPrecision, AddressSuggestionDTO } from '../../dtos/geocoding.dtos';
import { AddressPicked } from './address-autocomplete';
import { AddressFieldValues, addressFingerprint } from './address-field-source';
import { AddressPickStore, withPickedGeo } from './address-pick-store';

const FIELDS: AddressFieldValues = {
  street: 'Rue de la Loi',
  number: '16',
  supplement: '',
  postcode: '1000',
  city: 'Bruxelles',
};

const SUGGESTION: AddressSuggestionDTO = {
  id: 'best:1',
  kind: 'address',
  label: 'Rue de la Loi 16, 1000 Bruxelles',
  street: FIELDS.street,
  number: FIELDS.number,
  postcode: FIELDS.postcode,
  city: FIELDS.city,
  country: 'BE',
  latitude: 50.846169,
  longitude: 4.366538,
  precision: AddressGeoPrecision.ROOFTOP,
  best_address_id: 'best:1',
};

function pick(over: Partial<AddressSuggestionDTO> = {}, fields = FIELDS): AddressPicked {
  return {
    suggestion: { ...SUGGESTION, ...over },
    fields,
    fingerprint: addressFingerprint(fields),
  };
}

describe('AddressPickStore', () => {
  let store: AddressPickStore;

  beforeEach(() => {
    store = new AddressPickStore();
  });

  it('has nothing to contribute before anything is picked', () => {
    expect(store.geoFor(FIELDS)).toBeNull();
    expect(store.geo()).toEqual({ kind: 'idle' });
  });

  it('returns the coordinate while the form still matches the pick', () => {
    store.remember(pick());

    expect(store.geoFor(FIELDS)).toEqual({
      latitude: 50.846169,
      longitude: 4.366538,
      best_address_id: 'best:1',
      country: 'BE',
    });
  });

  it('DROPS the coordinate once the house number is edited', () => {
    // The failure this exists to prevent: pick "…16", hand-edit to 18, and the
    // rooftop coordinate now points at the wrong building — a lie the map would
    // render confidently.
    store.remember(pick());

    expect(store.geoFor({ ...FIELDS, number: '18' })).toBeNull();
  });

  it('drops it when the street changes too', () => {
    store.remember(pick());

    expect(store.geoFor({ ...FIELDS, street: 'Rue Neuve' })).toBeNull();
  });

  it('survives a purely cosmetic re-typing', () => {
    // Re-typing "RUE" over "Rue" is not a move, so the pin should stand.
    store.remember(pick());

    expect(store.geoFor({ ...FIELDS, street: '  RUE  DE   LA loi ' })).not.toBeNull();
  });

  it('contributes nothing for a pick that carried no coordinate', () => {
    // Street rows, and register addresses the regions have not positioned.
    store.remember(pick({ latitude: undefined, longitude: undefined }));

    expect(store.geoFor(FIELDS)).toBeNull();
  });

  it('replaces an earlier pick rather than accumulating', () => {
    const other = { ...FIELDS, street: 'Rue Neuve', number: '40' };
    store.remember(pick());
    store.remember(
      pick({ latitude: 50.851609, longitude: 4.354555, best_address_id: 'best:2' }, other),
    );

    expect(store.geoFor(FIELDS)).toBeNull();
    expect(store.geoFor(other)?.best_address_id).toBe('best:2');
  });

  it('tracks what the strip is saying', () => {
    store.observe({ kind: 'not_found', suggestions: [] });

    expect(store.geo().kind).toBe('not_found');
    expect(store.isUnlocated()).toBe(true);

    store.observe({
      kind: 'found',
      precision: AddressGeoPrecision.ROOFTOP,
      latitude: 1,
      longitude: 2,
    });
    expect(store.isUnlocated()).toBe(false);
  });

  it('clear() forgets the pick as well as the state', () => {
    // The repair dialog reuses one store as it walks from meter to meter;
    // carrying a coordinate across rows would put one meter on another's roof.
    store.remember(pick());
    store.observe({
      kind: 'found',
      precision: AddressGeoPrecision.ROOFTOP,
      latitude: 1,
      longitude: 2,
    });

    store.clear();

    expect(store.geoFor(FIELDS)).toBeNull();
    expect(store.geo()).toEqual({ kind: 'idle' });
  });
});

describe('withPickedGeo', () => {
  const address = { street: 'Rue de la Loi', number: '16', postcode: '1000', city: 'Bruxelles' };

  it('returns the address untouched when there is no coordinate to add', () => {
    expect(withPickedGeo(address, null)).toBe(address);
  });

  it('merges the coordinate and the register id', () => {
    const merged = withPickedGeo(address, {
      latitude: 50.846169,
      longitude: 4.366538,
      best_address_id: 'best:1',
      country: 'BE',
    });

    expect(merged).toEqual({
      ...address,
      latitude: 50.846169,
      longitude: 4.366538,
      best_address_id: 'best:1',
      country: 'BE',
    });
  });

  it('omits an absent register id rather than sending undefined', () => {
    const merged = withPickedGeo(address, { latitude: 50.8, longitude: 4.3 });

    expect(merged).not.toHaveProperty('best_address_id');
    expect(merged).not.toHaveProperty('country');
  });

  it('does not mutate the address it was given', () => {
    const original = { ...address };
    withPickedGeo(original, { latitude: 50.8, longitude: 4.3 });

    expect(original).toEqual(address);
  });
});
