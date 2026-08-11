import { ApiResponse } from '../../core/dtos/api.response';
import { CommunityDashboardDTO, CommunityLegalField } from '../../shared/dtos/dashboard.dtos';
import { InvoiceStatus } from '../../shared/dtos/billing.dtos';
import { MeterDataStatus } from '../../shared/types/meter.types';
import { MeAllocationShareDTO } from '../../shared/dtos/me.dtos';

/** The state a tile is in. Drives `app-dashboard-tile`'s whole rendering. */
export type TileState = 'loading' | 'error' | 'empty' | 'ready';

/**
 * How urgently a readiness row wants attention.
 *
 * Always paired with an icon in the template — colour alone is not an accessible
 * status encoding, and these rows are read by people who are not IT specialists.
 */
export type ReadinessSeverity = 'blocking' | 'attention' | 'ok';

export interface ReadinessItem {
  /** i18n key under `DASHBOARD.MANAGER.READINESS.ITEMS`. */
  key: string;
  count: number;
  severity: ReadinessSeverity;
  icon: string;
  /** Core route only — a readiness row must never link into a gated annexe. */
  link: string | null;
  queryParams?: Record<string, string | number>;
  /**
   * i18n key of the community field this row is about, interpolated into the
   * sentence. Only set for `COMMUNITY_FIELD_MISSING`.
   */
  fieldLabelKey?: string;
}

/**
 * The backend answers 200 with `data` as a plain string and a non-zero
 * `error_code` when something went wrong, reusing the success envelope. Treating
 * that string as data is the silent-garbage failure mode this guard exists for.
 */
export function isEnvelopeError<T>(response: ApiResponse<T | string>): boolean {
  return (response.error_code ?? 0) !== 0 || typeof response.data === 'string';
}

/** Narrows a success envelope, or null when it carries an error instead. */
export function envelopeData<T>(response: ApiResponse<T | string>): T | null {
  return isEnvelopeError(response) ? null : (response.data as T);
}

/**
 * "Unpaid" has no server-side filter: `GET /billing/invoices` takes a single
 * `status`, so the definition lives here and costs one count call per status.
 */
export const UNPAID_INVOICE_STATUSES: readonly InvoiceStatus[] = [
  InvoiceStatus.ISSUED,
  InvoiceStatus.SENT,
  InvoiceStatus.OVERDUE,
] as const;

/** Meter statuses that mean "someone still has to act on this". */
const METER_BLOCKED_STATUSES: Record<'grd' | 'manager', MeterDataStatus> = {
  grd: MeterDataStatus.WAITING_GRD,
  manager: MeterDataStatus.WAITING_MANAGER,
};

/**
 * Turns the readiness aggregate into the rows the tile renders.
 *
 * Only non-zero findings are returned: an empty array means "everything we check
 * is in order", which the tile says in words rather than leaving blank.
 *
 * Severity rule — `blocking` is reserved for things that stop the community
 * operating or filing (a sharing operation with no allocation key, a missing
 * legal identity); everything else is `attention`.
 */
export function readinessItems(data: CommunityDashboardDTO): ReadinessItem[] {
  const items: ReadinessItem[] = [];

  if (data.sharing_operations.without_valid_key > 0) {
    items.push({
      key: 'OPERATIONS_WITHOUT_KEY',
      count: data.sharing_operations.without_valid_key,
      severity: 'blocking',
      icon: 'pi pi-exclamation-triangle',
      link: '/sharing_operations',
    });
  }

  if (data.sharing_operations.with_pending_key > 0) {
    items.push({
      key: 'OPERATIONS_KEY_PENDING',
      count: data.sharing_operations.with_pending_key,
      severity: 'attention',
      icon: 'pi pi-clock',
      link: '/sharing_operations',
    });
  }

  if (data.meters.waiting_grd > 0) {
    items.push({
      key: 'METERS_WAITING_GRD',
      count: data.meters.waiting_grd,
      severity: 'attention',
      icon: 'pi pi-clock',
      link: '/meters',
      queryParams: { status: METER_BLOCKED_STATUSES.grd },
    });
  }

  if (data.meters.waiting_manager > 0) {
    items.push({
      key: 'METERS_WAITING_MANAGER',
      count: data.meters.waiting_manager,
      severity: 'blocking',
      icon: 'pi pi-exclamation-triangle',
      link: '/meters',
      queryParams: { status: METER_BLOCKED_STATUSES.manager },
    });
  }

  if (data.meters.not_in_sharing_operation > 0) {
    items.push({
      key: 'METERS_NOT_IN_OPERATION',
      count: data.meters.not_in_sharing_operation,
      severity: 'attention',
      icon: 'pi pi-link',
      link: '/meters',
    });
  }

  if (data.meters.without_active_data > 0) {
    items.push({
      key: 'METERS_WITHOUT_DATA',
      count: data.meters.without_active_data,
      severity: 'attention',
      icon: 'pi pi-question-circle',
      link: '/meters',
    });
  }

  if (data.members.incomplete > 0) {
    items.push({
      key: 'MEMBERS_INCOMPLETE',
      count: data.members.incomplete,
      severity: 'attention',
      icon: 'pi pi-user-edit',
      link: '/members',
    });
  }

  if (data.members.pending > 0) {
    items.push({
      key: 'MEMBERS_PENDING',
      count: data.members.pending,
      severity: 'attention',
      icon: 'pi pi-hourglass',
      link: '/members',
    });
  }

  for (const field of data.legal_info.missing_fields) {
    items.push({
      key: 'COMMUNITY_FIELD_MISSING',
      count: 1,
      severity: 'blocking',
      icon: 'pi pi-id-card',
      link: '/communities/info',
      fieldLabelKey: legalFieldLabelKey(field),
    });
  }

  return items;
}

/** i18n key for one community legal field, derived from the field name. */
export function legalFieldLabelKey(field: CommunityLegalField): string {
  return `DASHBOARD.MANAGER.READINESS.FIELDS.${field.toUpperCase()}`;
}

/** Aggregate severity of the whole readiness list, for the tile's badge. */
export function worstSeverity(items: ReadinessItem[]): ReadinessSeverity {
  if (items.some((i) => i.severity === 'blocking')) return 'blocking';
  if (items.length > 0) return 'attention';
  return 'ok';
}

/** PrimeNG tag severity for a readiness level. Paired with an icon, never alone. */
export function tagSeverity(severity: ReadinessSeverity): 'danger' | 'warn' | 'success' {
  switch (severity) {
    case 'blocking':
      return 'danger';
    case 'attention':
      return 'warn';
    default:
      return 'success';
  }
}

/**
 * How a member's key fraction should be presented.
 *
 * `unmatched` exists because `consumer.name` in an allocation key is free text
 * with no link to a meter: the key simply does not name this EAN. Rendering that
 * as "0 %" would tell the member they receive nothing, which is a different and
 * false statement.
 */
export type ShareDisplay = 'share' | 'prorata' | 'unmatched' | 'no_key';

export function shareDisplay(row: MeAllocationShareDTO): ShareDisplay {
  if (!row.key) return 'no_key';
  if (row.is_prorata) return 'prorata';
  if (!row.matched || row.effective_share === null) return 'unmatched';
  return 'share';
}
