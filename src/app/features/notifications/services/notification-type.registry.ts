import { NotificationDTO } from '../dtos/notification.dto';

/** The server-controlled `data` payload of a notification. Every field is unknown. */
export type NotificationData = Record<string, unknown>;

/**
 * Visual + behavioural decoration for each notification `type`. The backend
 * stores `type` as a free-form `varchar(128)` (`<feature>.<event>`), so unknown
 * types must degrade gracefully to {@link DEFAULT_PRESENTATION}.
 *
 * Keep in sync with `NOTIFICATION_TYPES`
 * (`crm-backend/src/modules/notifications/domain/notification.taxonomy.ts`) and
 * with `NOTIFICATIONS.TYPES.<feature>.<event>.title` in all four
 * `src/assets/i18n/*.json` — a missing title renders the raw key to the user
 * with no error anywhere.
 */
/** Annexes whose subscription gates a notification's destination. */
export type GatedFeature = 'news' | 'billing' | 'administrative-document';

export interface NotificationPresentation {
  /** PrimeIcons class, e.g. `pi pi-envelope`. */
  icon: string;
  /**
   * Annexe the destination lives in; absent means core and always reachable.
   *
   * A community that unsubscribes keeps its old `invoice.issued` rows, so
   * clicking one would bounce off `activeFeatureGuard` to `/` — the user's
   * notification simply vanishes with no explanation. Declared here rather than
   * derived from the route so the two cannot drift; a spec asserts every annexe
   * route declares it.
   */
  feature?: GatedFeature;
  /**
   * Resolve the click-through destination from `notification.data`, or
   * `undefined` when there is nothing to open.
   *
   * A function rather than a static string because deadlines and dossiers
   * deep-link per row; list-page destinations use {@link staticRoute}. Must
   * never throw — `data` is server JSON and every field is `unknown`.
   */
  route?: (data: NotificationData) => string | undefined;
}

export const DEFAULT_PRESENTATION: NotificationPresentation = {
  icon: 'pi pi-bell',
};

/** A destination that ignores `data` — for list pages with no per-row view. */
function staticRoute(path: string): () => string {
  return () => path;
}

/**
 * Read a numeric id out of server JSON as a path-safe string.
 *
 * Digits only, deliberately: `route()` results are handed to
 * `Router.navigateByUrl()`, which takes a raw URL, so an unvalidated `data`
 * value would let whatever wrote the notification row steer the click anywhere
 * in the app. Accepts a JSON number or its string form (JSONB ids arrive as
 * either).
 */
function idFrom(data: NotificationData, key: string): string | undefined {
  const raw = data[key];
  if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0) return String(raw);
  if (typeof raw === 'string' && /^[1-9]\d*$/.test(raw)) return raw;
  return undefined;
}

/**
 * Dossier deep link, falling back to the hub when the producer omitted
 * `dossier_id` — landing on the list beats a click that does nothing.
 */
function dossierRoute(data: NotificationData): string {
  const id = idFrom(data, 'dossier_id');
  return id ? `/administrative-document/dossiers/${id}` : '/administrative-document';
}

const REGISTRY: Record<string, NotificationPresentation> = {
  'member_invitation.received': {
    icon: 'pi pi-envelope',
    route: staticRoute('/users/invitations'),
  },
  'manager_invitation.received': {
    icon: 'pi pi-envelope',
    route: staticRoute('/users/invitations'),
  },
  'member.updated': { icon: 'pi pi-user-edit' },
  'document.uploaded': { icon: 'pi pi-file' },
  'news_post.published': { icon: 'pi pi-megaphone', route: staticRoute('/news'), feature: 'news' },
  'news_poll.published': { icon: 'pi pi-chart-bar', route: staticRoute('/news'), feature: 'news' },
  // billing — `/billing` is a single role-branched hub (BillingHub): the invoiced
  // member lands on their own invoice list, a manager on the console. There is no
  // per-invoice route and the hub reads no route params, so a query string would
  // be dead weight; when a detail view exists only these three entries change
  // (the producers already send `invoice_id`).
  'invoice.issued': { icon: 'pi pi-receipt', route: staticRoute('/billing'), feature: 'billing' },
  'invoice.overdue': {
    icon: 'pi pi-exclamation-circle',
    route: staticRoute('/billing'),
    feature: 'billing',
  },
  'billing_run.completed': {
    icon: 'pi pi-check-circle',
    route: staticRoute('/billing'),
    feature: 'billing',
  },
  // administrative-document — real per-row deep links; these are why `route`
  // takes `data` at all.
  'admin_deadline.due_soon': {
    icon: 'pi pi-clock',
    route: dossierRoute,
    feature: 'administrative-document',
  },
  'admin_deadline.missed': {
    icon: 'pi pi-calendar-times',
    route: dossierRoute,
    feature: 'administrative-document',
  },
  'admin_dossier.acknowledged': {
    icon: 'pi pi-file-check',
    route: dossierRoute,
    feature: 'administrative-document',
  },
};

/** Resolve presentation for a notification type, falling back to a generic bell. */
export function presentationFor(type: string): NotificationPresentation {
  return REGISTRY[type] ?? DEFAULT_PRESENTATION;
}

/**
 * Click-through destination for a notification, or `undefined` when it has none.
 * Both call sites use this rather than reading `.route` themselves, so the
 * resolution rules stay in exactly one place.
 */
export function routeFor(notification: NotificationDTO): string | undefined {
  return presentationFor(notification.type).route?.(notification.data ?? {});
}

/**
 * The annexe a notification's destination lives in, or `undefined` for a core
 * destination that is always reachable.
 */
export function featureFor(notification: NotificationDTO): GatedFeature | undefined {
  return presentationFor(notification.type).feature;
}

/** Every registered type key. Used by the i18n coverage spec. */
export function registeredNotificationTypes(): string[] {
  return Object.keys(REGISTRY);
}
