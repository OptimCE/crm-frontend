import { DestroyRef, Signal, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';

import { CommunityServicesStore } from '../../../core/services/community-services.store';
import { RealtimeService } from '../../../core/services/realtime/realtime.service';
import {
  REALTIME_RECONNECTED,
  REALTIME_TOPICS,
} from '../../../core/services/realtime/realtime.types';
import { ProcedureStatus } from '../../dtos/administrative-procedure.dtos';
import { RegulatoryStatusDTO, RegulatorySubjectType } from '../../dtos/regulatory-status.dtos';
import { AdministrativeProcedureService } from '../../services/administrative-procedure.service';
import { RegulatoryStatusService } from '../../services/regulatory-status.service';

const REALTIME_DEBOUNCE_MS = 400;

/** The map key of a subject: `1:<EAN>`, `2:<key id>`. */
export function regulatoryKey(type: RegulatorySubjectType, ref: string | number): string {
  return `${type}:${ref}`;
}

/**
 * The regulatory status of an operation's meters and keys, for the badges of a
 * screen. Call it in an injection context (a field initialiser).
 *
 * Loads when the operation changes, and again on the annexe's hints
 * (`admin.dossier.updated`, `admin.change.detected`) and on a reconnection: the
 * annexe writes the rows straight into the core's database, so nothing else
 * would tell this screen they moved. Asks nothing while the administrative
 * module is not reachable, and an error simply shows no badge: a badge never
 * gets in the way of the screen it sits on.
 */
export function operationRegulatoryStatus(
  operation: () => number | null | undefined,
): Signal<ReadonlyMap<string, RegulatoryStatusDTO>> {
  const service = inject(RegulatoryStatusService);
  const services = inject(CommunityServicesStore);
  const realtime = inject(RealtimeService);
  const destroyRef = inject(DestroyRef);
  const rows = signal<ReadonlyMap<string, RegulatoryStatusDTO>>(new Map());

  const load = (): void => {
    const id = untracked(operation);
    if (!id || !untracked(() => services.canReach('administrative-document'))) {
      rows.set(new Map());
      return;
    }
    service
      .status({ id_sharing_operation: id })
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe({
        next: (response) => {
          const data = Array.isArray(response.data) ? response.data : [];
          rows.set(
            new Map(data.map((row) => [regulatoryKey(row.subject_type, row.subject_ref), row])),
          );
        },
        error: () => rows.set(new Map()),
      });
  };

  effect(() => {
    operation();
    services.canReach('administrative-document');
    untracked(load);
  });
  realtime
    .on(
      REALTIME_TOPICS.ADMIN_DOSSIER_UPDATED,
      REALTIME_TOPICS.ADMIN_CHANGE_DETECTED,
      REALTIME_RECONNECTED,
    )
    .pipe(debounceTime(REALTIME_DEBOUNCE_MS), takeUntilDestroyed(destroyRef))
    .subscribe(() => load());

  return rows.asReadonly();
}

/** The changes of an operation still to notify: its open drafts' changes. */
export interface Unnotified {
  count: number;
  /** The draft that holds them (the first, when several families do). */
  procedureId: number;
}

/**
 * « N changements pas encore notifiés » for an operation's page: the open
 * drafts the annexe filed its changes into (its inbox, `todo`). Same refresh
 * rules as `operationRegulatoryStatus`; the inbox is cached for a minute, so a
 * hint drops that cache first.
 */
export function operationUnnotified(
  operation: () => number | null | undefined,
): Signal<Unnotified | null> {
  const procedures = inject(AdministrativeProcedureService);
  const services = inject(CommunityServicesStore);
  const realtime = inject(RealtimeService);
  const destroyRef = inject(DestroyRef);
  const state = signal<Unnotified | null>(null);

  const load = (): void => {
    const id = untracked(operation);
    if (!id || !untracked(() => services.canReach('administrative-document'))) {
      state.set(null);
      return;
    }
    procedures
      .getInbox({ operation_id: id, bucket: 'todo' })
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe({
        next: (response) => {
          const drafts = (response.data?.groups?.todo ?? []).filter(
            (item) =>
              (item.status === ProcedureStatus.DRAFT || item.status === ProcedureStatus.READY) &&
              item.changes_count > 0,
          );
          const count = drafts.reduce((sum, item) => sum + item.changes_count, 0);
          state.set(count > 0 ? { count, procedureId: drafts[0].id } : null);
        },
        error: () => state.set(null),
      });
  };

  effect(() => {
    operation();
    services.canReach('administrative-document');
    untracked(load);
  });
  realtime
    .on(
      REALTIME_TOPICS.ADMIN_DOSSIER_UPDATED,
      REALTIME_TOPICS.ADMIN_CHANGE_DETECTED,
      REALTIME_RECONNECTED,
    )
    .pipe(debounceTime(REALTIME_DEBOUNCE_MS), takeUntilDestroyed(destroyRef))
    .subscribe(() => {
      procedures.invalidate();
      load();
    });

  return state.asReadonly();
}
