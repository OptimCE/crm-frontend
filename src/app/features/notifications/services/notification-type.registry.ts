/**
 * Visual + behavioural decoration for each notification `type`. The backend
 * stores `type` as a free-form `varchar(128)` (`<feature>.<event>`), so unknown
 * types must degrade gracefully to {@link DEFAULT_PRESENTATION}.
 *
 * `title`/`body` are server-rendered display strings — the frontend only adds
 * an icon and an optional click-through route here.
 */
export interface NotificationPresentation {
  /** PrimeIcons class, e.g. `pi pi-envelope`. */
  icon: string;
  /**
   * Optional in-app route to open when the notification is clicked. Kept static
   * (no per-row id) because the destinations are list pages, not detail views.
   */
  route?: string;
}

export const DEFAULT_PRESENTATION: NotificationPresentation = {
  icon: 'pi pi-bell',
};

const REGISTRY: Record<string, NotificationPresentation> = {
  'member_invitation.received': { icon: 'pi pi-envelope', route: '/users/invitations' },
  'manager_invitation.received': { icon: 'pi pi-envelope', route: '/users/invitations' },
  'member.updated': { icon: 'pi pi-user-edit' },
  'document.uploaded': { icon: 'pi pi-file' },
  'news_post.published': { icon: 'pi pi-megaphone', route: '/news' },
  'news_poll.published': { icon: 'pi pi-chart-bar', route: '/news' },
};

/** Resolve presentation for a notification type, falling back to a generic bell. */
export function presentationFor(type: string): NotificationPresentation {
  return REGISTRY[type] ?? DEFAULT_PRESENTATION;
}
