/**
 * Frontend mirror of the backend audit-action registries:
 *  - crm-backend            (src/modules/audit_log/domain/audit-log.actions.ts)
 *  - allocation-key-generation (core/audit_log/actions.py)
 *  - simulation-key         (core/audit_log/actions.py)
 *
 * All three services write to the same shared `audit_log` table. The list is
 * duplicated deliberately: the registries are not exposed at runtime, and the
 * action <p-select> needs the codes at build time to render the option list.
 * Keep in sync when any of those services adds a new code.
 */
export const AUDIT_ACTIONS: readonly string[] = [
  'crm.community_subscription.created',
  'crm.community_subscription.reactivated',
  'crm.community_subscription.unsubscribed',
  'crm.community.created',
  'crm.community.updated',
  'crm.community.deleted',
  'crm.community_member.kicked',
  'crm.community_member.left',
  'crm.community_member.role_updated',
  'crm.document.created',
  'crm.document.deleted',
  'crm.manager_invitation.created',
  'crm.manager_invitation.deleted',
  'crm.manager_invitation.accepted',
  'crm.manager_invitation.refused',
  'crm.member_invitation.created',
  'crm.member_invitation.deleted',
  'crm.member_invitation.accepted',
  'crm.member_invitation.refused',
  'crm.allocation_key.created',
  'crm.allocation_key.updated',
  'crm.allocation_key.deleted',
  'crm.member.created',
  'crm.member.updated',
  'crm.member.deleted',
  'crm.member_user_link.invited',
  'crm.member_user_link.deleted',
  'crm.meter.created',
  'crm.meter.updated',
  'crm.meter.deleted',
  'crm.meter_data.created',
  'crm.meter_data.updated',
  'crm.meter_data.deleted',
  'crm.meter_data.deactivated',
  'crm.sharing_operation.created',
  'crm.sharing_operation.updated',
  'crm.sharing_operation.deleted',
  'crm.sharing_operation_key.created',
  'crm.sharing_operation_key.approved',
  'crm.sharing_operation_key.rejected',
  'crm.sharing_op_consumption.uploaded',
  // allocation-key-generation service
  'allocation_key_generation.generation.created',
  'allocation_key_generation.generation.queue_failed',
  'allocation_key_generation.generation.succeeded',
  'allocation_key_generation.generation.failed',
  'allocation_key_generation.generation.deleted',
  'allocation_key_generation.allocation_key.saved',
  'allocation_key_generation.allocation_key_generated.deleted',
  // simulation-key service
  'simulation_key.simulation.created',
  'simulation_key.simulation.queue_failed',
  'simulation_key.simulation.succeeded',
  'simulation_key.simulation.failed',
  'simulation_key.simulation.deleted',
] as const;
