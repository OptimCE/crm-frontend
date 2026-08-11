/**
 * The payload → form → payload round trip.
 *
 * Pure projection, so no TestBed. The properties that matter are the ones that
 * would silently corrupt a regulatory filing: a key disappearing, an empty
 * string masquerading as a value, or a row order changing.
 */

import { blankRow, columnsOf, toPayload, toPrefillForm } from './administrative-document-prefill';

const PAYLOAD = {
  community_name: 'CE du Condroz',
  community_vat_number: 'BE0123456789',
  participant_count: 3,
  members: [
    { categorie: 'Personne physique', nom: 'Alice Dupont', localite: 'Namur' },
    { categorie: 'Entreprise', nom: 'ACME SRL', localite: 'Liège' },
  ],
};

describe('toPrefillForm', () => {
  it('splits scalars from repeating sheets', () => {
    const form = toPrefillForm(PAYLOAD);

    expect(form.fields.map((f) => f.key)).toEqual([
      'community_name',
      'community_vat_number',
      'participant_count',
    ]);
    expect(form.tables.map((t) => t.key)).toEqual(['members']);
  });

  it('derives columns from the rows, in order', () => {
    const form = toPrefillForm(PAYLOAD);
    expect(form.tables[0].columns).toEqual(['categorie', 'nom', 'localite']);
  });

  it('copies rows so editing the form never mutates the fetched payload', () => {
    const form = toPrefillForm(PAYLOAD);
    form.tables[0].rows[0]['nom'] = 'Changed';
    expect(PAYLOAD.members[0].nom).toBe('Alice Dupont');
  });

  it('tolerates an empty payload', () => {
    expect(toPrefillForm({})).toEqual({ fields: [], tables: [] });
  });
});

describe('columnsOf', () => {
  it('keeps a column a later row introduces', () => {
    // A reviewer-added row could carry a key the CRM rows do not; dropping it
    // would silently discard what they typed.
    expect(columnsOf([{ a: '1' }, { a: '2', b: '3' }])).toEqual(['a', 'b']);
  });

  it('returns nothing for no rows', () => {
    expect(columnsOf([])).toEqual([]);
  });
});

describe('toPayload', () => {
  it('round-trips an untouched form', () => {
    const form = toPrefillForm(PAYLOAD);
    expect(toPayload(form, PAYLOAD)).toEqual(PAYLOAD);
  });

  it('carries a correction through', () => {
    const form = toPrefillForm(PAYLOAD);
    form.fields[0].value = 'Corrected';
    expect(toPayload(form, PAYLOAD)['community_name']).toBe('Corrected');
  });

  it('normalises an emptied field to null, not an empty string', () => {
    // The renderers treat null as "clear the cell"; "" writes a blank string,
    // which is different XML and a different checksum.
    const form = toPrefillForm(PAYLOAD);
    form.fields[0].value = '';
    expect(toPayload(form, PAYLOAD)['community_name']).toBeNull();
  });

  it('normalises an emptied cell to null too', () => {
    const form = toPrefillForm(PAYLOAD);
    form.tables[0].rows[0]['localite'] = '';
    const rows = toPayload(form, PAYLOAD)['members'] as Record<string, unknown>[];
    expect(rows[0]['localite']).toBeNull();
  });

  it('keeps a removed row removed', () => {
    const form = toPrefillForm(PAYLOAD);
    form.tables[0].rows.splice(0, 1);
    const rows = toPayload(form, PAYLOAD)['members'] as Record<string, unknown>[];
    expect(rows.length).toBe(1);
    expect(rows[0]['nom']).toBe('ACME SRL');
  });

  it('emits every column for an added row, so the sheet stays rectangular', () => {
    const form = toPrefillForm(PAYLOAD);
    form.tables[0].rows.push(blankRow(form.tables[0]));
    const rows = toPayload(form, PAYLOAD)['members'] as Record<string, unknown>[];
    expect(Object.keys(rows[2])).toEqual(['categorie', 'nom', 'localite']);
  });

  it('preserves keys the form cannot represent', () => {
    // A nested object is not editable as a control, but dropping it would strip
    // data from the filing.
    const withNested = { ...PAYLOAD, extra: { nested: true } };
    const form = toPrefillForm(withNested);
    expect(toPayload(form, withNested)['extra']).toEqual({ nested: true });
  });
});
