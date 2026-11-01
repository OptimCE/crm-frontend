import { DestroyRef, Injectable, Signal, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { debounceTime, filter, interval, merge } from 'rxjs';

import { Role } from '../../core/dtos/role';
import { INFO_TYPE } from '../../core/dtos/notification';
import { UserContextService } from '../../core/services/authorization/authorization.service';
import { CommunityServicesStore } from '../../core/services/community-services.store';
import { LocaleService } from '../../core/services/language/locale.service';
import { RealtimeService } from '../../core/services/realtime/realtime.service';
import {
  REALTIME_RECONNECTED,
  REALTIME_TOPICS,
  RealtimeEvent,
} from '../../core/services/realtime/realtime.types';
import { AdminSummaryOut, ChangeSummaryOut } from '../../shared/dtos/administrative-procedure.dtos';
import { SnackbarNotification } from '../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeProcedureService } from '../../shared/services/administrative-procedure.service';
import { changeKindText, pickLabel, recipientText } from './procedures/procedure-format';

const FEATURE = 'administrative-document';
const REFRESH_EVERY_MS = 5 * 60_000;
const REALTIME_DEBOUNCE_MS = 400;
/** One toast per procedure in this window (spec, Notifications: « par démarche, fenêtre de 10 min »). */
export const TOAST_WINDOW_MS = 10 * 60_000;
/** ChangeStatus.ATTACHED, ProcedureStatus.DRAFT and READY: a change filed in an open draft. */
const ATTACHED = 2;
const OPEN_DRAFT = new Set([1, 6]);

/**
 * The navigation's « Administratif » badge (spec, Notifications): the
 * procedures to do and the deadlines past due, for a manager of a community
 * with the module. Null otherwise, and nothing is asked. Call it in an
 * injection context.
 *
 * Read again on the annexe's hints, on each navigation and every 5 minutes: a
 * badge never needs to be exact to the second, only never stale for long.
 */
export function administrativeAttention(): Signal<AdminSummaryOut | null> {
  const procedures = inject(AdministrativeProcedureService);
  const services = inject(CommunityServicesStore);
  const userContext = inject(UserContextService);
  const realtime = inject(RealtimeService);
  const router = inject(Router);
  const destroyRef = inject(DestroyRef);
  const state = signal<AdminSummaryOut | null>(null);

  const allowed = (): boolean =>
    services.isActive(FEATURE) && userContext.compareWithActiveRole(Role.GESTIONNAIRE);

  const load = (): void => {
    if (!untracked(allowed)) {
      state.set(null);
      return;
    }
    procedures
      .getSummary()
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe({
        next: (response) => state.set(response.data ?? null),
        // A badge never gets in the way: an error shows none.
        error: () => state.set(null),
      });
  };

  effect(() => {
    allowed();
    untracked(load);
  });
  merge(
    realtime.on(
      REALTIME_TOPICS.ADMIN_DOSSIER_UPDATED,
      REALTIME_TOPICS.ADMIN_CHANGE_DETECTED,
      REALTIME_TOPICS.ADMIN_DEADLINE_DUE,
      REALTIME_RECONNECTED,
    ),
    router.events.pipe(filter((event) => event instanceof NavigationEnd)),
    interval(REFRESH_EVERY_MS),
  )
    .pipe(debounceTime(REALTIME_DEBOUNCE_MS), takeUntilDestroyed(destroyRef))
    .subscribe(() => load());

  return state.asReadonly();
}

/** What the badge shows: the procedures to do, else what is late; capped at 99+. */
export function attentionBadge(summary: AdminSummaryOut | null): string | null {
  if (!summary) return null;
  const count = summary.todo > 0 ? summary.todo : summary.overdue;
  if (count <= 0) return null;
  return count > 99 ? '99+' : String(count);
}

/**
 * « Compteur ajouté. À notifier à ORES : ajouté au brouillon Modification du
 * partage n° 12 » (spec, Notifications), when the annexe files a change the
 * manager just made in the CRM. One toast per procedure in a 10-minute window,
 * none on the administrative hub itself (its own lists refresh), none for a
 * change that did not land in an open draft. Started once by the navigation.
 */
@Injectable({ providedIn: 'root' })
export class AdminChangeToasts {
  private readonly procedures = inject(AdministrativeProcedureService);
  private readonly services = inject(CommunityServicesStore);
  private readonly userContext = inject(UserContextService);
  private readonly realtime = inject(RealtimeService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly lang = inject(LocaleService).locale;
  private readonly snackbar = inject(SnackbarNotification);
  /** Procedure id -> when it was last toasted (ms). */
  private readonly lastShown = new Map<number, number>();
  private started = false;

  start(destroyRef: DestroyRef): void {
    if (this.started) return;
    this.started = true;
    this.realtime
      .on(REALTIME_TOPICS.ADMIN_CHANGE_DETECTED)
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event) => this.onChange(event));
    destroyRef.onDestroy(() => (this.started = false));
  }

  private onChange(event: RealtimeEvent): void {
    const id = Number(event.ref?.id);
    if (!Number.isInteger(id) || id <= 0) return;
    if (this.router.url.startsWith('/administrative-document')) return;
    if (
      !this.services.isActive(FEATURE) ||
      !this.userContext.compareWithActiveRole(Role.GESTIONNAIRE)
    ) {
      return;
    }
    this.procedures.getChange(id).subscribe({
      next: (response) => this.show(response.data),
      error: () => undefined, // a toast is a courtesy: no error for it
    });
  }

  private show(change: ChangeSummaryOut | undefined, now = Date.now()): void {
    const message = this.message(change, now);
    if (message) this.snackbar.openSnackBar(message, INFO_TYPE);
  }

  /** The toast's text, or null when there is nothing to say (exposed for the spec). */
  message(change: ChangeSummaryOut | undefined, now = Date.now()): string | null {
    if (!change || change.status !== ATTACHED || change.id_dossier === null) return null;
    if (change.procedure_status === null || !OPEN_DRAFT.has(change.procedure_status)) return null;
    const last = this.lastShown.get(change.id_dossier);
    if (last !== undefined && now - last < TOAST_WINDOW_MS) return null;
    this.lastShown.set(change.id_dossier, now);
    const kind = changeKindText(change.kind);
    const recipient = recipientText(change.recipient ?? '', change.grd_ref, null);
    return this.translate.instant('ADMINISTRATIVE_DOCUMENT.TOAST.CHANGE_FILED', {
      change: this.translate.instant(kind.key, kind.params) as string,
      subject: change.subject_ref,
      recipient: this.translate.instant(recipient.key, recipient.params) as string,
      procedure: pickLabel(change.procedure_labels, this.lang(), change.procedure_code ?? ''),
      id: change.id_dossier,
    }) as string;
  }
}
