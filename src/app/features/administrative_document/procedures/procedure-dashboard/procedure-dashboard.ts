import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { debounceTime } from 'rxjs';

import { LocaleService } from '../../../../core/services/language/locale.service';
import { RealtimeService } from '../../../../core/services/realtime/realtime.service';
import {
  REALTIME_RECONNECTED,
  REALTIME_TOPICS,
} from '../../../../core/services/realtime/realtime.types';
import { grdLabel } from '../../../../shared/constants/grd';
import { SharingOperationOut } from '../../../../shared/dtos/administrative-document.dtos';
import {
  BUCKETS,
  Bucket,
  InboxOut,
  InboxQuery,
  ProcedureDeadlineOut,
  ProcedureItemOut,
  ProcedureModuleStatusOut,
} from '../../../../shared/dtos/administrative-procedure.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { AdministrativeDocumentService } from '../../../../shared/services/administrative-document.service';
import { AdministrativeProcedureService } from '../../../../shared/services/administrative-procedure.service';
import { extractApiErrorMessage } from '../../administrative-document-format';
import { DossierCreateDialog } from '../../components/dossier-create-dialog/dossier-create-dialog';
import { InboundChoice } from '../inbound-mail-list/inbound-mail-list';
import { DigestSettings } from '../digest-settings/digest-settings';
import { InboundPanel } from '../inbound-panel/inbound-panel';
import {
  I18nText,
  PrimaryAction,
  bucketLabelKey,
  dueText,
  partyLabelKey,
  pickLabel,
  primaryAction,
  recipientText,
  rowTitle,
} from '../procedure-format';

/** Realtime hints arrive in bursts (a job files many); refetch once per burst. */
const REALTIME_DEBOUNCE_MS = 400;

interface SelectOption<T> {
  label: string;
  value: T;
}

interface Group {
  bucket: Bucket;
  labelKey: string;
  rows: ProcedureItemOut[];
}

/**
 * The espace administratif's home: "what must I do, and by when?" without a
 * click (acceptance criterion 1.5). Everything shown is computed by the annex,
 * the "in N working days" included, so every client agrees.
 *
 * Above it, what keeps the dashboard from being complete: a regulator with no
 * plugin (criterion 1.9), or a starting state still to confirm (1.8).
 */
@Component({
  selector: 'app-procedure-dashboard',
  standalone: true,
  imports: [TranslatePipe, FormsModule, Button, Message, Select, Tag, InboundPanel, DigestSettings],
  templateUrl: './procedure-dashboard.html',
  providers: [DialogService, ErrorMessageHandler],
})
export class ProcedureDashboard implements OnInit {
  private readonly service = inject(AdministrativeProcedureService);
  private readonly documents = inject(AdministrativeDocumentService);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly translate = inject(TranslateService);
  private readonly dialogService = inject(DialogService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly lang = inject(LocaleService).locale;

  private dialogRef?: DynamicDialogRef | null;

  readonly status = signal<ProcedureModuleStatusOut | null>(null);
  readonly inbox = signal<InboxOut | null>(null);
  readonly loading = signal<boolean>(true);
  readonly operations = signal<SharingOperationOut[]>([]);
  /** The GRDs seen without a GRD filter, so filtering by one keeps the others offered. */
  readonly grds = signal<readonly string[]>([]);

  operationFilter: number | null = null;
  grdFilter: string | null = null;

  readonly operationOptions = computed<SelectOption<number>[]>(() =>
    this.operations().map((op) => ({ label: op.name, value: op.id })),
  );
  readonly grdOptions = computed<SelectOption<string>[]>(() =>
    this.grds().map((id) => ({ label: grdLabel(id), value: id })),
  );

  readonly unsupported = computed(() => {
    const status = this.status();
    return status !== null && status.active && !status.supported;
  });
  readonly baselinePending = computed(() => this.status()?.baseline === 'pending');

  readonly banner = computed<ProcedureDeadlineOut[]>(() => this.inbox()?.banner ?? []);
  readonly groups = computed<Group[]>(() => {
    const inbox = this.inbox();
    if (!inbox) return [];
    return BUCKETS.map((bucket) => ({
      bucket,
      labelKey: bucketLabelKey(bucket),
      rows: inbox.groups[bucket] ?? [],
    })).filter((group) => group.rows.length > 0);
  });
  readonly empty = computed(() => this.inbox() !== null && this.groups().length === 0);
  /** The open procedures a received mail may be attached to (the reception address). */
  readonly inboundChoices = computed<InboundChoice[]>(() => {
    const inbox = this.inbox();
    if (!inbox) return [];
    const rows = [...inbox.groups.todo, ...inbox.groups.waiting, ...inbox.groups.planned];
    return rows.map((row) => ({
      id: row.id,
      label: [`#${row.id}`, pickLabel(row.labels, this.lang(), row.code), row.operation_name]
        .filter(Boolean)
        .join(' · '),
    }));
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.dialogRef?.destroy());
    // A hint says "something changed", never what: refetch, which is also the
    // re-authorisation. `realtime.reconnected` is the resync after a gap.
    this.realtime
      .on(
        REALTIME_TOPICS.ADMIN_CHANGE_DETECTED,
        REALTIME_TOPICS.ADMIN_DOSSIER_UPDATED,
        REALTIME_TOPICS.ADMIN_DEADLINE_DUE,
        REALTIME_RECONNECTED,
      )
      .pipe(debounceTime(REALTIME_DEBOUNCE_MS), takeUntilDestroyed())
      .subscribe(() => this.refresh());
  }

  ngOnInit(): void {
    this.documents
      .listSharingOperations()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.operations.set(Array.isArray(res.data) ? res.data : []),
        error: () => this.operations.set([]),
      });

