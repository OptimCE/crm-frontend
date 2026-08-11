import { ApiResponse } from '../../core/dtos/api.response';
import { MyCommunityDTO } from '../../shared/dtos/community.dtos';
import { MeMembersPartialDTO } from '../../shared/dtos/me.dtos';
import {
  UserManagerInvitationDTO,
  UserMemberInvitationDTO,
} from '../../shared/dtos/invitation.dtos';

/**
 * Pure helpers for `/home`.
 *
 * Everything here decides what a member is *told*, which is exactly the part
 * that must be testable without a TestBed on this repo's pinned Node. The
 * components below stay thin on purpose.
 */

/** What kind of thing is waiting for the user. Drives icon and copy, not layout. */
export type NeedsYouKind = 'invitation' | 'incomplete_record' | 'unread_notifications';

/**
 * One row of the "needs you" band.
 *
 * `labelKey` + `params` rather than a rendered string: the band is the first
 * thing a non-technical member reads, and it has to read naturally in four
 * languages, which means the sentence is built by ngx-translate and not by
 * concatenation here.
 */
export interface NeedsYouItem {
  kind: NeedsYouKind;
  /** Stable within a render, for `@for` tracking. */
  id: string;
  icon: string;
  labelKey: string;
  params: Record<string, unknown>;
  /** Where the fix lives. Always a real route, never a dead end. */
  route: string;
  actionKey: string;
}

/**
 * Narrow the success envelope.
 *
 * The backend answers HTTP 200 with `data` as a plain *string* and a non-zero
 * `error_code` when something failed, so every consumer must shape-check before
 * treating `data` as data. Duplicated from `dashboard-format` rather than
 * imported so `/home` does not depend on the community dashboard's feature.
 */
export function envelopeData<T>(response: ApiResponse<T | string> | null | undefined): T | null {
  if (!response) return null;
  const { data, error_code } = response;
  if (error_code !== undefined && error_code !== 0) return null;
  if (typeof data === 'string') return null;
  return (data ?? null) as T | null;
}

/**
 * Merge both invitation sources into one list of rows.
 *
 * They are two endpoints with two different DTOs (`/me/invitations` and
 * `/me/invitations/managers`), but to the person reading the page they are one
 * thing: somebody asked you to join something. Keeping the distinction on
 * screen would be the API's shape leaking into the product.
 */
export function invitationItems(
  memberInvitations: UserMemberInvitationDTO[],
  managerInvitations: UserManagerInvitationDTO[],
): NeedsYouItem[] {
  const rows: NeedsYouItem[] = memberInvitations.map((invitation) => ({
    kind: 'invitation' as const,
    id: `member-invitation-${invitation.id}`,
    icon: 'pi pi-envelope',
    labelKey: 'HOME.NEEDS_YOU.INVITATION',
    params: { community: invitation.community.name },
    route: '/users/invitations',
    actionKey: 'HOME.NEEDS_YOU.INVITATION_ACTION',
  }));
  return rows.concat(
    managerInvitations.map((invitation) => ({
      kind: 'invitation' as const,
      id: `manager-invitation-${invitation.id}`,
      icon: 'pi pi-envelope',
      labelKey: 'HOME.NEEDS_YOU.MANAGER_INVITATION',
      params: { community: invitation.community.name },
      route: '/users/invitations',
      actionKey: 'HOME.NEEDS_YOU.INVITATION_ACTION',
    })),
  );
}

/**
 * One row per member record that is missing something.
 *
 * Names the first missing field rather than counting: "1 record incomplete" is
 * not something a member can act on, and the whole point of `missing_fields`
 * being a list of names is that the sentence can say *which* field. The rest are
 * carried as a count so the copy can add "and 2 more" without a second row.
 *
 * **`missing_fields === undefined` means "not evaluated", not "complete"**, so
 * those records produce no row at all. See the DTO's own note.
 */
export function incompleteRecordItems(
  members: MeMembersPartialDTO[],
  translateField: (key: string) => string,
): NeedsYouItem[] {
  return members
    .filter((member) => (member.missing_fields?.length ?? 0) > 0)
    .map((member) => {
      const missing = member.missing_fields ?? [];
      return {
        kind: 'incomplete_record' as const,
        id: `member-${member.id}`,
        icon: 'pi pi-exclamation-circle',
        labelKey: missing.length > 1 ? 'HOME.NEEDS_YOU.RECORD_MANY' : 'HOME.NEEDS_YOU.RECORD_ONE',
        params: {
          community: member.community.name,
          // Resolved here rather than passed as a key: ngx-translate does not
          // expand a key that appears inside an interpolation parameter, so the
          // sentence would read "Votre HOME.FIELDS.IBAN manque". Taking the
          // translator as an argument keeps this module free of TestBed.
          field: translateField(`HOME.FIELDS.${missing[0].toUpperCase()}`),
          others: missing.length - 1,
        },
        route: `/users/me/members/${member.id}`,
        actionKey: 'HOME.NEEDS_YOU.RECORD_ACTION',
      };
    });
}

/** A single row for unread notifications, or none when there are none. */
export function unreadNotificationItems(count: number): NeedsYouItem[] {
  if (count <= 0) return [];
  return [
    {
      kind: 'unread_notifications',
      id: 'unread-notifications',
      icon: 'pi pi-bell',
      labelKey: 'HOME.NEEDS_YOU.UNREAD',
      params: { count },
      route: '/notifications',
      actionKey: 'HOME.NEEDS_YOU.UNREAD_ACTION',
    },
  ];
}

/**
 * Map internal community ids to their Keycloak org id.
 *
 * Every `/me/*` row embeds `community: {id, name, logo_url}` — the INTERNAL
 * integer — while `switchCommunity()` and `X-Community-ID` both speak the org
 * id. `getMyCommunities` is the only payload carrying both, so it is the join
 * table, and building it here keeps that fact in one place instead of at every
 * call site.
 */
export function orgIdByCommunityId(communities: MyCommunityDTO[]): Map<number, string> {
  return new Map(communities.map((community) => [community.id, community.auth_community_id]));
}

/** Round kWh for display. The API already rounds; this guards a summed value. */
export function formatKwh(value: number): number {
  return Math.round(value * 10) / 10;
}
