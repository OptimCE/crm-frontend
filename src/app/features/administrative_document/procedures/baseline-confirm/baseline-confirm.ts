import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';

import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { grdLabel } from '../../../../shared/constants/grd';
import {
  BaselineChoice,
  BaselineChoiceIn,
  BaselineItemOut,
  BaselineOut,
} from '../../../../shared/dtos/administrative-procedure.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeProcedureService } from '../../../../shared/services/administrative-procedure.service';
import {
  extractApiErrorCode,
  extractApiErrorMessage,
  formatApiDate,
  parseApiDate,
  toApiDate,
} from '../../administrative-document-format';
import { baselineChoiceLabelKey } from '../procedure-format';

const BASELINE_INVALID = 2372;
const BASELINE_CONFLICT = 2373;

const ALL_CHOICES: readonly BaselineChoice[] = ['active', 'not_notified', 'in_progress', 'ended'];

interface ChoiceOption {
  label: string;
  value: BaselineChoice;
}

/** One meter or key, and what the admin says of it. Plain fields: bound with ngModel. */
interface BaselineRow {
  item: BaselineItemOut;
  options: ChoiceOption[];
  choice: BaselineChoice;
  /** Active: since when (optional). Ended: since when. */
  effectiveDate: Date | null;
  /** In progress: the day it was sent (required). */
  sentDate: Date | null;
}

interface OperationGroup {
  id: number;
  name: string;
  rows: BaselineRow[];
}

/**
 * "Confirmer l'état de départ" (acceptance criterion 1.8). On activation the
 * annex photographs the community's operations, meters and approved keys; it
 * cannot know which of them the GRD already knows. The admin says it, item by
 * item: active (notified and in force), never notified (a change is filed in a
 * draft), in progress (sent, an answer awaited) or ended. Confirming writes the
 * effects to the core; nothing before the activation is replayed.
 *
 * On a reactivation only the difference is asked (`change`: added, removed).
 */
