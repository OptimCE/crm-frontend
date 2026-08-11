import de from '../../../../assets/i18n/de.json';
import en from '../../../../assets/i18n/en.json';
import fr from '../../../../assets/i18n/fr.json';
import nl from '../../../../assets/i18n/nl.json';
import { NotificationDTO } from '../dtos/notification.dto';
import {
  DEFAULT_PRESENTATION,
  presentationFor,
  registeredNotificationTypes,
  routeFor,
} from './notification-type.registry';

/** A notification row carrying only what the registry looks at. */
function notification(type: string, data: Record<string, unknown> = {}): NotificationDTO {
  return {
    id: '1',
    community: null,
    type,
    data,
    read_at: null,
    created_at: '2026-08-03T00:00:00Z',
  };
}

describe('presentationFor', () => {
  it('maps known invitation types to an envelope icon and a route', () => {
    const member = presentationFor('member_invitation.received');
    expect(member.icon).toBe('pi pi-envelope');
    expect(member.route?.({})).toBe('/users/invitations');

    expect(presentationFor('manager_invitation.received').route?.({})).toBe('/users/invitations');
  });

  it('maps member/document types to their own icons without a route', () => {
    expect(presentationFor('member.updated').icon).toBe('pi pi-user-edit');
    expect(presentationFor('member.updated').route).toBeUndefined();
    expect(presentationFor('document.uploaded').icon).toBe('pi pi-file');
  });

  it('falls back to the default presentation for unknown types', () => {
    expect(presentationFor('something.unknown')).toBe(DEFAULT_PRESENTATION);
    expect(presentationFor('').icon).toBe('pi pi-bell');
  });

  it('gives every registered type its own icon, never the fallback', () => {
    for (const type of registeredNotificationTypes()) {
      expect(presentationFor(type)).not.toBe(DEFAULT_PRESENTATION);
    }
  });
});

describe('routeFor', () => {
  it('deep-links a dossier notification from its data', () => {
    expect(routeFor(notification('admin_dossier.acknowledged', { dossier_id: 42 }))).toBe(
      '/administrative-document/dossiers/42',
    );
    // JSONB ids can arrive as strings.
    expect(routeFor(notification('admin_deadline.missed', { dossier_id: '42' }))).toBe(
      '/administrative-document/dossiers/42',
    );
  });

  it('falls back to the hub when the producer omitted dossier_id', () => {
    expect(routeFor(notification('admin_deadline.missed'))).toBe('/administrative-document');
  });

  it('refuses a dossier_id that is not a plain positive integer', () => {
    // `route()` output goes straight to Router.navigateByUrl, which takes a raw
    // URL — so whatever wrote the notification row must not be able to steer the
    // click. This is the whole reason idFrom validates.
    for (const bad of ['../../../evil', '1/../../login', '', '0', -1, 1.5, null, { id: 1 }]) {
      expect(routeFor(notification('admin_deadline.missed', { dossier_id: bad }))).toBe(
        '/administrative-document',
      );
    }
  });

  it('sends billing notifications to the role-branched hub', () => {
    for (const type of ['invoice.issued', 'invoice.overdue', 'billing_run.completed']) {
      expect(routeFor(notification(type, { invoice_id: 8 }))).toBe('/billing');
    }
  });

  it('returns undefined for a type with no destination', () => {
    expect(routeFor(notification('member.updated', { member_id: 1 }))).toBeUndefined();
    expect(routeFor(notification('something.unknown'))).toBeUndefined();
  });
});

describe('i18n coverage', () => {
  const LOCALES: Record<string, unknown> = { en, fr, nl, de };

  /** Walk `NOTIFICATIONS.TYPES.<feature>.<event>.title` without using `any`. */
  function titleAt(dict: unknown, type: string): unknown {
    let node: unknown = dict;
    for (const segment of ['NOTIFICATIONS', 'TYPES', ...type.split('.'), 'title']) {
      if (typeof node !== 'object' || node === null) return undefined;
      node = (node as Record<string, unknown>)[segment];
    }
    return node;
  }

  it('has a non-empty title in every locale for every registered type', () => {
    // Nothing else enforces this: a missing key renders the raw
    // `NOTIFICATIONS.TYPES.x.y.title` string to the user with no error anywhere.
    for (const type of registeredNotificationTypes()) {
      for (const [code, dict] of Object.entries(LOCALES)) {
        const title = titleAt(dict, type);
        expect(
          typeof title === 'string' && title.trim().length > 0,
          `${type} has no title in ${code}.json`,
        ).toBe(true);
      }
    }
  });
});

describe('feature gating', () => {
  /** Route prefix → the annexe subscription that guards it. */
  const GATED_PREFIXES: [string, string][] = [
    ['/news', 'news'],
    ['/billing', 'billing'],
    ['/administrative-document', 'administrative-document'],
  ];

  it('declares the annexe for every destination inside one', () => {
    // This is the invariant that actually rots: someone adds a type pointing at
    // `/billing` and forgets `feature`, and the click silently bounces to
    // `/users` for any community that has not subscribed.
    for (const type of registeredNotificationTypes()) {
      const presentation = presentationFor(type);
      const route = presentation.route?.({});
      if (!route) continue;

      const gate = GATED_PREFIXES.find(([prefix]) => route.startsWith(prefix));
      if (gate) {
        expect(presentation.feature, `${type} points at ${route} but declares no feature`).toBe(
          gate[1],
        );
      } else {
        expect(
          presentation.feature,
          `${type} points at core ${route} but declares a feature`,
        ).toBeUndefined();
      }
    }
  });
});
