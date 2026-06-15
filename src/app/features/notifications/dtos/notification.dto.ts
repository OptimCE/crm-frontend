/**
 * Frontend mirror of the crm-backend notification DTOs
 * (`crm-backend/src/modules/notifications/api/notification.dtos.ts`).
 *
 * Field names must match the backend payload exactly. `id` stays a string to
 * avoid precision loss on the bigint primary key, and timestamps arrive as ISO
 * strings over the wire (typed `string`, not `Date`).
 */

/** Source community of a notification, surfaced for display. */
export interface NotificationCommunity {
  id: number;
  name: string;
}

/** A single notification row as returned by the list endpoint. */
export interface NotificationDTO {
  /** Bigint primary key serialised as a string. */
  id: string;
  /** Source community (id + name), or null for user-only notifications. */
  community: NotificationCommunity | null;
  /**
   * `<feature>.<event>` taxonomy, e.g. `member_invitation.received`. Doubles as
   * the i18n key root: the frontend renders the title from
   * `NOTIFICATIONS.TYPES.<type>.title` (the backend no longer sends rendered text).
   */
  type: string;
  /** Type-specific payload, also used as i18n interpolation params (e.g. `{ file_name: '…' }`). */
  data: Record<string, unknown>;
  /** ISO timestamp when read, or null while unread. */
  read_at: string | null;
  /** ISO creation timestamp. */
  created_at: string;
}

/** Output shape of the unread-count endpoint. */
export interface UnreadCountDTO {
  count: number;
}

/**
 * Query parameters for the list endpoint. Intentionally omits `community_id`:
 * the badge and lists are global (all communities) by product decision.
 */
export interface NotificationListQuery {
  page?: number;
  limit?: number;
}
