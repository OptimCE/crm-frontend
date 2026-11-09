import {
  DEFAULT_PREFIX,
  PreferenceRow,
  preferencesFromRows,
  rowsFromPreferences,
} from './notification-preference.mapper';
import {
  NotificationChannel,
  NotificationPreferencesDTO,
  PreferenceMode,
} from '../dtos/notification.dto';

const RESPONSE: NotificationPreferencesDTO = {
  type_prefixes: ['invoice', 'news_post'],
  preferences: [],
};

describe('rowsFromPreferences', () => {
  it('puts the catch-all default first, then the server-supplied prefixes', () => {
    // The list is served rather than hardcoded so it cannot drift from the
    // backend's notification taxonomy.
    const rows = rowsFromPreferences(RESPONSE);
    expect(rows.map((r) => r.prefix)).toEqual([DEFAULT_PREFIX, 'invoice', 'news_post']);
    expect(rows[0].labelKey).toBe('PROFILE.NOTIFICATION_PREFERENCES.DEFAULT_LABEL');
    expect(rows[1].labelKey).toBe('NOTIFICATIONS.PREFIXES.invoice');
  });

  it('treats an ABSENT row as opted in', () => {
    // The asymmetry that matters: on the wire, absence means "no preference
    // expressed" and the backend delivers. Reading it as "off" here would mute
    // everything for every user who has never opened this screen.
    const rows = rowsFromPreferences(RESPONSE);
    expect(rows.every((r) => r.inapp && r.email)).toBe(true);
  });

  it('turns an explicit OFF row off, and only that one channel', () => {
    const rows = rowsFromPreferences({
      ...RESPONSE,
      preferences: [
        { type_prefix: 'invoice', channel: NotificationChannel.EMAIL, mode: PreferenceMode.OFF },
      ],
    });
    const invoice = rows.find((r) => r.prefix === 'invoice');
    expect(invoice?.email).toBe(false);
    expect(invoice?.inapp).toBe(true);
    // ... and no other row is affected.
    expect(rows.filter((r) => r.prefix !== 'invoice').every((r) => r.email)).toBe(true);
  });

  it('leaves a row on when the stored mode is IMMEDIATE', () => {
    const rows = rowsFromPreferences({
      ...RESPONSE,
      preferences: [
        {
          type_prefix: 'invoice',
          channel: NotificationChannel.EMAIL,
          mode: PreferenceMode.IMMEDIATE,
        },
      ],
    });
    expect(rows.find((r) => r.prefix === 'invoice')?.email).toBe(true);
  });
});

describe('preferencesFromRows', () => {
  const rows = (overrides: Partial<PreferenceRow>[] = []): PreferenceRow[] =>
    [
      { prefix: DEFAULT_PREFIX, labelKey: 'x', inapp: true, email: true },
      { prefix: 'invoice', labelKey: 'y', inapp: true, email: true },
    ].map((row, index) => ({ ...row, ...(overrides[index] ?? {}) }));

  it('sends nothing when everything is on', () => {
    // An absent row IS the default, so writing IMMEDIATE rows would fill the
    // table with entries meaning exactly the same as their absence.
    expect(preferencesFromRows(rows())).toEqual([]);
  });

  it('sends one OFF row per muted channel', () => {
    const payload = preferencesFromRows(rows([{}, { inapp: false, email: false }]));
    expect(payload).toEqual([
      { type_prefix: 'invoice', channel: NotificationChannel.INAPP, mode: PreferenceMode.OFF },
      { type_prefix: 'invoice', channel: NotificationChannel.EMAIL, mode: PreferenceMode.OFF },
    ]);
  });

  it('never emits DAILY_DIGEST, which the backend rejects', () => {
    const payload = preferencesFromRows(rows([{ inapp: false }, { email: false }]));
    expect(payload.every((p) => p.mode === PreferenceMode.OFF)).toBe(true);
  });

  it('round-trips: what comes back from a save reproduces the same rows', () => {
    // The endpoint replaces the set wholesale, so a payload that is not the
    // COMPLETE set of opt-outs would silently re-enable whatever it omitted.
    const edited = rows([{ email: false }, { inapp: false }]);
    const payload = preferencesFromRows(edited);
    const reloaded = rowsFromPreferences({ ...RESPONSE, preferences: payload });
    expect(reloaded.find((r) => r.prefix === DEFAULT_PREFIX)?.email).toBe(false);
    expect(reloaded.find((r) => r.prefix === DEFAULT_PREFIX)?.inapp).toBe(true);
    expect(reloaded.find((r) => r.prefix === 'invoice')?.inapp).toBe(false);
    expect(reloaded.find((r) => r.prefix === 'invoice')?.email).toBe(true);
  });
});

describe('a summary prefix (the administrative summary)', () => {
  const DIGEST: NotificationPreferencesDTO = {
    type_prefixes: ['admin_deadline', 'admin_digest'],
    digest_prefixes: ['admin_digest'],
    preferences: [],
  };

  it('is a summary row, its email on with no row and off with OFF', () => {
    const at = (mode?: PreferenceMode): PreferenceRow | undefined =>
      rowsFromPreferences({
        ...DIGEST,
        preferences:
          mode === undefined
            ? []
            : [{ type_prefix: 'admin_digest', channel: NotificationChannel.EMAIL, mode }],
      }).find((r) => r.prefix === 'admin_digest');

    expect(at()?.digest).toBe(true);
    expect(at()?.email).toBe(true);
    expect(at(PreferenceMode.OFF)?.email).toBe(false);
    const deadline = rowsFromPreferences(DIGEST).find((r) => r.prefix === 'admin_deadline');
    expect(deadline?.digest).toBeUndefined();
  });

  it('sends its email OFF row when turned off, never an in-app row', () => {
    const rows = rowsFromPreferences(DIGEST);
    const digest = rows.find((r) => r.prefix === 'admin_digest');
    if (!digest) throw new Error('no summary row');

    expect(preferencesFromRows(rows)).toEqual([]);
    digest.inapp = false; // ignored: a summary is email only
    expect(preferencesFromRows(rows)).toEqual([]);
    digest.email = false;
    expect(preferencesFromRows(rows)).toEqual([
      { type_prefix: 'admin_digest', channel: NotificationChannel.EMAIL, mode: PreferenceMode.OFF },
    ]);
  });
});
