import { Component, DestroyRef, OnInit, Type, computed, inject, signal } from '@angular/core';
import { RegulatoryBadgeComponent } from '../../../../shared/components/regulatory-badge/regulatory-badge';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { debounceTime, filter } from 'rxjs';

import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { LocaleService } from '../../../../core/services/language/locale.service';
import { RealtimeService } from '../../../../core/services/realtime/realtime.service';
import {
  REALTIME_RECONNECTED,
  REALTIME_TOPICS,
} from '../../../../core/services/realtime/realtime.types';
import {
  ChangeOut,
  ProcedureDeadlineOut,
  ProcedureDeadlineStatus,
  ProcedureDefinitionOut,
  InboundMailOut,
  ProcedureDetailOut,
  ProcedureStepOut,
  ThreadEntryOut,
} from '../../../../shared/dtos/administrative-procedure.dtos';
import { LocaleDatePipe } from '../../../../shared/pipes/locale-format/locale-format-pipes';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeProcedureService } from '../../../../shared/services/administrative-procedure.service';
import { downloadBlob } from '../../../../shared/utils/download.utils';
import {
  TagSeverity,
  extractApiErrorMessage,
  formatApiDate,
} from '../../administrative-document-format';
import { DossierDocumentsPanel } from '../../components/dossier-documents-panel/dossier-documents-panel';
import { ChangeExcludeDialog } from '../change-exclude-dialog/change-exclude-dialog';
import {
  I18nText,
  PrimaryAction,
  ProcedureDialogData,
  StepDelay,
  ThreadLine,
  canActOnChange,
  changeKindText,
  changeStatusLabelKey,
  changeStatusSeverity,
  deadlineStatusKey,
  definitionOf,
  delayText,
  dueText,
  isDeadEnd,
  isFinished,
  partyLabelKey,
  pickLabel,
  primaryAction,
  procedureStatusSeverity,
  recipientText,
  stepDelays,
  stepLabels,
  threadLine,
  variantText,
} from '../procedure-format';
import { ProcedureResponseDialog } from '../procedure-response-dialog/procedure-response-dialog';
import { InboundChoice, InboundMailList } from '../inbound-mail-list/inbound-mail-list';
import { ProcedureSendDialog } from '../procedure-send-dialog/procedure-send-dialog';
import { ProcedureTransitionDialog } from '../procedure-transition-dialog/procedure-transition-dialog';
import { ProcedureEffectiveDateDialog } from '../procedure-effective-date-dialog/procedure-effective-date-dialog';

const REALTIME_DEBOUNCE_MS = 400;

/** Still owed: a missed deadline of the community stays on the agenda until met. */
const UNRESOLVED: ReadonlySet<ProcedureDeadlineStatus> = new Set([
  ProcedureDeadlineStatus.OPEN,
  ProcedureDeadlineStatus.MISSED,
]);

interface FriezeStep {
  step: ProcedureStepOut;
  label: string;
  delays: I18nText[];
}

interface ThreadRow {
  entry: ThreadEntryOut;
  line: ThreadLine;
}

/**
 * One procedure: what it is, where it stands on the regulator's path, what it
 * holds, what was said, and the ONE thing to do next (spec "Détail d'une
 * démarche"). Every action returns the procedure as it now is, so the page
 * swaps it in without a refetch.
 *
 * `?action=send|respond` opens that dialog once loaded: the dashboard's button
 * lands here, where the dialogs have the detail they need. `#pieces` scrolls to
 * the pieces.
 */
