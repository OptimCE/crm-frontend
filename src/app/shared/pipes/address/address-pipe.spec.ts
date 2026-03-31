import { AddressPipe } from './address-pipe';
import { AddressDTO } from '../../dtos/address.dtos';

describe('AddressPipe', () => {
  let pipe: AddressPipe;

  beforeEach(() => {
    pipe = new AddressPipe();
  });

  it('create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('should format a standard address correctly', () => {
    const address: AddressDTO = {
      id: 1,
      street: 'Rue de la Loi',
      number: 42,
      postcode: '1000',
      city: 'Bruxelles',
    };

    expect(pipe.transform(address)).toBe('Rue de la Loi 42<br>1000 Bruxelles');
  });

  it('should format a different address correctly', () => {
    const address: AddressDTO = {
      id: 2,
      street: 'Avenue Louise',
      number: 100,
      postcode: '1050',
      city: 'Ixelles',
    };

    expect(pipe.transform(address)).toBe('Avenue Louise 100<br>1050 Ixelles');
  });

  it('should handle numeric street number without padding', () => {
    const address: AddressDTO = {
      id: 3,
      street: 'Grand Place',
      number: 1,
      postcode: '1000',
      city: 'Bruxelles',
    };

    expect(pipe.transform(address)).toBe('Grand Place 1<br>1000 Bruxelles');
  });

  it('should handle empty string values', () => {
    const address: AddressDTO = {
      id: 4,
      street: '',
      number: 0,
      postcode: '',
      city: '',
    };

    expect(pipe.transform(address)).toBe(' 0<br> ');
  });

  it('should not include supplement in the output', () => {
    const address: AddressDTO = {
      id: 5,
      street: 'Rue Haute',
      number: 10,
      postcode: '1000',
      city: 'Bruxelles',
      supplement: 'Boîte 3',
    };

    const result = pipe.transform(address);
    expect(result).toBe('Rue Haute 10<br>1000 Bruxelles');
    expect(result).not.toContain('Boîte 3');
  });
});
