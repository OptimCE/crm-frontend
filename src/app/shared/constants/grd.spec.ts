import { findGrdOption, GRD_OPTIONS } from './grd';

const names = GRD_OPTIONS.map((option) => option.name);

describe('GRD_OPTIONS', () => {
  it('lists the 14 electricity GRDs once each', () => {
    expect(names).toHaveLength(14);
    expect(new Set(names).size).toBe(names.length);
  });

  it('offers neither the transmission operator nor the gas-only Enexis', () => {
    const upper = names.map((name) => name.toUpperCase());
    expect(upper).not.toContain('ELIA');
    expect(upper.some((name) => name.includes('ENEXIS'))).toBe(false);
  });

  it('covers Wallonia, Brussels and the eight Flemish entities', () => {
    expect(names).toEqual(expect.arrayContaining(['ORES', 'RESA', 'AIEG', 'AIESH', 'REW']));
    expect(names).toContain('Sibelga');
    expect(names.filter((name) => name.startsWith('Fluvius '))).toHaveLength(8);
  });
});

describe('findGrdOption', () => {
  it('matches a stored value ignoring case and surrounding spaces', () => {
    expect(findGrdOption(' ores ')?.name).toBe('ORES');
    expect(findGrdOption('SIBELGA')?.name).toBe('Sibelga');
    expect(findGrdOption('fluvius west')?.name).toBe('Fluvius West');
  });

  it('returns the shared option object', () => {
    expect(findGrdOption('RESA')).toBe(GRD_OPTIONS.find((option) => option.name === 'RESA'));
  });

  it.each(['ELIA', 'Fluvius', 'Enexis', '', '   ', null, undefined])(
    'gives nothing for %j',
    (value) => {
      expect(findGrdOption(value)).toBeUndefined();
    },
  );
});
