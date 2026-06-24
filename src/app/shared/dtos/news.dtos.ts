/**
 * DTOs for the News Board annex (optimce-news-board).
 *
 * Field names are kept snake_case to mirror the backend payloads verbatim
 * (same convention as simulation.dtos.ts). Enum values match the backend
 * IntEnums in shared/const.py.
 */

export enum PostType {
  POST = 0,
  POLL_SINGLE_CHOICE = 1,
  POLL_MULTIPLE_CHOICE = 2,
}

export enum AdminVisibility {
  AGGREGATE = 0,
  FULL = 1,
}

export enum MemberVisibility {
  NONE = 0,
  AGGREGATE = 1,
  FULL = 2,
}

export enum MemberDisplay {
  NEVER = 0,
  BEFORE_VOTE = 1,
  AFTER_VOTE = 2,
  WHEN_POLL_ENDS = 3,
}

/** List-row view of a board entry (poll options/results not included). */
export interface PostListItem {
  id: number;
  type: PostType;
  author_id: string;
  author_email: string | null;
  /** Rendered + sanitised HTML of the Markdown body. */
  body_html: string;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  is_poll: boolean;
  poll_ended: boolean;
  option_count: number;
  has_voted: boolean;
}

export interface PollOption {
  id: number;
  option_value: string;
  display_order: number;
}

/** Full view of a board entry: poll options + the requester's own selection. */
export interface PostDetail {
  id: number;
  type: PostType;
  author_id: string;
  author_email: string | null;
  /** Markdown source (authoring). */
  post: string;
  /** Rendered + sanitised HTML of the Markdown body. */
  body_html: string;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  is_poll: boolean;
  poll_ended: boolean;
  options: PollOption[];
  has_voted: boolean;
  my_option_ids: number[];
  admin_visibility: AdminVisibility | null;
  member_visibility: MemberVisibility | null;
  member_display: MemberDisplay | null;
}

export interface PollOptionInput {
  option_value: string;
  display_order?: number;
}

export interface CreatePostRequest {
  type: PostType;
  post: string;
  options?: PollOptionInput[];
  expires_at?: string | null;
  admin_visibility?: AdminVisibility | null;
  member_visibility?: MemberVisibility | null;
  member_display?: MemberDisplay | null;
}

export interface UpdatePostRequest {
  post?: string;
  options?: PollOptionInput[];
  expires_at?: string | null;
  admin_visibility?: AdminVisibility | null;
  member_visibility?: MemberVisibility | null;
  member_display?: MemberDisplay | null;
}

export interface CastVoteRequest {
  option_ids: number[];
}

export type ResultsMode = 'aggregate' | 'full';

export interface VoterIdentity {
  voter_id: string;
  email: string | null;
}

export interface OptionTally {
  option_id: number;
  option_value: string;
  count: number;
  /** Per-voter identities; populated only under 'full' visibility. */
  voters: VoterIdentity[] | null;
}

/**
 * Visibility-enforced poll results. When the requester is not (yet) entitled to
 * any results, `visible` is false and `options`/`mode`/`total_voters` are null.
 */
export interface PollResults {
  post_id: number;
  poll_ended: boolean;
  visible: boolean;
  mode: ResultsMode | null;
  total_voters: number | null;
  options: OptionTally[] | null;
}

export interface NewsQuery {
  page: number;
  page_size: number;
}
