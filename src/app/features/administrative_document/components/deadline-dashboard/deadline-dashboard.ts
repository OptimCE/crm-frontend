import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { debounceTime } from 'rxjs';

import { LocaleService } from '../../../../core/services/language/locale.service';
import { RealtimeService } from '../../../../core/services/realtime/realtime.service';
import {
  REALTIME_RECONNECTED,
  REALTIME_TOPICS,
} from '../../../../core/services/realtime/realtime.types';
import {
  ProcedureDeadlineOut,
  ProcedureDeadlineQuery,
  ProcedureDeadlineStatus,
} from '../../../../shared/dtos/administrative-procedure.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { AdministrativeProcedureService } from '../../../../shared/services/administrative-procedure.service';
import {
  TagSeverity,
  extractApiErrorMessage,
  formatApiDate,
  toApiDate,
} from '../../administrative-document-format';
import {
  I18nText,
  deadlineStatusKey,
  dueText,
  partyLabelKey,
  pickLabel,
} from '../../procedures/procedure-format';

const REALTIME_DEBOUNCE_MS = 400;

/**
 * "Calendrier": the agenda of every deadline (spec "Écrans"). Without a period
 * it lists what is still owed, the community's missed deadlines included;
 * with one, everything due in it, met and cancelled too.
 *
 * Nothing is resolved by hand here: a deadline is met by the response or the
 * step that closes it, so the procedure is where to act.
 */
@Component({
  selector: 'app-deadline-dashboard',
  standalone: true,
  imports: [TranslatePipe, FormsModule, RouterLink, Button, DatePicker, TableModule, Tag],
  templateUrl: './deadline-dashboard.html',
  providers: [ErrorMessageHandler],
})
export class DeadlineDashboard implements OnInit {
  private readonly service = inject(AdministrativeProcedureService);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly lang = inject(LocaleService).locale;

  readonly deadlines = signal<ProcedureDeadlineOut[]>([]);
  readonly loading = signal<boolean>(true);

  from: Date | null = null;
  to: Date | null = null;

  readonly overdueCount = computed(() => this.deadlines().filter((d) => d.overdue).length);

  constructor() {
    this.realtime
      .on(
        REALTIME_TOPICS.ADMIN_DEADLINE_DUE,
        REALTIME_TOPICS.ADMIN_DOSSIER_UPDATED,
        REALTIME_RECONNECTED,
      )
      .pipe(debounceTime(REALTIME_DEBOUNCE_MS), takeUntilDestroyed())
      .subscribe(() => this.refresh());
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    const query: ProcedureDeadlineQuery = {};
    const from = toApiDate(this.from);
    const to = toApiDate(this.to);
    if (from) query.from = from;
    if (to) query.to = to;
    this.service
      .listDeadlines(query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.deadlines.set(Array.isArray(res.data) ? res.data : []);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }

  applyFilters(): void {
    this.load();
  }

  clearFilters(): void {
    this.from = null;
    this.to = null;
    this.load();
  }

  hasActiveFilters(): boolean {
    return this.from !== null || this.to !== null;
  }

  refresh(): void {
    this.service.invalidate();
    this.load();
  }

  // ---- presentation helpers ----------------------------------------------

  label(row: ProcedureDeadlineOut): string {
    return pickLabel(row.labels, this.lang(), row.code);
  }

  procedure(row: ProcedureDeadlineOut): string {
    return pickLabel(row.procedure_labels, this.lang(), row.procedure_code);
  }

  due(row: ProcedureDeadlineOut): I18nText | null {
    return dueText(row.due_in_working_days, row.due_date);
  }

  partyKey(row: ProcedureDeadlineOut): string {
    return partyLabelKey(row.party);
  }

  statusKey(row: ProcedureDeadlineOut): string {
    return deadlineStatusKey(row.status);
  }

  statusSeverity(row: ProcedureDeadlineOut): TagSeverity {
    if (row.overdue) return 'danger';
    switch (row.status) {
      case ProcedureDeadlineStatus.MET:
        return 'success';
      case ProcedureDeadlineStatus.MISSED:
        return 'danger';
      case ProcedureDeadlineStatus.CANCELLED:
        return 'secondary';
      default:
        return 'info';
    }
  }

  protected readonly formatApiDate = formatApiDate;
}
