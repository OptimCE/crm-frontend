/**
 * Realtime event contract. Mirrors `crm-backend/src/shared/realtime/`.
 *
 * An event is a HINT — "something about resource X changed" — never data. Every
 * consumer must react by invalidating its cache and refetching through the API
 * gateway. That refetch is also the re-authorization point: a user whose role or
 * membership was revoked while their stream was open gets a 403 or an empty page,
 * because the stream itself proves nothing about current permissions.
 *
 * NEVER render `ref` or `hint` as user-facing content. Toast text is chosen from
 * `topic` + `hint.status` against the i18n bundle — anything holding the Redis
 * password can publish, so treating the payload as display copy would turn a
 * compromised service into a text-injection channel into every browser.
 */
export const REALTIME_TOPICS = {
  NOTIFICATION_CREATED: 'notification.created',
  GENERATION_FINISHED: 'generation.finished',
  SIMULATION_FINISHED: 'simulation.finished',
  BILLING_RUN_FINISHED: 'billing_run.finished',
} as const;

export type RealtimeTopic = (typeof REALTIME_TOPICS)[keyof typeof REALTIME_TOPICS];

/**
 * Synthetic, client-side only: emitted on every (re)connect.
 *
 * This is what makes a dropped event harmless. The transport is at-most-once and
 * has no replay buffer, so instead of an event store every consumer performs one
 * authoritative refetch whenever the stream comes up — which IS the resync.
 * Subscribe to it alongside your real topics.
 */
export const REALTIME_RECONNECTED = 'realtime.reconnected';

export type RealtimeSubscribable = RealtimeTopic | typeof REALTIME_RECONNECTED;

/** The closed set of values `hint.status` may take. */
export type RealtimeHintStatus = 'success' | 'failed' | 'ready';

export interface RealtimeEvent {
  v: 1;
  /** Random 16 hex chars, used only for client-side dedupe. */
  id: string;
  topic: RealtimeSubscribable;
  at: string;
  scope: { community_id: number | null };
  /** Which row changed, so a consumer can refetch precisely. */
  ref: { kind: string; id: string };
  hint: { status?: RealtimeHintStatus } & Record<string, string | number | boolean | null>;
}

/**
 * `idle` before the first attempt; `connecting` while minting or reconnecting;
 * `live` with a stream open and heartbeating; `fallback` once we have given up
 * for now and the pollers are the only freshness mechanism.
 *
 * `fallback` is not terminal — the service keeps retrying on a slow timer, so a
 * transient outage self-heals without a page reload.
 */
export type RealtimeStatus = 'idle' | 'connecting' | 'live' | 'fallback';

/** Response of `POST /notifications/realtime/ticket`. */
export interface RealtimeTicketDTO {
  ticket: string;
  expires_in: number;
}

/**
 * Numeric error codes from `crm-backend/src/modules/realtime/shared/realtime.errors.ts`.
 * `error_code` is a NUMBER throughout this codebase, never a string token.
 */
export const REALTIME_ERROR_DISABLED = 34000;
export const REALTIME_ERROR_UNAVAILABLE = 34001;
