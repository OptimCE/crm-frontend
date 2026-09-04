import { AddressDTO } from '../../../../../../../../shared/dtos/address.dtos';
import { UserDTO } from '../../../../../../../../shared/dtos/user.dtos';
import { MemberType } from '../../../../../../../../shared/types/member.types';
import { buildProfilePrefill, countPatched, envelopeData } from './encode-new-member-prefill';

function address(overrides: Partial<AddressDTO> = {}): AddressDTO {
  return {
    id: 1,
    street: 'Rue de la Loi',
    number: '16',
    postcode: '1000',
    supplement: 'Bte 3',
    city: 'Bruxelles',
    ...overrides,
  };
}

function user(overrides: Partial<UserDTO> = {}): UserDTO {
  return {
    id: 7,
    email: 'alice@example.be',
    first_name: 'Alice',
    last_name: 'Dupont',
    nrn: '85073003328',
    phone_number: '+32470112233',
    iban: 'BE68539007547034',
    home_address: address(),
    billing_address: address({ id: 2, street: 'Avenue Louise', number: '200' }),
    ...overrides,
  };
}

describe('envelopeData', () => {
  it('returns the payload of a successful response', () => {
    expect(envelopeData<number[]>({ data: [1, 2], error_code: 0 })).toEqual([1, 2]);
  });

  it('rejects the 200-with-a-message-string failure envelope', () => {
    expect(envelopeData({ data: 'Something went wrong', error_code: 42 })).toBeNull();
  });

  it('rejects a string payload even when the error code says success', () => {
    expect(envelopeData({ data: 'still a string', error_code: 0 })).toBeNull();
  });

  it('tolerates a missing response', () => {
    expect(envelopeData(null)).toBeNull();
  });
});

describe('buildProfilePrefill - no type chosen yet', () => {
  it('fills nothing while the member type is unknown', () => {
    const prefill = buildProfilePrefill(user(), -1, false);

    expect(prefill.informations).toEqual({});
    expect(prefill.address).toEqual({});
    expect(prefill.iban).toBeNull();
    expect(prefill.sameAddress).toBe(false);
    expect(countPatched(prefill)).toBe(0);
  });
});

describe('buildProfilePrefill - individual', () => {
  it('maps the profile onto the wizard, keeping first/last name crossed', () => {
    const prefill = buildProfilePrefill(user(), MemberType.INDIVIDUAL, false);

    // In this wizard `name` is the FIRST name and `surname` the LAST name.
    expect(prefill.informations).toEqual({
      id: '85073003328',
      name: 'Alice',
      surname: 'Dupont',
      email: 'alice@example.be',
      phone: '+32470112233',
    });
  });

  it('never prefills the social rate, which the profile does not hold', () => {
    const prefill = buildProfilePrefill(user(), MemberType.INDIVIDUAL, false);
    expect(prefill.informations['socialRate']).toBeUndefined();
  });

  it('flattens both addresses and stringifies the house number', () => {
    const prefill = buildProfilePrefill(user(), MemberType.INDIVIDUAL, false);

    expect(prefill.address).toEqual({
      home_address_street: 'Rue de la Loi',
      home_address_number: '16',
      home_address_postcode: '1000',
      home_address_supplement: 'Bte 3',
      home_address_city: 'Bruxelles',
      billing_address_street: 'Avenue Louise',
      billing_address_number: '200',
      billing_address_postcode: '1000',
      billing_address_supplement: 'Bte 3',
      billing_address_city: 'Bruxelles',
    });
  });

  it('carries the IBAN', () => {
    expect(buildProfilePrefill(user(), MemberType.INDIVIDUAL, false).iban).toBe('BE68539007547034');
  });

  it('adds the manager block when the gestionnaire checkbox is on', () => {
    const prefill = buildProfilePrefill(user(), MemberType.INDIVIDUAL, true);

    expect(prefill.informations).toMatchObject({
      name: 'Alice',
      NRN_manager: '85073003328',
      name_manager: 'Alice',
      surname_manager: 'Dupont',
      email_manager: 'alice@example.be',
      phone_manager: '+32470112233',
    });
  });
});