@Component({
  selector: 'app-baseline-confirm',
  standalone: true,
  imports: [TranslatePipe, FormsModule, RouterLink, Button, DatePicker, Message, Select, Tag],
  templateUrl: './baseline-confirm.html',
  providers: [ErrorMessageHandler],
})
export class BaselineConfirm implements OnInit {
  private readonly service = inject(AdministrativeProcedureService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  readonly baseline = signal<BaselineOut | null>(null);
  readonly rows = signal<BaselineRow[]>([]);
  readonly loading = signal<boolean>(true);
  readonly submitting = signal<boolean>(false);
  readonly formError = signal<string | null>(null);
  /** EANs the core refused: already tracked in another operation on those dates. */
  readonly conflicts = signal<ReadonlySet<string>>(new Set());
  readonly today = new Date();

  /** For "apply to every line": only the choices some line accepts. */
  bulkChoice: BaselineChoice | null = null;

  readonly pending = computed(() => this.baseline()?.status === 'pending');
  readonly groups = computed<OperationGroup[]>(() => {
    const groups = new Map<number, OperationGroup>();
    for (const row of this.rows()) {
      const id = row.item.id_sharing_operation;
      const group = groups.get(id) ?? {
        id,
        name: row.item.operation_name ?? `#${id}`,
        rows: [],
      };
      group.rows.push(row);
      groups.set(id, group);
    }
    return [...groups.values()];
  });
  readonly bulkOptions = computed<ChoiceOption[]>(() => {
    const offered = new Set(this.rows().flatMap((row) => row.item.choices));
    return ALL_CHOICES.filter((c) => offered.has(c)).map((value) => this.option(value));
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.service
      .getBaseline()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.show(res.data);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }

  private show(baseline: BaselineOut): void {
    this.baseline.set(baseline);
    this.rows.set(
      baseline.items.map((item) => {
        const choice = item.chosen ?? item.default_choice;
        return {
          item,
          options: item.choices.map((value) => this.option(value)),
          choice,
          effectiveDate: parseApiDate(item.effective_date ?? defaultEffective(item, choice)),
          sentDate: parseApiDate(item.sent_date),
        };
      }),
    );
  }

  private option(value: BaselineChoice): ChoiceOption {
    return { value, label: this.translate.instant(baselineChoiceLabelKey(value)) as string };
  }

  applyBulk(): void {
    const choice = this.bulkChoice;
    if (!choice) return;
    this.rows.update((rows) =>
      rows.map((row) => (row.item.choices.includes(choice) ? { ...row, choice } : row)),
    );
    this.bulkChoice = null;
  }

  /** Swap the row so the template's `track` sees a new object and re-renders it. */
  setChoice(row: BaselineRow, choice: BaselineChoice): void {
    this.rows.update((rows) => rows.map((r) => (r === row ? { ...r, choice } : r)));
  }

  needsSentDate(row: BaselineRow): boolean {
    return row.choice === 'in_progress';
  }

  takesEffectiveDate(row: BaselineRow): boolean {
    return row.choice === 'active' || row.choice === 'ended';
  }

  /**
   * A meter the CRM still has waiting, called active, needs the date it became
   * active: the core then writes it into the CRM's own status (one status per
   * meter), so no default is guessed for it.
   */
  needsEffectiveDate(row: BaselineRow): boolean {
    return row.choice === 'active' && isWaiting(row.item);
  }

  confirm(): void {
    this.formError.set(null);
    this.conflicts.set(new Set());
    const missing = this.rows().filter((row) => this.needsSentDate(row) && !row.sentDate);
    if (missing.length > 0) {
      this.formError.set(
        this.translate.instant('ADMINISTRATIVE_DOCUMENT.PROCEDURES.BASELINE.ERRORS.SENT_DATE', {
          refs: missing.map((row) => row.item.subject_ref).join(', '),
        }) as string,
      );
      return;
    }
    const undated = this.rows().filter((row) => this.needsEffectiveDate(row) && !row.effectiveDate);
    if (undated.length > 0) {
      this.formError.set(
        this.translate.instant(
          'ADMINISTRATIVE_DOCUMENT.PROCEDURES.BASELINE.ERRORS.EFFECTIVE_DATE',
          { refs: undated.map((row) => row.item.subject_ref).join(', ') },
        ) as string,
      );
      return;
    }
    // Every line, explicitly: what the admin saw is what is confirmed, even
    // where it is the default.
    const choices: BaselineChoiceIn[] = this.rows().map((row) => ({
      key: row.item.key,
      choice: row.choice,
      effective_date: this.takesEffectiveDate(row) ? toApiDate(row.effectiveDate) : null,
      sent_date: this.needsSentDate(row) ? toApiDate(row.sentDate) : null,
    }));
    this.submitting.set(true);
    this.service
      .confirmBaseline({ choices })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.submitting.set(false);
          this.show(res.data);
          this.snackbar.openSnackBar(
            this.translate.instant(
              'ADMINISTRATIVE_DOCUMENT.PROCEDURES.BASELINE.CONFIRMED',
            ) as string,
            VALIDATION_TYPE,
          );
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          const code = extractApiErrorCode(error);
          if (code === BASELINE_CONFLICT) {
            const refs = conflictsOf(error);
            this.conflicts.set(new Set(refs));
            this.formError.set(
              this.translate.instant(
                'ADMINISTRATIVE_DOCUMENT.PROCEDURES.BASELINE.ERRORS.CONFLICT',
                { refs: refs.join(', ') },
              ) as string,
            );
            return;
          }
          if (code === BASELINE_INVALID) {
            this.formError.set(extractApiErrorMessage(error));
            return;
          }
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }

  // ---- presentation helpers ----------------------------------------------

  isConflict(row: BaselineRow): boolean {
    return this.conflicts().has(row.item.subject_ref);
  }

  subject(row: BaselineRow): string {
    return row.item.subject_type === 'key'
      ? (row.item.label ?? `#${row.item.subject_ref}`)
      : row.item.subject_ref;
  }

  /**
   * "ORES · since 01/03/2025", either part alone when the other is unknown,
   * plus "waiting for the GRD in the CRM" for a meter the CRM has waiting.
   */
  context(row: BaselineRow): string {
    const since = row.item.start_date
      ? (this.translate.instant('ADMINISTRATIVE_DOCUMENT.PROCEDURES.BASELINE.SINCE', {
          date: formatApiDate(row.item.start_date),
        }) as string)
      : '';
    const waiting = isWaiting(row.item)
      ? (this.translate.instant(
          row.item.crm_status === CRM_WAITING_MANAGER
            ? 'ADMINISTRATIVE_DOCUMENT.PROCEDURES.BASELINE.CRM_WAITING_MANAGER'
            : 'ADMINISTRATIVE_DOCUMENT.PROCEDURES.BASELINE.CRM_WAITING_GRD',
        ) as string)
      : '';
    return [row.item.grd ? grdLabel(row.item.grd) : '', since, waiting].filter(Boolean).join(' · ');
  }

  choiceLabelKey(choice: BaselineChoice | null): string {
    return choice ? baselineChoiceLabelKey(choice) : '';
  }

  protected readonly formatApiDate = formatApiDate;
}

/** `meter_data.status` of a meter waiting for the GRD (3) or the manager (4). */
const CRM_WAITING_MANAGER = 4;

function isWaiting(item: BaselineItemOut): boolean {
  return item.subject_type === 'meter' && item.crm_status !== null && item.crm_status !== undefined
    ? item.crm_status !== 1
    : false;
}

/**
 * An active meter is active since it joined, unless the admin knows better. A
 * waiting one is not guessed: it joined the operation then, but became active
 * for the GRD later, if at all.
 */
function defaultEffective(item: BaselineItemOut, choice: BaselineChoice): string | null {
  return choice === 'active' && !isWaiting(item) ? item.start_date : null;
}

/** The 409's `conflicts`, next to `data` and `error_code` in the error body. */
function conflictsOf(error: unknown): string[] {
  const body = (error as { error?: { conflicts?: unknown } })?.error;
  return Array.isArray(body?.conflicts) ? body.conflicts.map(String) : [];
}
