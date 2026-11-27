/**
 * Frontend mirror of the crm-backend export DTOs
 * (`crm-backend/src/modules/exports/api/export.dtos.ts`). Field names match the
 * wire exactly; timestamps arrive as ISO strings.
 */

export type DataExportScope = 'user' | 'community';

export type DataExportStatus =
  | 'pending'
  | 'collecting'
  | 'assembling'
  | 'ready'
  | 'failed'
  | 'expired';

/** Which list `GET /exports` returns: the caller's own, or every export of the active community (ADMIN). */
export type DataExportView = 'mine' | 'community';

/** Body of `POST /exports`. `community_id` is the Keycloak id X-Community-ID carries. */
export interface CreateDataExportDTO {
  scope: DataExportScope;
  community_id?: string;
}

/** The 202 answer to `POST /exports`. */
export interface DataExportCreatedDTO {
  export_id: string;
  status: DataExportStatus;
}

export interface DataExportRequesterDTO {
  first_name: string | null;
  last_name: string | null;
  email: string;
}

export interface DataExportCommunityDTO {
  auth_community_id: string;
  name: string;
}

/** One export as a list row. `can_download` is true only for its requester, while it is ready. */
export interface DataExportDTO {
  id: string;
  scope: DataExportScope;
  community: DataExportCommunityDTO | null;
  status: DataExportStatus;
  locale: string;
  requester: DataExportRequesterDTO;
  is_mine: boolean;
  can_download: boolean;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  size_bytes: number | null;
  error_code: string | null;
}

/** The answer to `POST /exports/{id}/download-url`: a presigned URL valid `expires_in` seconds. */
export interface DataExportDownloadUrlDTO {
  url: string;
  expires_in: number;
}

export interface DataExportListQuery {
  view: DataExportView;
  page: number;
  limit: number;
}
