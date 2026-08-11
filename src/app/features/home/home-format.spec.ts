import de from '../../../assets/i18n/de.json';
import en from '../../../assets/i18n/en.json';
import fr from '../../../assets/i18n/fr.json';
import nl from '../../../assets/i18n/nl.json';
import { Role } from '../../core/dtos/role';
import { MemberStatus, MemberType } from '../../shared/types/member.types';
import {
  envelopeData,
  incompleteRecordItems,
  invitationItems,
  orgIdByCommunityId,
  unreadNotificationItems,
} from './home-format';
import type { MeMembersPartialDTO } from '../../shared/dtos/me.dtos';
import type { MyCommunityDTO } from '../../shared/dtos/community.dtos';
import type {
  UserManagerInvitationDTO,
  UserMemberInvitationDTO,
} from '../../shared/dtos/invitation.dtos';

/** Identity translator: keeps these tests free of ngx-translate. */
const echo = (key: string): string => key;

function member(overrides: Partial<MeMembersPartialDTO> = {}): MeMembersPartialDTO {
  return {
    id: 1,
    name: 'Alice Dupont',
    member_type: MemberType.INDIVIDUAL,
    status: MemberStatus.ACTIVE,
    community: { id: 7, name: 'CE de Namur', logo_url: null },
    ...overrides,
  } as MeMembersPartialDTO;
}

describe('envelopeData', () => {
  it('returns the payload of a successful response', () => {
    expect(envelopeData<number[]>({ data: [1, 2], error_code: 0 })).toEqual([1, 2]);
  });

  it('rejects the 200-with-a-message-string failure envelope', () => {
    // The backend reuses the success envelope for failures: HTTP 200, `data` as
    // a translated message, non-zero error_code. Treating that as data is the
    // silent-garbage failure mode this guard exists for.
    expect(envelopeData({ data: 'Something went wrong', error_code: 42 })).toBeNull();
  });

  it('rejects a string payload even when the error code says success', () => {
    expect(envelopeData({ data: 'still a string', error_code: 0 })).toBeNull();
  });

  it('tolerates a missing response', () => {
    expect(envelopeData(null)).toBeNull();
  });
});

describe('invitationItems', () => {
  const memberInvitation = {
    id: 1,
    user_email: 'a@b.c',
    created_at: new Date(),
    to_be_encoded: false,
    community: { id: 7, name: 'CE de Namur', logo_url: null },
  } as UserMemberInvitationDTO;

  const managerInvitation = {
    id: 2,
    user_email: 'a@b.c',
    created_at: new Date(),
    community: { id: 8, name: 'CE de Liège', logo_url: null },
  } as UserManagerInvitationDTO;

  it('merges both endpoints into one list', () => {
    // Two endpoints and two DTOs, but one question to the reader: somebody
    // asked you to join something.
    const items = invitationItems([memberInvitation], [managerInvitation]);

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.kind)).toEqual(['invitation', 'invitation']);
  });

  it('keeps member and manager ids distinct', () => {
    // Both sequences start at 1, so a naive `invitation-${id}` would collide and
    // `@for … track` would drop one of the two rows.
    const items = invitationItems(
      [{ ...memberInvitation, id: 1 }],
      [{ ...managerInvitation, id: 1 }],
    );

    expect(new Set(items.map((item) => item.id)).size).toBe(2);
  });

  it('names the community and points somewhere that can act on it', () => {
    const [item] = invitationItems([memberInvitation], []);

    expect(item.params['community']).toBe('CE de Namur');
    expect(item.route).toBe('/users/invitations');
  });
});

