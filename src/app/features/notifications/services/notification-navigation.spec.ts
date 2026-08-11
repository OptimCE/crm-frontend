import { NotificationDTO } from '../dtos/notification.dto';
import { canNavigate } from './notification-navigation';

const ORG_A = 'org-a';
const ORG_B = 'org-b';

function notification(overrides: Partial<NotificationDTO> = {}): NotificationDTO {
  return {
    id: '1',
    community: { id: 7, name: 'Community A', auth_community_id: ORG_A },
    type: 'invoice.issued',
    data: {},
    read_at: null,
    created_at: '2026-08-05T10:00:00.000Z',
    ...overrides,
  } as NotificationDTO;
}

const ALL_SUBSCRIBED = () => true;
const NONE_SUBSCRIBED = () => false;

describe('canNavigate', () => {
  it('allows a core destination in the active community', () => {
    const invitation = notification({ type: 'member_invitation.received', community: null });
    expect(canNavigate(invitation, ORG_A, NONE_SUBSCRIBED)).toBe(true);
  });

  it('allows an annexe destination when the annexe is reachable', () => {
    expect(canNavigate(notification(), ORG_A, ALL_SUBSCRIBED)).toBe(true);
  });

  it('refuses an annexe destination the community cannot reach', () => {
    // A community that unsubscribes keeps its old invoice notifications;
    // following one would bounce off activeFeatureGuard to `/` → `/users`.
    expect(canNavigate(notification(), ORG_A, NONE_SUBSCRIBED)).toBe(false);
  });

  it('refuses a notification belonging to another community', () => {
    // The live bug this closes: an invoice.issued from community B, clicked
    // while A is active, used to open **A's** billing hub — someone else's data
    // under the heading of the user's own notification.
    expect(canNavigate(notification(), ORG_B, ALL_SUBSCRIBED)).toBe(false);
  });

  it('refuses when no community is active at all', () => {
    expect(canNavigate(notification(), null, ALL_SUBSCRIBED)).toBe(false);
  });

  it('treats a user-scoped notification as always reachable', () => {
    // `community: null` means an invitation, whose destination is /users/*.
    const invitation = notification({ type: 'manager_invitation.received', community: null });
    expect(canNavigate(invitation, null, NONE_SUBSCRIBED)).toBe(true);
  });

  it('checks the feature only for the community it belongs to', () => {
    const own = notification({ community: { id: 7, name: 'A', auth_community_id: ORG_A } });
    expect(canNavigate(own, ORG_A, (f) => f === 'billing')).toBe(true);
    expect(canNavigate(own, ORG_A, (f) => f === 'news')).toBe(false);
  });
});
