import { FormControl, FormGroup } from '@angular/forms';
import { AddressGeoPrecision, AddressSuggestionDTO } from '../../dtos/geocoding.dtos';
import {
  AddressFieldValues,
  addressFingerprint,
  fieldsFromSuggestion,
  geoFromPick,
  isAddressComplete,
  isAddressEmpty,
  nestedAddressNames,
  prefixedAddressNames,
  readAddressFields,
} from './address-field-source';

function flatForm(): FormGroup {
  return new FormGroup({
    home_address_street: new FormControl('Rue de la Loi'),
    home_address_number: new FormControl('16'),
    home_address_supplement: new FormControl(''),
    home_address_postcode: new FormControl('1000'),
    home_address_city: new FormControl('Bruxelles'),
  });
}

function nestedForm(): FormGroup {
  return new FormGroup({
    headquarters_address: new FormGroup({
      street: new FormControl('Place de la Station'),
      number: new FormControl('20A'),
      supplement: new FormControl(''),
      postcode: new FormControl('5000'),
      city: new FormControl('Namur'),
    }),
  });
}

const FIELDS: AddressFieldValues = {
  street: 'Rue de la Loi',
  number: '16',
  supplement: '',
  postcode: '1000',
  city: 'Bruxelles',
};

describe('address-field-source', () => {
  describe('reading through both naming conventions', () => {
    it('reads flat prefixed controls', () => {
      const values = readAddressFields({
        group: flatForm(),
        names: prefixedAddressNames('home_address'),
      });
      expect(values).toEqual(FIELDS);
    });

    it('reads a nested group through a dotted path', () => {
      // The community form nests its address; `FormGroup.get()` taking a dotted
      // path is what lets one component serve both conventions.
      const values = readAddressFields({
        group: nestedForm(),
        names: nestedAddressNames('headquarters_address'),
      });
      expect(values.street).toBe('Place de la Station');
      expect(values.number).toBe('20A');
    });

    it('still reads a DISABLED control', () => {
      // user-update-dialog disables the billing block rather than removing it.
      // `FormGroup.value` omits disabled children, so reading the group as a
      // whole would silently lose the address it is meant to check.
      const form = flatForm();
      form.get('home_address_street')?.disable();
      const values = readAddressFields({
        group: form,
        names: prefixedAddressNames('home_address'),
      });
      expect(values.street).toBe('Rue de la Loi');
    });

    it('reads a MISSING control as empty rather than throwing', () => {
      // The member wizard genuinely removes its billing controls when "same
      // address" is ticked.
      const values = readAddressFields({
        group: new FormGroup({}),
        names: prefixedAddressNames('billing_address'),
      });
      expect(values).toEqual({ street: '', number: '', supplement: '', postcode: '', city: '' });
    });

    it('reads a numeric control value as a string', () => {
      const form = new FormGroup({ home_address_number: new FormControl(16) });
      const values = readAddressFields({
        group: form,
        names: prefixedAddressNames('home_address'),
      });
      expect(values.number).toBe('16');
    });
  });

  describe('addressFingerprint', () => {
    it('ignores case and whitespace', () => {
      expect(addressFingerprint({ ...FIELDS, street: '  RUE  DE   LA loi ' })).toBe(
        addressFingerprint(FIELDS),
      );
    });

    it('changes when the house number changes', () => {
      // This is the whole point: pick "…12", hand-edit to 14, and the captured
      // coordinate now points at the wrong building.
      expect(addressFingerprint({ ...FIELDS, number: '14' })).not.toBe(addressFingerprint(FIELDS));
    });

    it('changes when the box number changes', () => {
      expect(addressFingerprint({ ...FIELDS, supplement: 'B3' })).not.toBe(
        addressFingerprint(FIELDS),
      );
    });
  });

  describe('completeness', () => {
    it('is complete with the four required fields and no supplement', () => {
      expect(isAddressComplete(FIELDS)).toBe(true);
    });

    it('is incomplete when the house number is missing', () => {
      expect(isAddressComplete({ ...FIELDS, number: '  ' })).toBe(false);
    });

    it('distinguishes EMPTY from INCOMPLETE', () => {
      // The profile and community forms both allow a fully empty address;
      // probing one would warn about an address the user never claimed to have.
      const empty = { street: '', number: '', supplement: '', postcode: '', city: '' };
      expect(isAddressEmpty(empty)).toBe(true);
      expect(isAddressEmpty({ ...empty, street: 'Rue' })).toBe(false);
      expect(isAddressComplete({ ...empty, street: 'Rue' })).toBe(false);
    });
  });

  describe('fieldsFromSuggestion', () => {
    const addressRow: AddressSuggestionDTO = {
      id: 'a1',
      kind: 'address',
      label: 'Place de la Station 20A, 5000 Namur',
      street: 'Place de la Station',
      number: '20A',
      postcode: '5000',
      city: 'Namur',
      country: 'BE',
    };

    it('takes everything from an address row', () => {
      expect(fieldsFromSuggestion(addressRow, FIELDS)).toEqual({
        street: 'Place de la Station',
        number: '20A',
        supplement: '',
        postcode: '5000',
        city: 'Namur',
      });
    });

    it('keeps the typed house number when a STREET row is picked', () => {
      // A street row carries no number; blanking it would punish someone who
      // picked a street just to fix the spelling.
      const streetRow: AddressSuggestionDTO = { ...addressRow, kind: 'street', number: undefined };
      expect(fieldsFromSuggestion(streetRow, FIELDS).number).toBe('16');
    });

    it('never discards the box number, which no suggestion carries', () => {
      expect(fieldsFromSuggestion(addressRow, { ...FIELDS, supplement: 'B3' }).supplement).toBe(
        'B3',
      );
    });
  });

  describe('geoFromPick', () => {
    const pick: AddressSuggestionDTO = {
      id: 'a1',
      kind: 'address',
      label: 'Rue de la Loi 16, 1000 Bruxelles',
      street: 'Rue de la Loi',
      number: '16',
      postcode: '1000',
      city: 'Bruxelles',
      country: 'BE',
      latitude: 50.846169,
      longitude: 4.366538,
      precision: AddressGeoPrecision.ROOFTOP,
      best_address_id: 'best:1',
    };

    it('returns the coordinate while the form still matches the pick', () => {
      expect(geoFromPick(pick, addressFingerprint(FIELDS), FIELDS)).toEqual({
        latitude: 50.846169,
        longitude: 4.366538,
        best_address_id: 'best:1',
        country: 'BE',
      });
    });

    it('returns null once the user edits away from the pick', () => {
      // The failure this exists to prevent: submitting a rooftop coordinate for
      // a house number the user has since changed.
      const edited = { ...FIELDS, number: '18' };
      expect(geoFromPick(pick, addressFingerprint(FIELDS), edited)).toBeNull();
    });

    it('returns null when nothing was picked', () => {
      expect(geoFromPick(null, null, FIELDS)).toBeNull();
    });

    it('returns null for a picked row that has no coordinate', () => {
      // Street rows, and register addresses with no recorded position.
      const noPoint = { ...pick, latitude: undefined, longitude: undefined };
      expect(geoFromPick(noPoint, addressFingerprint(FIELDS), FIELDS)).toBeNull();
    });
  });
});
