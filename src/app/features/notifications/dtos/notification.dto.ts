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
  /** Internal CRM id. NOT the value `X-Community-ID` carries. */
  id: number;
  name: string;
  /**
   * Keycloak org id — the one `UserContextService.activeCommunityId()` holds.
   * Needed to tell whether a notification belongs to the active community before
   * following its link.
   */
  auth_community_id: string;
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

/** Delivery channels, matching the backend encoding. Never renumber. */
export enum NotificationChannel {
  INAPP = 1,
  EMAIL = 2,
}

/**
 * What the recipient wants for a (type prefix, channel) pair.
 *
 * `2 DAILY_DIGEST` is reserved in the encoding but has no runner, so the backend
 * rejects it and it is deliberately not declared here either.
 */
export enum PreferenceMode {
  IMMEDIATE = 1,
  OFF = 3,
}

/** One stored preference. `type_prefix` is `''` for the catch-all default. */
export interface NotificationPreferenceDTO {
  type_prefix: string;
  channel: NotificationChannel;
  mode: PreferenceMode;
}

/**
 * Output of `GET /notifications/preferences`.
 *
 * `type_prefixes` is served by the backend, derived from its notification
 * taxonomy, so this app never hardcodes a list that could drift from it. It
 * excludes `''`, which the UI presents separately as the catch-all default.
 */
export interface NotificationPreferencesDTO {
  type_prefixes: string[];
  preferences: NotificationPreferenceDTO[];
}