describe('incompleteRecordItems', () => {
  it('produces no row for a complete record', () => {
    expect(incompleteRecordItems([member({ missing_fields: [] })], echo)).toEqual([]);
  });

  it('produces no row when completeness was not evaluated', () => {
    // `undefined` means "not evaluated", NOT "complete" — the meter queries that
    // embed a member as a holder do not load what the check needs. Rendering a
    // clean bill of health there would be a claim nobody made.
    expect(incompleteRecordItems([member({ missing_fields: undefined })], echo)).toEqual([]);
  });

  it('names the missing field rather than counting records', () => {
    const [item] = incompleteRecordItems([member({ missing_fields: ['iban'] })], echo);

    expect(item.labelKey).toBe('HOME.NEEDS_YOU.RECORD_ONE');
    expect(item.params['field']).toBe('HOME.FIELDS.IBAN');
  });

  it('resolves the field label through the translator it is given', () => {
    // The label cannot be passed as a key: ngx-translate does not expand a key
    // that appears inside an interpolation parameter, so the sentence would
    // read "Il manque HOME.FIELDS.IBAN".
    const [item] = incompleteRecordItems(
      [member({ missing_fields: ['iban'] })],
      (key) => `<${key}>`,
    );

    expect(item.params['field']).toBe('<HOME.FIELDS.IBAN>');
  });

  it('switches copy and carries the remainder when several fields are missing', () => {
    const [item] = incompleteRecordItems(
      [member({ missing_fields: ['iban', 'nrn', 'email'] })],
      echo,
    );

    expect(item.labelKey).toBe('HOME.NEEDS_YOU.RECORD_MANY');
    expect(item.params['others']).toBe(2);
  });

  it('links to the record the member can actually edit', () => {
    const [item] = incompleteRecordItems([member({ id: 42, missing_fields: ['iban'] })], echo);

    expect(item.route).toBe('/users/me/members/42');
  });
});

describe('unreadNotificationItems', () => {
  it('produces nothing at zero', () => {
    expect(unreadNotificationItems(0)).toEqual([]);
  });

  it('produces one row carrying the count', () => {
    const [item] = unreadNotificationItems(3);
    expect(item.params['count']).toBe(3);
    expect(item.route).toBe('/notifications');
  });
});

describe('orgIdByCommunityId', () => {
  it('maps the internal id every /me row carries to the org id the app switches on', () => {
    const communities = [
      { id: 7, auth_community_id: 'org-a', name: 'A', role: Role.MEMBER },
      { id: 8, auth_community_id: 'org-b', name: 'B', role: Role.GESTIONNAIRE },
    ] as MyCommunityDTO[];

    const map = orgIdByCommunityId(communities);

    expect(map.get(7)).toBe('org-a');
    expect(map.get(99)).toBeUndefined();
  });
});

/**
 * Locale parity.
 *
 * All four files are structurally identical today and nothing enforced it — a
 * missing key renders the raw `HOME.NEEDS_YOU.TITLE` string to the user, with
 * no error anywhere. This is the same guard `notification-type.registry.spec`
 * applies to its own keys, widened to the whole catalogue.
 */
describe('i18n parity', () => {
  const LOCALES: Record<string, unknown> = { en, fr, nl, de };

  function leaves(value: unknown, prefix = ''): Set<string> {
    const found = new Set<string>();
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (child && typeof child === 'object') {
          for (const leaf of leaves(child, path)) found.add(leaf);
        } else {
          found.add(path);
        }
      }
    }
    return found;
  }

  const reference = leaves(LOCALES['en']);

  it.each(Object.keys(LOCALES))('%s has exactly the same keys as en', (locale) => {
    const keys = leaves(LOCALES[locale]);
    expect([...reference].filter((key) => !keys.has(key))).toEqual([]);
    expect([...keys].filter((key) => !reference.has(key))).toEqual([]);
  });

  it.each(Object.keys(LOCALES))('%s has no empty HOME string', (locale) => {
    const home = (LOCALES[locale] as Record<string, unknown>)['HOME'];
    const empty = [...leaves(home, 'HOME')].filter((path) => {
      const value = path
        .split('.')
        .slice(1)
        .reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], home);
      return typeof value !== 'string' || value.trim() === '';
    });
    expect(empty).toEqual([]);
  });
});
