import {
  hasOwnInProgress,
  isInProgress,
  PENDING_MAX_AGE_MS,
  requesterName,
  resumePath,
  savePendingExport,
  statusKey,
  statusSeverity,
  takePendingExport,
} from './data-export-format';
import { DataExportDTO } from './data-export.dto';

function row(overrides: Partial<DataExportDTO> = {}): DataExportDTO {
  return {
    id: '7d5f9d7e-0000-4000-8000-000000000001',
    scope: 'user',
    community: null,
    status: 'ready',
    locale: 'fr',
    requester: { first_name: 'Alice', last_name: 'Martin', email: 'alice@example.test' },
    is_mine: true,
    can_download: true,
    created_at: '2026-11-16T10:00:00.000Z',
    started_at: null,
    completed_at: null,
    expires_at: '2026-11-23T10:00:00.000Z',
    size_bytes: 1024,
    error_code: null,
    ...overrides,
  };
}

describe('data export statuses', () => {
  it('shows the three working statuses as one « En préparation »', () => {
    for (const status of ['pending', 'collecting', 'assembling'] as const) {
      expect(isInProgress(status)).toBe(true);
      expect(statusKey(status)).toBe('DATA_EXPORT.STATUS.IN_PROGRESS');
      expect(statusSeverity(status)).toBe('info');
    }
  });

  it('names the three final statuses, each with its own colour', () => {
    expect(statusKey('ready')).toBe('DATA_EXPORT.STATUS.READY');
    expect(statusKey('failed')).toBe('DATA_EXPORT.STATUS.FAILED');
    expect(statusKey('expired')).toBe('DATA_EXPORT.STATUS.EXPIRED');
    expect(statusSeverity('ready')).toBe('success');
    expect(statusSeverity('failed')).toBe('danger');
    expect(statusSeverity('expired')).toBe('secondary');
    expect(isInProgress('ready')).toBe(false);
  });
});

describe('requesterName', () => {
  it('is « first last », or the e-mail when the account has no name', () => {
    expect(requesterName(row().requester)).toBe('Alice Martin');
    expect(requesterName({ first_name: ' ', last_name: null, email: 'nobody@example.test' })).toBe(
      'nobody@example.test',
    );
  });
});

describe('hasOwnInProgress', () => {
  const community = { auth_community_id: 'org-1', name: 'Test Community' };

  it('holds the button while the caller has an export of that scope in preparation', () => {
    expect(hasOwnInProgress([row({ status: 'collecting' })], 'user', null)).toBe(true);
    expect(hasOwnInProgress([row({ status: 'ready' })], 'user', null)).toBe(false);
  });

  it("never counts another admin's export, nor one of another scope or community", () => {
    const working = row({ scope: 'community', community, status: 'pending' });
    expect(hasOwnInProgress([working], 'community', 'org-1')).toBe(true);
    expect(hasOwnInProgress([{ ...working, is_mine: false }], 'community', 'org-1')).toBe(false);
    expect(hasOwnInProgress([working], 'community', 'org-2')).toBe(false);
    expect(hasOwnInProgress([working], 'user', null)).toBe(false);
  });
});

describe('the request kept across the step-up login', () => {
  const now = Date.UTC(2026, 10, 16, 10, 0, 0);

  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('comes back once, then is gone', () => {
    savePendingExport({ scope: 'community', community_id: 'org-1', at: now });
    expect(takePendingExport(now + 1000)).toEqual({
      scope: 'community',
      community_id: 'org-1',
      at: now,
    });
    expect(takePendingExport(now + 2000)).toBeNull();
  });

  it('is dropped when the login took too long, or from the future', () => {
    savePendingExport({ scope: 'user', community_id: null, at: now });
    expect(takePendingExport(now + PENDING_MAX_AGE_MS + 1)).toBeNull();
    savePendingExport({ scope: 'user', community_id: null, at: now + 60_000 });
    expect(takePendingExport(now)).toBeNull();
  });

  it('refuses anything malformed: no scope, a community export without its community', () => {
    sessionStorage.setItem('optimce.data-export.pending', '{not json');
    expect(takePendingExport(now)).toBeNull();
    sessionStorage.setItem(
      'optimce.data-export.pending',
      JSON.stringify({ scope: 'all', community_id: null, at: now }),
    );
    expect(takePendingExport(now)).toBeNull();
    sessionStorage.setItem(
      'optimce.data-export.pending',
      JSON.stringify({ scope: 'community', community_id: null, at: now }),
    );
    expect(takePendingExport(now)).toBeNull();
  });

  it('returns to the screen it came from, with the resume marker', () => {
    expect(resumePath('user')).toBe('/users?tab=exports&resume=export');
    expect(resumePath('community')).toBe('/communities/exports?resume=export');
  });
});
