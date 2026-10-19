import { DsoOperatorDTO } from '../dtos/dso.dtos';
import { ELIA_OPTION_ID, findGrdOption, GRD_OPTIONS, grdLabel, grdSelectOptions } from './grd';

const ids = GRD_OPTIONS.map((option) => option.id);
const names = GRD_OPTIONS.map((option) => option.name);
const ELIA_LABEL = 'Elia — réseau de transport local (30–70 kV)';

function operator(id: string, name: string, over: Partial<DsoOperatorDTO> = {}): DsoOperatorDTO {
  return {
    id,
    kind: 'grd',
    name,
    legal_name: name,
    region: 'WAL',
    elec: true,
    gas: false,
    website: '',
    regulator: 'BE-WAL-CWAPE',
    tariffs_url: '',
    lookup: true,
    replaced_by: null,
    ...over,
  };
}

describe('GRD_OPTIONS', () => {
  it('lists the 14 electricity GRDs once each, ORES first', () => {
    expect(GRD_OPTIONS).toHaveLength(14);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
    expect(ids[0]).toBe('ores');
  });

  it('holds only distribution operators: Elia is offered apart, Enexis not at all', () => {
    // Enexis (the Baarle-Hertog enclaves) distributes gas only.
    expect(GRD_OPTIONS.every((option) => option.kind === 'grd')).toBe(true);
    expect(ids).not.toContain(ELIA_OPTION_ID);
    expect(ids.some((id) => id.includes('enexis'))).toBe(false);
  });

  it('covers Wallonia, Brussels and the eight Flemish entities', () => {
    expect(ids).toEqual(expect.arrayContaining(['ores', 'resa', 'aieg', 'aiesh', 'rew']));
    expect(ids).toContain('sibelga');
    expect(ids.filter((id) => id.startsWith('fluvius-'))).toHaveLength(8);
  });

  it('uses stable lower-case ids, as stored in meter_data.grd', () => {
    for (const id of ids) {
      expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
    expect(findGrdOption('fluvius-midden-vlaanderen')?.name).toBe('Fluvius Midden-Vlaanderen');
  });
});

describe('grdSelectOptions', () => {
  it('without a catalogue: the 14 GRDs, then Elia, last, under its label', () => {
    for (const catalogue of [null, undefined, []]) {
      const options = grdSelectOptions(catalogue, ELIA_LABEL);

      expect(options).toHaveLength(15);
      expect(options.slice(0, 14)).toEqual(GRD_OPTIONS);
      expect(options[14]).toEqual({ id: 'elia', name: ELIA_LABEL, kind: 'grtl' });
    }
  });

  it('never puts Elia first', () => {
    expect(grdSelectOptions(null, ELIA_LABEL)[0].id).toBe('ores');
  });

  it('returns a fresh array, which p-select may mutate', () => {
    const options = grdSelectOptions(null, ELIA_LABEL);
    options[0].name = 'changed';

    expect(GRD_OPTIONS[0].name).toBe('ORES');
  });

  it('sorts the catalogue back to the static order when it lists AIEG first', () => {
    const options = grdSelectOptions(
      [
        operator('aieg', 'AIEG'),
        operator('aiesh', 'AIESH'),
        operator('ores', 'ORES'),
        operator('sibelga', 'Sibelga', { region: 'BRU' }),
        operator('fluvius-west', 'Fluvius West', { region: 'VLA' }),
      ],
      ELIA_LABEL,
    );

    expect(options.map((option) => option.id)).toEqual([
      'ores',
      'aieg',
      'aiesh',
      'sibelga',
      'fluvius-west',
      'elia',
    ]);
  });

  it('puts an operator the static list does not know after the known ones, before Elia', () => {
    const options = grdSelectOptions(
      [
        operator('fluvius-noord', 'Fluvius Noord', { region: 'VLA' }),
        operator('ores', 'ORES'),
        operator('fluvius-zuid', 'Fluvius Zuid', { region: 'VLA' }),
      ],
      ELIA_LABEL,
    );

    expect(options.map((option) => option.id)).toEqual([
      'ores',
      'fluvius-noord',
      'fluvius-zuid',
      'elia',
    ]);
  });

  it('offers only current electricity GRDs', () => {
    const options = grdSelectOptions(
      [
        operator('ores', 'ORES'),
        operator('enexis', 'Enexis', { kind: 'gas_foreign', elec: false, gas: true }),
        operator('elia', 'Elia', { kind: 'grtl', lookup: false }),
        operator('gas-only', 'Gas only', { elec: false, gas: true }),
        operator('no-lookup', 'No lookup', { lookup: false }),
        operator('fluvius-merged', 'Fluvius Merged', { replaced_by: 'fluvius-west' }),
      ],
      ELIA_LABEL,
    );

    // Elia appears once: appended by the function, not taken from the catalogue.
    expect(options).toEqual([
      { id: 'ores', name: 'ORES', kind: 'grd' },
      { id: 'elia', name: ELIA_LABEL, kind: 'grtl' },
    ]);
  });

  it('falls back to the static list when the catalogue offers no GRD at all', () => {
    const options = grdSelectOptions(
      [operator('elia', 'Elia', { kind: 'grtl', lookup: false })],
      ELIA_LABEL,
    );

    expect(options).toHaveLength(15);
  });

  it('labels Elia by its short name until the translation is there', () => {
    expect(grdSelectOptions(null, '').at(-1)?.name).toBe('Elia');
  });
});

describe('findGrdOption', () => {
  it('matches a stable id', () => {
    expect(findGrdOption('ores')?.name).toBe('ORES');
    expect(findGrdOption('fluvius-imewo')?.name).toBe('Fluvius Imewo');
  });

  it('maps the legacy names saved before the ids to their id', () => {
    expect(findGrdOption('RESA')?.id).toBe('resa');
    expect(findGrdOption('Sibelga')?.id).toBe('sibelga');
    expect(findGrdOption('Fluvius Imewo')?.id).toBe('fluvius-imewo');
    expect(findGrdOption('Fluvius Halle-Vilvoorde')?.id).toBe('fluvius-halle-vilvoorde');
  });

  it('ignores case, surrounding spaces and the space/hyphen difference, as crm-backend does', () => {
    expect(findGrdOption(' ores ')?.id).toBe('ores');
    expect(findGrdOption('SIBELGA')?.id).toBe('sibelga');
    expect(findGrdOption('fluvius west')?.id).toBe('fluvius-west');
    expect(findGrdOption('Fluvius-Imewo')?.id).toBe('fluvius-imewo');
    expect(findGrdOption('FLUVIUS  HALLE VILVOORDE')?.id).toBe('fluvius-halle-vilvoorde');
  });

  it('maps a legacy ELIA to the Elia option, now that it is one', () => {
    expect(findGrdOption('ELIA')).toEqual({ id: 'elia', name: 'Elia', kind: 'grtl' });
    expect(findGrdOption('elia')?.id).toBe(ELIA_OPTION_ID);
  });

  it('returns the shared option object', () => {
    expect(findGrdOption('RESA')).toBe(GRD_OPTIONS.find((option) => option.id === 'resa'));
  });

  it.each(['Fluvius', 'Enexis', 'fluvius-', 'unknown', '', '   ', null, undefined])(
    'gives nothing for %j',
    (value) => {
      // A bare "Fluvius" names none of the eight entities: the user has to pick one.
      expect(findGrdOption(value)).toBeUndefined();
    },
  );
});

describe('grdLabel', () => {
  it("gives the operator's name for an id or a legacy name", () => {
    expect(grdLabel('fluvius-imewo')).toBe('Fluvius Imewo');
    expect(grdLabel('resa')).toBe('RESA');
    expect(grdLabel('ELIA')).toBe('Elia');
  });

  it('gives the raw value it does not know, and nothing for nothing', () => {
    expect(grdLabel('Fluvius')).toBe('Fluvius');
    expect(grdLabel('fluvius-noord')).toBe('fluvius-noord');
    expect(grdLabel(null)).toBe('');
    expect(grdLabel(undefined)).toBe('');
  });
});