    // `/administrative-document?id_sharing_operation=2` from a sharing operation
    // lands here, the default tab. This subscription owns the first load so
    // the filter applies to it.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const operation = Number(params.get('id_sharing_operation'));
      this.operationFilter = Number.isInteger(operation) && operation > 0 ? operation : null;
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.service
      .getStatus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.status.set(res.data),
        error: (error: unknown) => this.handleError(error),
      });

    const query: InboxQuery = {};
    if (this.operationFilter != null) query.operation_id = this.operationFilter;
    if (this.grdFilter != null) query.grd = this.grdFilter;
    this.service
      .getInbox(query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.inbox.set(res.data);
          if (this.grdFilter == null) this.grds.set(grdsOf(res.data));
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.handleError(error);
        },
      });
  }

  refresh(): void {
    this.service.invalidate();
    this.load();
  }

  applyFilters(): void {
    this.load();
  }

  // ---- navigation --------------------------------------------------------

  /** The row's one button. Dialogs open on the detail, which has what they need. */
  act(row: ProcedureItemOut): void {
    const action = this.actionOf(row);
    switch (action.kind) {
      case 'baseline':
        void this.router.navigate(['/administrative-document/baseline']);
        return;
      case 'send':
      case 'respond':
        void this.router.navigate(['/administrative-document/procedures', row.id], {
          queryParams: { action: action.kind },
        });
        return;
      case 'pieces':
        void this.router.navigate(['/administrative-document/procedures', row.id], {
          fragment: 'pieces',
        });
        return;
      default:
        this.open(row.id);
    }
  }

  open(id: number): void {
    void this.router.navigate(['/administrative-document/procedures', id]);
  }

  openBaseline(): void {
    void this.router.navigate(['/administrative-document/baseline']);
  }

  openCreate(): void {
    this.dialogRef = this.dialogService.open(DossierCreateDialog, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      width: '34rem',
      styleClass: 'responsive-dialog',
      header: this.translate.instant(
        'ADMINISTRATIVE_DOCUMENT.DIALOGS.CREATE_DOSSIER.TITLE',
      ) as string,
      data: { operations: this.operations() },
    });
    this.dialogRef?.onClose
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((created: number | null | undefined) => {
        if (created) this.open(created);
      });
  }

  // ---- presentation helpers ----------------------------------------------

  actionOf(row: ProcedureItemOut): PrimaryAction {
    return primaryAction(row.next_action.code);
  }

  title(row: ProcedureItemOut): string {
    return rowTitle(row, this.lang());
  }

  /** The procedure's own name, under a title that names its next action. */
  procedureName(row: ProcedureItemOut): string {
    return pickLabel(row.labels, this.lang(), row.code);
  }

  recipient(row: ProcedureItemOut): I18nText {
    return recipientText(row.recipient, row.grd_ref, this.status()?.regulator ?? null);
  }

  rowDue(row: ProcedureItemOut): I18nText | null {
    return dueText(row.due_in_working_days, row.next_action_due);
  }

  deadlineDue(deadline: ProcedureDeadlineOut): I18nText | null {
    return dueText(deadline.due_in_working_days, deadline.due_date);
  }

  deadlineTitle(deadline: ProcedureDeadlineOut): string {
    return (
      pickLabel(deadline.labels, this.lang()) ||
      pickLabel(deadline.procedure_labels, this.lang(), deadline.procedure_code)
    );
  }

  deadlineProcedure(deadline: ProcedureDeadlineOut): string {
    return pickLabel(deadline.procedure_labels, this.lang(), deadline.procedure_code);
  }

  partyKey(deadline: ProcedureDeadlineOut): string {
    return partyLabelKey(deadline.party);
  }

  private handleError(error: unknown): void {
    this.errorHandler.handleError(extractApiErrorMessage(error));
  }
}

function grdsOf(inbox: InboxOut): string[] {
  const seen = new Set<string>();
  for (const bucket of BUCKETS) {
    for (const row of inbox.groups[bucket] ?? []) if (row.grd_ref) seen.add(row.grd_ref);
  }
  return [...seen].sort((a, b) => grdLabel(a).localeCompare(grdLabel(b)));
}