@Component({
  selector: 'app-procedure-detail',
  standalone: true,
  imports: [
    TranslatePipe,
    RouterLink,
    Button,
    ConfirmDialog,
    Message,
    Tag,
    Tooltip,
    LocaleDatePipe,
    DossierDocumentsPanel,
    RegulatoryBadgeComponent,
    InboundMailList,
  ],
  templateUrl: './procedure-detail.html',
  providers: [DialogService, ConfirmationService, ErrorMessageHandler],
})
export class ProcedureDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(AdministrativeProcedureService);
  private readonly dialogService = inject(DialogService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly lang = inject(LocaleService).locale;

  private dialogRef?: DynamicDialogRef | null;
  private id = 0;
  /** The dialog `?action=` asked for, opened once the detail has loaded. */
  private pendingAction: 'send' | 'respond' | null = null;

  readonly detail = signal<ProcedureDetailOut | null>(null);
  readonly definitions = signal<ProcedureDefinitionOut[]>([]);
  readonly regulator = signal<string | null>(null);
  readonly loading = signal<boolean>(true);
  readonly notFound = signal<boolean>(false);
  readonly busyChangeIds = signal<ReadonlySet<number>>(new Set());
  readonly downloadingIds = signal<ReadonlySet<number>>(new Set());

  readonly title = computed(() => {
    const d = this.detail();
    return d ? pickLabel(d.labels, this.lang(), d.code) : '';
  });
  readonly stepLabel = computed(() => {
    const d = this.detail();
    return d ? pickLabel(d.step_labels, this.lang(), d.step) : '';
  });
  readonly stepSeverity = computed<TagSeverity>(() => {
    const d = this.detail();
    return d ? procedureStatusSeverity(d.status) : 'secondary';
  });
  readonly nextAction = computed(() => {
    const d = this.detail();
    return d ? pickLabel(d.next_action.labels, this.lang()) : '';
  });
  readonly nextDue = computed<I18nText | null>(() => {
    const d = this.detail();
    return d ? dueText(d.due_in_working_days, d.next_action_due) : null;
  });
  readonly primary = computed<PrimaryAction | null>(() => {
    const d = this.detail();
    if (!d || isFinished(d.status)) return null;
    const action = primaryAction(d.next_action.code);
    return action.kind === 'open' ? null : action;
  });
  readonly recipient = computed<I18nText | null>(() => {
    const d = this.detail();
    return d ? recipientText(d.recipient, d.grd_ref, this.regulator()) : null;
  });
  readonly routeText = computed<I18nText | null>(() => {
    const variant = this.detail()?.variant;
    return variant ? variantText(variant) : null;
  });
  readonly frieze = computed<FriezeStep[]>(() => {
    const d = this.detail();
    if (!d) return [];
    const lang = this.lang();
    const definition = definitionOf(this.definitions(), d);
    const delays: ReadonlyMap<string, StepDelay[]> = definition
      ? stepDelays(definition, d.variant)
      : new Map();
    // The path to "in force" is shown whole; a dead end (refused, cancelled,
    // lapsed) only once the procedure went there.
    return d.timeline
      .filter((step) => step.current || step.visited || !isDeadEnd(step.status))
      .map((step) => ({
        step,
        label: pickLabel(step.labels, lang, step.code),
        delays: (delays.get(step.code) ?? []).map((delay) => delayText(delay, lang)),
      }));
  });
  readonly openDeadlines = computed(() =>
    (this.detail()?.deadlines ?? []).filter((d) => UNRESOLVED.has(d.status)),
  );
  readonly closedDeadlines = computed(() =>
    (this.detail()?.deadlines ?? []).filter((d) => !UNRESOLVED.has(d.status)),
  );
  /** Newest first: what just happened is what the reader came for. */
  readonly thread = computed<ThreadRow[]>(() => {
    const d = this.detail();
    if (!d) return [];
    const lang = this.lang();
    const steps = stepLabels(d);
    return [...d.thread]
      .reverse()
      .map((entry) => ({ entry, line: threadLine(entry, d, lang, steps) }));
  });
  readonly effectSubjects = computed<string[]>(() => {
    const subjects = this.detail()?.effect_error?.subjects;
    return Array.isArray(subjects) ? subjects.map(String) : [];
  });
  /** `in_force`: the effect date is blocked; `sync`: only the CRM's badges are behind. */
  readonly effectErrorKey = computed(() =>
    this.detail()?.effect_error?.kind === 'in_force'
      ? 'ADMINISTRATIVE_DOCUMENT.PROCEDURES.DETAIL.EFFECT_ERROR_IN_FORCE'
      : 'ADMINISTRATIVE_DOCUMENT.PROCEDURES.DETAIL.EFFECT_ERROR',
  );
  readonly refiling = signal(false);

  constructor() {
    this.destroyRef.onDestroy(() => this.dialogRef?.destroy());
    this.realtime
      .on(
        REALTIME_TOPICS.ADMIN_DOSSIER_UPDATED,
        REALTIME_TOPICS.ADMIN_CHANGE_DETECTED,
        REALTIME_TOPICS.ADMIN_DEADLINE_DUE,
        REALTIME_TOPICS.ADMIN_DOCUMENT_READY,
        REALTIME_RECONNECTED,
      )
      .pipe(
        // A hint about another procedure says nothing about this one. A piece's
        // or a deadline's hint does not say whose, so it refetches.
        filter((event) => event.ref?.kind !== 'dossier' || event.ref.id === String(this.id)),
        debounceTime(REALTIME_DEBOUNCE_MS),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.reload());
  }

  ngOnInit(): void {
    this.service
      .getStatus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.regulator.set(res.data.regulator),
        error: () => this.regulator.set(null),
      });
    this.service
      .listDefinitions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.definitions.set(Array.isArray(res.data) ? res.data : []),
        error: () => this.definitions.set([]),
      });

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.id = Number(params.get('id'));
      const action = this.route.snapshot.queryParamMap.get('action');
      this.pendingAction = action === 'send' || action === 'respond' ? action : null;
      this.detail.set(null);
      this.load();
    });
  }

  load(): void {
    if (!Number.isInteger(this.id) || this.id <= 0) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.service
      .getProcedure(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.notFound.set(false);
          this.show(res.data);
          this.loading.set(false);
          this.openPendingAction();
        },
        error: (error: unknown) => {
          this.loading.set(false);
          if ((error as { status?: number })?.status === 404) {
            this.notFound.set(true);
            return;
          }
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }

  reload(): void {
    this.service.invalidate();
    this.load();
  }

  /** Swap in the procedure an action returned. */
  show(detail: ProcedureDetailOut): void {
    this.detail.set(detail);
  }

  private openPendingAction(): void {
    const action = this.pendingAction;
    if (!action) return;
    this.pendingAction = null;
    // Drop it from the URL, or a reload would open the dialog again.
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { action: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    if (action === 'send') this.openSend();
    else this.openRespond();
  }

  // ---- the one primary action --------------------------------------------

  runPrimary(): void {
    switch (this.primary()?.kind) {
      case 'send':
        this.openSend();
        return;
      case 'respond':
        this.openRespond();
        return;
      case 'baseline':
        void this.router.navigate(['/administrative-document/baseline']);
        return;
      case 'pieces':
        this.scrollToPieces();
        return;
    }
  }

  scrollToPieces(): void {
    document.getElementById('pieces')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---- dialogs ------------------------------------------------------------

  openSend(): void {
    this.openDialog(ProcedureSendDialog, 'ADMINISTRATIVE_DOCUMENT.PROCEDURES.SEND.TITLE', '48rem');
  }

  openRespond(): void {
    this.openDialog(
      ProcedureResponseDialog,
      'ADMINISTRATIVE_DOCUMENT.PROCEDURES.RESPONSE.TITLE',
      '40rem',
    );
  }

  /** « Ajouter une réponse » from a mail the reception address attached here. */
  openRespondFrom(mail: InboundMailOut): void {
    this.openDialog(
      ProcedureResponseDialog,
      'ADMINISTRATIVE_DOCUMENT.PROCEDURES.RESPONSE.TITLE',
      '40rem',
      mail,
    );
  }

  /** The pieces an attachment of a received mail may supply. */
  readonly pieceChoices = computed<InboundChoice[]>(() =>
    (this.detail()?.pieces ?? []).map((piece) => ({
      id: piece.id,
      label: pickLabel(piece.labels, this.lang(), piece.code),
    })),
  );

  openEffectiveDate(): void {
    this.openDialog(
      ProcedureEffectiveDateDialog,
      'ADMINISTRATIVE_DOCUMENT.PROCEDURES.EFFECTIVE_DATE.TITLE',
      '30rem',
    );
  }

  openTransition(): void {
    this.openDialog(
      ProcedureTransitionDialog,
      'ADMINISTRATIVE_DOCUMENT.PROCEDURES.TRANSITION.TITLE',
      '34rem',
    );
  }

  private openDialog(
    component: Type<unknown>,
    headerKey: string,
    width: string,
    inbound: InboundMailOut | null = null,
  ): void {
    const detail = this.detail();
    if (!detail) return;
    const data: ProcedureDialogData = { detail, regulator: this.regulator(), inbound };
    this.dialogRef = this.dialogService.open(component, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      width,
      styleClass: 'responsive-dialog',
      header: this.translate.instant(headerKey) as string,
      data,
    });
    this.dialogRef?.onClose
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((updated: ProcedureDetailOut | null | undefined) => {
        if (updated) this.show(updated);
      });
  }

  // ---- changes -------------------------------------------------------------

  canActOn(change: ChangeOut): boolean {
    const d = this.detail();
    return d !== null && canActOnChange(d, change.status);
  }

  defer(change: ChangeOut): void {
    this.confirmation.confirm({
      header: this.translate.instant('ADMINISTRATIVE_DOCUMENT.PROCEDURES.CHANGES.DEFER') as string,
      message: this.translate.instant(
        'ADMINISTRATIVE_DOCUMENT.PROCEDURES.CHANGES.DEFER_CONFIRM',
      ) as string,
      acceptLabel: this.translate.instant('COMMON.ACTIONS.VALIDATE') as string,
      rejectLabel: this.translate.instant('COMMON.ACTIONS.CANCEL') as string,
      accept: () => this.runDefer(change),
    });
  }

  private runDefer(change: ChangeOut): void {
    this.busy(change.id, true);
    this.service
      .deferChange(this.id, change.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.busy(change.id, false);
          this.show(res.data);
          this.snackbar.openSnackBar(
            this.translate.instant('ADMINISTRATIVE_DOCUMENT.PROCEDURES.CHANGES.DEFERRED') as string,
            VALIDATION_TYPE,
          );
        },
        error: (error: unknown) => {
          this.busy(change.id, false);
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }

  exclude(change: ChangeOut): void {
    const detail = this.detail();
    if (!detail) return;
    this.dialogRef = this.dialogService.open(ChangeExcludeDialog, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      width: '32rem',
      styleClass: 'responsive-dialog',
      header: this.translate.instant(
        'ADMINISTRATIVE_DOCUMENT.PROCEDURES.CHANGES.EXCLUDE',
      ) as string,
      data: { detail, change },
    });
    this.dialogRef?.onClose
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((updated: ProcedureDetailOut | null | undefined) => {
        if (updated) this.show(updated);
      });
  }

  private busy(id: number, on: boolean): void {
    this.busyChangeIds.update((set) => {
      const next = new Set(set);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  isBusy(change: ChangeOut): boolean {
    return this.busyChangeIds().has(change.id);
  }

  // ---- after a refusal --------------------------------------------------------

  /** « Corriger et renvoyer »: the refused changes, filed again into a draft, which opens. */
  refile(): void {
    this.confirmation.confirm({
      header: this.translate.instant('ADMINISTRATIVE_DOCUMENT.PROCEDURES.REFUSAL.REFILE') as string,
      message: this.translate.instant(
        'ADMINISTRATIVE_DOCUMENT.PROCEDURES.REFUSAL.REFILE_CONFIRM',
      ) as string,
      acceptLabel: this.translate.instant('COMMON.ACTIONS.VALIDATE') as string,
      rejectLabel: this.translate.instant('COMMON.ACTIONS.CANCEL') as string,
      accept: () => this.runRefile(),
    });
  }

  private runRefile(): void {
    this.refiling.set(true);
    this.service
      .refile(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.refiling.set(false);
          this.snackbar.openSnackBar(
            this.translate.instant('ADMINISTRATIVE_DOCUMENT.PROCEDURES.REFUSAL.REFILED') as string,
            VALIDATION_TYPE,
          );
          void this.router.navigate(['/administrative-document/procedures', res.data.id_dossier]);
        },
        error: (error: unknown) => {
          this.refiling.set(false);
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }

  // ---- thread ----------------------------------------------------------------

  downloadMessage(entry: ThreadEntryOut): void {
    const id = entry.id_correspondence;
    if (id === null) return;
    this.downloadingIds.update((set) => new Set(set).add(id));
    const done = (): void =>
      this.downloadingIds.update((set) => {
        const next = new Set(set);
        next.delete(id);
        return next;
      });
    this.service
      .downloadCorrespondence(this.id, id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ blob, filename }) => {
          done();
          downloadBlob(blob, filename);
        },
        error: (error: unknown) => {
          done();
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }

  isDownloading(entry: ThreadEntryOut): boolean {
    return entry.id_correspondence !== null && this.downloadingIds().has(entry.id_correspondence);
  }

  // ---- presentation helpers ----------------------------------------------

  changeKind(change: ChangeOut): I18nText {
    return changeKindText(change.kind);
  }

  changeStatusKey(change: ChangeOut): string {
    return changeStatusLabelKey(change.status);
  }

  changeSeverity(change: ChangeOut): TagSeverity {
    return changeStatusSeverity(change.status);
  }

  deadlineLabel(deadline: ProcedureDeadlineOut): string {
    return pickLabel(deadline.labels, this.lang(), deadline.code);
  }

  deadlineDue(deadline: ProcedureDeadlineOut): I18nText | null {
    return dueText(deadline.due_in_working_days, deadline.due_date);
  }

  partyKey(deadline: ProcedureDeadlineOut): string {
    return partyLabelKey(deadline.party);
  }

  deadlineStatus(deadline: ProcedureDeadlineOut): string {
    return deadlineStatusKey(deadline.status);
  }

  protected readonly formatApiDate = formatApiDate;
}
