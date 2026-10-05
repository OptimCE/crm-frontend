import { HttpErrorResponse } from '@angular/common/http';

import { ApiResponse } from '../../core/dtos/api.response';

/**
 * Pull the backend's message out of a failed request.
 *
 * The house one-liner is `error instanceof ApiResponse ? error.data : null`, but
 * `ApiResponse` is only ever thrown from `.spec.ts` files — at runtime an
 * HttpClient failure is an `HttpErrorResponse`, so that branch never fires and
 * every backend message degrades to a generic toast. Features that depend on
 * those messages (the administrative-document annex's 409/413/422s, live-data's
 * 2404 EAN_NOT_FOUND / 2405 DUPLICATE_EAN) need both shapes handled.
 *
 * Lives in `shared/` rather than in a feature so that a service can use it too
 * — `shared/` must not import from `features/`.
 */
export function extractApiErrorMessage(error: unknown): string | null {
  if (error instanceof ApiResponse) {
    return typeof error.data === 'string' ? error.data : null;
  }
  if (error instanceof HttpErrorResponse) {
    const body = error.error as { data?: unknown } | null;
    if (body && typeof body.data === 'string') return body.data;
  }
  return null;
}

/** The backend's numeric `error_code`, for branching on a specific failure. */
export function extractApiErrorCode(error: unknown): number | null {
  if (error instanceof ApiResponse) {
    return typeof error.error_code === 'number' ? error.error_code : null;
  }
  if (error instanceof HttpErrorResponse) {
    const body = error.error as { error_code?: unknown } | null;
    if (body && typeof body.error_code === 'number') return body.error_code;
  }
  return null;
}
