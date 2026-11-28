import {
  DataExportDTO,
  DataExportRequesterDTO,
  DataExportScope,
  DataExportStatus,
} from './data-export.dto';

/** crm-backend error codes of the export module (`src/modules/exports/shared/export.errors.ts`). */
export const DATA_EXPORT_ERRORS = {
  /** 401: the login is older than 5 minutes; a fresh one is needed before asking. */
  REAUTH_REQUIRED: 35000,
  ALREADY_ACTIVE: 35002,
  RATE_LIMITED: 35003,
  NOT_READY: 35006,
  EXPIRED: 35007,
} as const;

/** The three statuses the screens show as one « En préparation ». */
const IN_PROGRESS: ReadonlySet<DataExportStatus> = new Set(['pending', 'collecting', 'assembling']);

export function isInProgress(status: DataExportStatus): boolean {
  return IN_PROGRESS.has(status);
}

/** i18n key of the status shown: the spec's four, the three working statuses as one. */
export function statusKey(status: DataExportStatus): string {
  if (isInProgress(status)) return 'DATA_EXPORT.STATUS.IN_PROGRESS';
  switch (status) {
    case 'ready':
      return 'DATA_EXPORT.STATUS.READY';
    case 'failed':
      return 'DATA_EXPORT.STATUS.FAILED';
    default:
      return 'DATA_EXPORT.STATUS.EXPIRED';
  }
}

export type TagSeverity = 'success' | 'info' | 'danger' | 'secondary';

export function statusSeverity(status: DataExportStatus): TagSeverity {
  if (isInProgress(status)) return 'info';
  if (status === 'ready') return 'success';
  if (status === 'failed') return 'danger';
  return 'secondary';
}

/** « Prénom Nom », or the e-mail when the account has no name. */
export function requesterName(requester: DataExportRequesterDTO): string {
  const name = [requester.first_name, requester.last_name]
    .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
    .join(' ');
  return name || requester.email;
}

/**
 * Whether the caller already has an export of this scope in preparation: the
 * server allows one at a time per requester and scope (409), so the button waits.
 */
export function hasOwnInProgress(
  rows: readonly DataExportDTO[],
  scope: DataExportScope,
  communityId: string | null,
): boolean {
  return rows.some(
    (row) =>
      row.is_mine &&
      row.scope === scope &&
      isInProgress(row.status) &&
      (scope === 'user' || row.community?.auth_community_id === communityId),
  );
}

// ---------------------------------------------------------------------------
// Step-up: the request kept across a fresh Keycloak login
// ---------------------------------------------------------------------------

/** Query parameter the login comes back with, so a stale entry never fires on a later visit. */
export const RESUME_PARAM = 'resume';
export const RESUME_VALUE = 'export';

const PENDING_KEY = 'optimce.data-export.pending';
/** A login that takes longer than this is abandoned: the request is not replayed. */
export const PENDING_MAX_AGE_MS = 10 * 60 * 1000;

export interface PendingDataExport {
  scope: DataExportScope;
  /** The community asked for, for a community export. */
  community_id: string | null;
  /** When it was kept (epoch ms). */
  at: number;
}

export function savePendingExport(pending: PendingDataExport): void {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    /* a full or blocked storage only costs the user a second click */
  }
}

/**
 * Read and FORGET the kept request: it is replayed once at most, whatever the
 * answer. Returns null when there is none, it is malformed, or it is too old.
 */
export function takePendingExport(now: number = Date.now()): PendingDataExport | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingDataExport> | null;
    if (!parsed || (parsed.scope !== 'user' && parsed.scope !== 'community')) return null;
    if (typeof parsed.at !== 'number' || now - parsed.at > PENDING_MAX_AGE_MS || parsed.at > now) {
      return null;
    }
    const communityId = typeof parsed.community_id === 'string' ? parsed.community_id : null;
    if (parsed.scope === 'community' && !communityId) return null;
    return { scope: parsed.scope, community_id: communityId, at: parsed.at };
  } catch {
    return null;
  }
}

/** The screen the login comes back to, with the resume marker. */
export function resumePath(scope: DataExportScope): string {
  return scope === 'user'
    ? `/users?tab=exports&${RESUME_PARAM}=${RESUME_VALUE}`
    : `/communities/exports?${RESUME_PARAM}=${RESUME_VALUE}`;
}
