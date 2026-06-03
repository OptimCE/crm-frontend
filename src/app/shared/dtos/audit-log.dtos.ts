import { PaginationQuery, Sort } from './query.dtos';

export interface AuditLogQuery extends PaginationQuery {
  action?: string;
  entity_type?: string;
  entity_id?: string;
  user_id?: number;
  from?: string;
  to?: string;
  sort_timestamp?: Sort;
}

export interface AuditLogDTO {
  id: string;
  timestamp: string;
  action: string;
  source: string;
  entity_type: string;
  entity_id: string | null;
  user_id: number | null;
  user_email: string | null;
  payload: Record<string, unknown>;
}