describe('buildProfilePrefill - same address detection', () => {
  it('reports "same address" when there is no billing address on file', () => {
    const prefill = buildProfilePrefill(
      user({ billing_address: undefined }),
      MemberType.INDIVIDUAL,
      false,
    );

    expect(prefill.sameAddress).toBe(true);
    // Nothing to copy into controls the form is about to remove.
    expect(Object.keys(prefill.address).some((k) => k.startsWith('billing_'))).toBe(false);
  });

  it('reports "same address" when billing matches home field for field', () => {
    const prefill = buildProfilePrefill(
      user({ billing_address: address({ id: 99 }) }),
      MemberType.INDIVIDUAL,
      false,
    );

    expect(prefill.sameAddress).toBe(true);
  });

  it('reports distinct addresses when any field differs', () => {
    expect(buildProfilePrefill(user(), MemberType.INDIVIDUAL, false).sameAddress).toBe(false);
  });
});

describe('buildProfilePrefill - company', () => {
  it('fills the manager block only, never the company or its bank details', () => {
    const prefill = buildProfilePrefill(user(), MemberType.COMPANY, true);

    expect(prefill.informations).toEqual({
      NRN_manager: '85073003328',
      name_manager: 'Alice',
      surname_manager: 'Dupont',
      email_manager: 'alice@example.be',
      phone_manager: '+32470112233',
    });
    // A company identity and its bank details are not the user's personal ones.
    expect(prefill.informations['id']).toBeUndefined();
    expect(prefill.informations['name']).toBeUndefined();
    expect(prefill.informations['vatNumber']).toBeUndefined();
    expect(prefill.address).toEqual({});
    expect(prefill.iban).toBeNull();
    expect(prefill.sameAddress).toBe(false);
  });
});

describe('buildProfilePrefill - sparse profiles', () => {
  it('omits blank values rather than writing empty strings', () => {
    const sparse = user({
      first_name: null,
      last_name: '   ',
      nrn: null,
      phone_number: undefined,
      iban: '',
      home_address: undefined,
      billing_address: undefined,
    });

    const prefill = buildProfilePrefill(sparse, MemberType.INDIVIDUAL, false);

    // A freshly provisioned account holds nothing but the email.
    expect(prefill.informations).toEqual({ email: 'alice@example.be' });
    expect(prefill.address).toEqual({});
    expect(prefill.iban).toBeNull();
    expect(countPatched(prefill)).toBe(1);
  });

  it('trims the values it does keep', () => {
    const prefill = buildProfilePrefill(
      user({ first_name: '  Alice  ' }),
      MemberType.INDIVIDUAL,
      false,
    );

    expect(prefill.informations['name']).toBe('Alice');
  });

  it('drops an optional address supplement without dropping the address', () => {
    const prefill = buildProfilePrefill(
      user({ home_address: address({ supplement: undefined }), billing_address: undefined }),
      MemberType.INDIVIDUAL,
      false,
    );

    expect(prefill.address['home_address_supplement']).toBeUndefined();
    expect(prefill.address['home_address_street']).toBe('Rue de la Loi');
  });
});

describe('countPatched', () => {
  it('counts every control the prefill would populate', () => {
    // 5 informations + 10 address + 1 iban, with a distinct billing address.
    expect(countPatched(buildProfilePrefill(user(), MemberType.INDIVIDUAL, false))).toBe(16);
  });

  it('ignores billing controls the form removes when "same address" is on', () => {
    const prefill = buildProfilePrefill(
      user({ billing_address: address({ id: 99 }) }),
      MemberType.INDIVIDUAL,
      false,
    );

    // 5 informations + 5 home address + 1 iban; the billing half never lands.
    expect(prefill.sameAddress).toBe(true);
    expect(countPatched(prefill)).toBe(11);
  });
});
