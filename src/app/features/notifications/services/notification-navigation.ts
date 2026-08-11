import { NotificationDTO } from '../dtos/notification.dto';
import { featureFor } from './notification-type.registry';

/**
 * Whether clicking a notification may navigate to its destination.
 *
 * Two things can make a destination unreachable, and both end the same way — the
 * guard redirects to `/`, which sends the user to `/users`, so the notification
 * they clicked silently disappears with no explanation:
 *
 *  1. **Wrong community.** Notifications are cross-community by product decision
 *     (the bell shows every community at once), but every destination route is
 *     scoped to the ACTIVE community. Clicking an `invoice.issued` from community
 *     B while A is active opens **A's** billing hub — showing the user someone
 *     else's data under the heading of their own notification.
 *  2. **Unsubscribed annexe.** A community that stops paying for billing keeps
 *     its old invoice notifications; `activeFeatureGuard` then bounces the click.
 *
 * Kept as a pure function, outside both call sites, so it is unit-testable
 * without a TestBed — the same reason the registry itself has no DI.
 *
 * @param activeOrgId Keycloak org id of the active community, or null.
 * @param isActive Subscription check for the ACTIVE community only.
 */
export function canNavigate(
  notification: NotificationDTO,
  activeOrgId: string | null,
  isActive: (feature: string) => boolean,
): boolean {
  // A null community means the notification is user-scoped (an invitation), and
  // its destination is a core `/users/*` route — always reachable.
  if (notification.community && notification.community.auth_community_id !== activeOrgId) {
    return false;
  }

  const feature = featureFor(notification);
  return !feature || isActive(feature);
}
