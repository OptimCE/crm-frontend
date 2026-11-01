import {
  NotificationChannel,
  NotificationPreferenceDTO,
  NotificationPreferencesDTO,
  PreferenceMode,
} from '../dtos/notification.dto';

/** The catch-all row: applies to every type with no more specific setting. */
export const DEFAULT_PREFIX = '';

/** How often a summary is emailed: daily (no row), weekly, or none (OFF). */
export type DigestFrequency = 'daily' | 'weekly' | 'off';

/** One editable line in the preferences table: a prefix and its two toggles. */
export interface PreferenceRow {
  /** `''` for the default row, else a prefix the backend recognises. */
  prefix: string;
  /** i18n key for the row label. */
  labelKey: string;
  inapp: boolean;
  email: boolean;
  /**
   * Set on a summary prefix only (`digest_prefixes`): email only, so the row
   * shows this choice instead of its two toggles.
   */
  frequency?: DigestFrequency;
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
  const digests = new Set(response.digest_prefixes ?? []);
  return [DEFAULT_PREFIX, ...response.type_prefixes].map((prefix) => {
    const row: PreferenceRow = {
      prefix,
      labelKey:
        prefix === DEFAULT_PREFIX
          ? 'PROFILE.NOTIFICATION_PREFERENCES.DEFAULT_LABEL'
          : `NOTIFICATIONS.PREFIXES.${prefix}`,
      inapp: isOn(stored, prefix, NotificationChannel.INAPP),
      email: isOn(stored, prefix, NotificationChannel.EMAIL),
    };
    if (digests.has(prefix)) {
      row.frequency = frequencyOf(stored.get(keyOf(prefix, NotificationChannel.EMAIL)));
    }
    return row;
  });
}

function frequencyOf(mode: PreferenceMode | undefined): DigestFrequency {
  if (mode === PreferenceMode.OFF) return 'off';
  if (mode === PreferenceMode.WEEKLY) return 'weekly';
  return 'daily';
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
    if (row.frequency !== undefined) {
      // A summary: email only; daily is the default, so no row.
      if (row.frequency !== 'daily') {
        payload.push({
          type_prefix: row.prefix,
          channel: NotificationChannel.EMAIL,
          mode: row.frequency === 'weekly' ? PreferenceMode.WEEKLY : PreferenceMode.OFF,
        });
      }
      continue;
    }
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
