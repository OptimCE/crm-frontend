import de from '../../../assets/i18n/de.json';
import en from '../../../assets/i18n/en.json';
import fr from '../../../assets/i18n/fr.json';
import nl from '../../../assets/i18n/nl.json';
import { AUDIT_ACTIONS, auditActionLabelKey } from './audit-actions';

const LOCALES: Record<string, unknown> = { fr, en, nl, de };

/** Root segment of every service that writes to the shared `audit_log` table. */
const NAMESPACES = [
  'crm',
  'allocation_key_generation',
  'simulation_key',
  'administrative_document',
  'billing',
  'live_data',
  'news',
];

describe('AUDIT_ACTIONS', () => {
  it('has a label in every locale for every code', () => {
    // A missing label renders the raw `AUDIT.ACTIONS.<code>` path in the audit
    // log and the dashboard's recent-activity tile, with no error anywhere.
    const missing: string[] = [];
    for (const code of AUDIT_ACTIONS) {
      for (const [locale, dict] of Object.entries(LOCALES)) {
        const value = resolve(dict, auditActionLabelKey(code));
        if (typeof value !== 'string' || value.trim().length === 0) {
          missing.push(`${code} (${locale}.json)`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('has no label that is not a registered code', () => {
    // The filter's options come from AUDIT_ACTIONS, so a label without a code is
    // an action nobody can filter on - usually a code dropped from the list.
    expect(leaves(resolve(en, 'AUDIT.ACTIONS')).sort()).toEqual([...AUDIT_ACTIONS].sort());
  });

  it('lists every code once', () => {
    expect(new Set(AUDIT_ACTIONS).size).toBe(AUDIT_ACTIONS.length);
  });

  it('uses the domain.entity.verb shape under a known service namespace', () => {
    // Three segments keep each label a leaf of the i18n tree: a longer code
    // under an existing prefix would turn a string into an object.
    for (const code of AUDIT_ACTIONS) {
      expect(code, code).toMatch(/^[a-z_]+\.[a-z_]+\.[a-z_]+$/);
      expect(NAMESPACES, code).toContain(code.split('.')[0]);
    }
  });
});

describe('auditActionLabelKey', () => {
  it('maps a registered code to its label', () => {
    expect(auditActionLabelKey('live_data.device.revoked')).toBe(
      'AUDIT.ACTIONS.live_data.device.revoked',
    );
  });

  it('maps an unregistered code to the fallback instead of a raw key', () => {
    expect(auditActionLabelKey('billing.invoice.archived')).toBe('AUDIT.UNKNOWN_ACTION');
    expect(auditActionLabelKey('')).toBe('AUDIT.UNKNOWN_ACTION');
  });

  it('has a fallback label in every locale that shows the code', () => {
    for (const [locale, dict] of Object.entries(LOCALES)) {
      const value = resolve(dict, 'AUDIT.UNKNOWN_ACTION');
      expect(typeof value === 'string' && value.includes('{{code}}'), locale).toBe(true);
    }
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

/** Dotted paths of every string leaf below `node`. */
function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return prefix ? [prefix] : [];
  return Object.entries(node as Record<string, unknown>).flatMap(([key, child]) =>
    leaves(child, prefix ? `${prefix}.${key}` : key),
  );
}
