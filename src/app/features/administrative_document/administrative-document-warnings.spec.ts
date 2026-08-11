import de from '../../../assets/i18n/de.json';
import en from '../../../assets/i18n/en.json';
import fr from '../../../assets/i18n/fr.json';
import nl from '../../../assets/i18n/nl.json';
import { PrefillWarning } from '../../shared/dtos/administrative-document.dtos';
import {
  warningFieldLabelKey,
  warningLabelKey,
  warningLink,
  warningParams,
} from './administrative-document-warnings';

const LOCALES: Record<string, unknown> = { fr, en, nl, de };

/** Every code the backend can emit (`ports/crm_core.py`). */
const CODES = [
  'meter.no_member_attribution',
  'community.field_missing',
  'member.field_missing',
] as const;

function warning(overrides: Partial<PrefillWarning> = {}): PrefillWarning {
  return {
    code: 'meter.no_member_attribution',
    subject_type: 'meter',
    subject_id: '541448000000000005',
    params: {},
    ...overrides,
  };
}

describe('warningLabelKey', () => {
  it('derives the key from the code so the two cannot drift', () => {
    expect(warningLabelKey(warning())).toBe(
      'ADMINISTRATIVE_DOCUMENT.PREFILL.WARNINGS.CODES.meter.no_member_attribution',
    );
  });

  it('has a translation in every locale for every code', () => {
    // A missing key renders the raw dotted string to the reviewer with no error
    // anywhere — the same failure mode the notification registry guards against.
    for (const code of CODES) {
      for (const [locale, dict] of Object.entries(LOCALES)) {
        const value = resolve(dict, warningLabelKey(warning({ code })));
        expect(
          typeof value === 'string' && value.trim().length > 0,
          `${code} has no translation in ${locale}.json`,
        ).toBe(true);
      }
    }
  });
});

describe('warningFieldLabelKey', () => {
  it('resolves through the same key the form itself uses', () => {
    // Reusing prefillLabelKey is what makes the warning name the exact cell that
    // will come out blank, with no second vocabulary to keep in step.
    const value = warning({
      code: 'community.field_missing',
      subject_type: 'community',
      subject_id: null,
      params: { field: 'community_legal_name' },
    });
    expect(warningFieldLabelKey(value)).toBe(
      'ADMINISTRATIVE_DOCUMENT.PREFILL.FIELDS.COMMUNITY_LEGAL_NAME',
    );
  });

  it('is null when the warning names no field', () => {
    expect(warningFieldLabelKey(warning())).toBeNull();
  });
});

describe('warningParams', () => {
  it('exposes the subject for interpolation alongside the server params', () => {
    const value = warning({ params: { field: 'rue' } });
    expect(warningParams(value)).toEqual({ field: 'rue', subject: '541448000000000005' });
  });

  it('omits the subject when there is none', () => {
    const value = warning({ subject_type: 'community', subject_id: null, params: { field: 'x' } });
    expect(warningParams(value)).toEqual({ field: 'x' });
  });
});

describe('warningLink', () => {
  it('points a meter warning at the meter', () => {
    expect(warningLink(warning())).toBe('/meters/541448000000000005');
  });

  it('points a member warning at the member', () => {
    expect(warningLink(warning({ subject_type: 'member', subject_id: '42' }))).toBe('/members/42');
  });

  it('points a community warning at the community info page', () => {
    expect(warningLink(warning({ subject_type: 'community', subject_id: null }))).toBe(
      '/communities/info',
    );
  });

  it('refuses a subject id that is not a well-formed identifier', () => {
    // `subject_id` is server data heading straight into routerLink, so it is
    // validated rather than trusted — the same rule as the notification registry.
    expect(warningLink(warning({ subject_id: '12345' }))).toBeNull();
    expect(warningLink(warning({ subject_id: '../../../evil' }))).toBeNull();
    expect(warningLink(warning({ subject_id: null }))).toBeNull();
    expect(warningLink(warning({ subject_type: 'member', subject_id: '0' }))).toBeNull();
    expect(warningLink(warning({ subject_type: 'member', subject_id: 'abc' }))).toBeNull();
  });
});

/** Walk a dotted i18n path without using `any`. */
function resolve(dict: unknown, key: string): unknown {
  let node: unknown = dict;
  for (const segment of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return node;
}
