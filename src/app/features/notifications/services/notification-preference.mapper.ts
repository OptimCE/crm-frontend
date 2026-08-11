import {
  NotificationChannel,
  NotificationPreferenceDTO,
  NotificationPreferencesDTO,
  PreferenceMode,
} from '../dtos/notification.dto';

/** The catch-all row: applies to every type with no more specific setting. */
export const DEFAULT_PREFIX = '';

/** One editable line in the preferences table: a prefix and its two toggles. */
export interface PreferenceRow {
  /** `''` for the default row, else a prefix the backend recognises. */
  prefix: string;
  /** i18n key for the row label. */
  labelKey: string;
  inapp: boolean;
  email: boolean;
}

/**
 * Turn the server's answer into editable rows.
 *
 * The asymmetry here is the thing to get right: on the wire, an ABSENT row means
 * "no preference expressed", and the backend treats that as IMMEDIATE. So a
 * toggle is on unless there is an explicit OFF row for it — reading absence as
 * "off" would silently mute everything for every user who has never visited
 * this screen.
 *
 * The prefix list comes from the server (derived from its notification
 * taxonomy), so this app holds no hardcoded list that could drift from it.
 */
export function rowsFromPreferences(response: NotificationPreferencesDTO): PreferenceRow[] {
  const stored = new Map<string, PreferenceMode>(
    response.preferences.map((preference) => [
      keyOf(preference.type_prefix, preference.channel),
      preference.mode,
    ]),
  );
  return [DEFAULT_PREFIX, ...response.type_prefixes].map((prefix) => ({
    prefix,
    labelKey:
      prefix === DEFAULT_PREFIX
        ? 'PROFILE.NOTIFICATION_PREFERENCES.DEFAULT_LABEL'
        : `NOTIFICATIONS.PREFIXES.${prefix}`,
    inapp: isOn(stored, prefix, NotificationChannel.INAPP),
    email: isOn(stored, prefix, NotificationChannel.EMAIL),
  }));
}

/**
 * Turn the edited rows back into the payload.
 *
 * Only the OFF rows are sent. An absent row IS the "use the default" state, so
 * writing IMMEDIATE rows too would fill the table with entries that mean exactly
 * the same as their absence — and make "reset to default" inexpressible.
 *
 * The endpoint replaces the set wholesale, so this must always return the
 * COMPLETE set of opt-outs, never a delta.
 */
export function preferencesFromRows(rows: PreferenceRow[]): NotificationPreferenceDTO[] {
  const payload: NotificationPreferenceDTO[] = [];
  for (const row of rows) {
    if (!row.inapp) {
      payload.push({
        type_prefix: row.prefix,
        channel: NotificationChannel.INAPP,
        mode: PreferenceMode.OFF,
      });
    }
    if (!row.email) {
      payload.push({
        type_prefix: row.prefix,
        channel: NotificationChannel.EMAIL,
        mode: PreferenceMode.OFF,
      });
    }
  }
  return payload;
}

function keyOf(prefix: string, channel: NotificationChannel): string {
  return `${prefix}:${channel}`;
}

function isOn(
  stored: Map<string, PreferenceMode>,
  prefix: string,
  channel: NotificationChannel,
): boolean {
  return stored.get(keyOf(prefix, channel)) !== PreferenceMode.OFF;
}
