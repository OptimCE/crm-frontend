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
      '/administrative-document/procedures/42',
    );
    // JSONB ids can arrive as strings.
    expect(routeFor(notification('admin_deadline.missed', { dossier_id: '42' }))).toBe(
      '/administrative-document/procedures/42',
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
    for (const type of [
      'invoice.issued',
      'invoice.overdue',
      'credit_note.issued',
      'producer_statement.issued',
      'billing_run.completed',
    ]) {
      expect(routeFor(notification(type, { invoice_id: 8 }))).toBe('/billing');
    }
  });

  it("sends a member's meter notice to their own meter, an EAN of 18 digits only", () => {
    expect(routeFor(notification('admin_meter.active', { ean: '541448000000000001' }))).toBe(
      '/users/me/meters/541448000000000001',
    );
    for (const bad of ['../../evil', '54144800000000000', 541448, null]) {
      expect(routeFor(notification('admin_meter.active', { ean: bad }))).toBe('/users');
    }
  });

  it('deep-links an effect applied and an answer recorded to their procedure', () => {
    for (const type of ['admin_effect.applied', 'admin_correspondence.recorded']) {
      expect(routeFor(notification(type, { dossier_id: 7 }))).toBe(
        '/administrative-document/procedures/7',
      );
    }
  });

  const SIGNATURE_TYPES = [
    'signature.requested',
    'signature.reminder',
    'signature.signed',
    'signature.declined',
    'signature.completed',
  ];

  it('registers the five signature types with the pen icon, cross-community', () => {
    // /signatures is not the active community's (only /signatures/community
    // is, and no notification points there): no feature gate.
    for (const type of SIGNATURE_TYPES) {
      const presentation = presentationFor(type);
      expect(presentation.icon).toBe('pi pi-pen-to-square');
      expect(presentation.crossCommunity).toBe(true);
      expect(presentation.feature).toBeUndefined();
    }
  });

  it('follows the signature annexe’s own link: the signing screen, a request, the inbox', () => {
    const request = '1b4e28ba-2fa1-11d2-883f-0016d3cca427';
    const signer = '6fa459ea-ee8a-3ca4-894e-db77e160355e';
    expect(
      routeFor(
        notification('signature.requested', { path: `/signatures/${request}/signers/${signer}` }),
      ),
    ).toBe(`/signatures/${request}/signers/${signer}`);
    expect(
      routeFor(notification('signature.signed', { path: `/signatures/requests/${request}` })),
    ).toBe(`/signatures/requests/${request}`);
    expect(routeFor(notification('signature.completed', { path: '/signatures' }))).toBe(
      '/signatures',
    );
  });

  it('refuses any other path and falls back to the inbox', () => {
    // `route()` output goes to navigateByUrl: nothing but the three shapes.
    for (const bad of [
      '/users',
      '/signatures/../users',
      '/signatures/requests/abc?x=1',
      '//evil.example/signatures',
      'https://evil.example',
      '/signatures/a/signers/b/extra',
      null,
      42,
    ]) {
      expect(routeFor(notification('signature.reminder', { path: bad }))).toBe('/signatures');
    }
    expect(routeFor(notification('signature.declined'))).toBe('/signatures');
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
