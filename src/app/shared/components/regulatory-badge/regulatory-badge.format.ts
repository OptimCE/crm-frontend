/**
 * What a regulatory badge says (spec « Cycle de vie et répercussion sur le
 * CRM », the badge table): a status of the core's `regulatory_link_status`
 * for a meter or a key, as an i18n key, its date and a p-tag severity. Pure,
 * so templates and specs share it.
 *
 * `valid_to` is a subject's last day in the operation, so an exit reads
 * « jusqu'au … » rather than « sorti le … ».
 */

import { formatApiDate } from '../../../features/administrative_document/administrative-document-format';
import { RegulatoryStatus, RegulatorySubjectType } from '../../dtos/regulatory-status.dtos';

export type BadgeSeverity = 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast';

export interface RegulatoryBadge {
  /** Translate with `{ date }`. */
  labelKey: string;
  date: string;
  severity: BadgeSeverity;
}

/** Enough of a status row to say it: the core's, or a procedure's preview. */
export interface RegulatoryState {
  regulatory_status?: RegulatoryStatus | null;
  valid_from?: string | null;
  valid_to?: string | null;
}

const PREFIX = 'REGULATORY.BADGE';

const SEVERITY: Record<RegulatoryStatus, BadgeSeverity> = {
  [RegulatoryStatus.TO_NOTIFY]: 'warn',
  [RegulatoryStatus.PENDING_GRD]: 'info',
  [RegulatoryStatus.PENDING_REGULATOR]: 'info',
  [RegulatoryStatus.AUTHORIZED]: 'info',
  [RegulatoryStatus.ACTIVE]: 'success',
  [RegulatoryStatus.LEAVING]: 'warn',
  [RegulatoryStatus.ENDED]: 'secondary',
  [RegulatoryStatus.REFUSED]: 'danger',
  [RegulatoryStatus.WITHDRAWN]: 'secondary',
};

/**
 * The badge, or null when there is nothing to show: no row (not tracked), or a
 * withdrawn meter (filed, then cancelled before anything was authorised). A
 * withdrawn key still says its old key is kept.
 */
export function regulatoryBadge(
  row: RegulatoryState | null | undefined,
  subjectType: RegulatorySubjectType,
): RegulatoryBadge | null {
  const status = row?.regulatory_status;
  if (status === null || status === undefined || !(status in SEVERITY)) return null;
  const meter = subjectType === RegulatorySubjectType.METER;
  if (status === RegulatoryStatus.WITHDRAWN && meter) return null;
  if (!meter && status === RegulatoryStatus.LEAVING) return null; // a key never leaves on its own
  const subject = meter ? 'METER' : 'KEY';
  let leaf = RegulatoryStatus[status];
  let date = '';
  if (status === RegulatoryStatus.AUTHORIZED && row?.valid_from) {
    leaf = 'AUTHORIZED_FROM';
    date = row.valid_from;
  } else if (status === RegulatoryStatus.ACTIVE) {
    date = row?.valid_from ?? '';
    if (!date) leaf = 'ACTIVE_UNDATED';
  } else if (status === RegulatoryStatus.LEAVING && row?.valid_to) {
    leaf = 'LEAVING_UNTIL';
    date = row.valid_to;
  } else if (status === RegulatoryStatus.ENDED) {
    date = row?.valid_to ?? '';
    if (!date) leaf = 'ENDED_UNDATED';
  }
  return {
    labelKey: `${PREFIX}.${subject}.${leaf}`,
    date: formatApiDate(date),
    severity: SEVERITY[status],
  };
}
