import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Select } from 'primeng/select';
import { TableLazyLoadEvent, TableModule, TablePageEvent } from 'primeng/table';
import { Tag } from 'primeng/tag';

import { Pagination } from '../../../../core/dtos/api.response';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import {
  DeadlineOut,
  DeadlineQuery,
  DeadlineSortField,
  DeadlineStatus,
  SharingOperationOut,
  SortOrder,
} from '../../../../shared/dtos/administrative-document.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeDocumentService } from '../../../../shared/services/administrative-document.service';
import {
  TagSeverity,
  deadlineStatusLabelKey,
  deadlineStatusSeverity,
  deadlineTypeLabelKey,
  extractApiErrorMessage,
  formatApiDate,
  isOverdue,
} from '../../administrative-document-format';

const PAGE_LIMIT = 50;
const DEFAULT_SORT: DeadlineSortField = 'due_date';
/** The backend also defaults deadlines to ascending — keep the UI in agreement. */
const DEFAULT_ORDER: SortOrder = 'asc';

const KNOWN_DEADLINE_TYPES = [
  'completeness_check',
  'lapse',
  'modification_notification',
  'annual_report',
];

interface SelectOption<T> {
  label: string;
  value: T;
}

@Component({
  selector: 'app-deadline-dashboard',
  standalone: true,
  imports: [
    TranslatePipe,
    TableModule,
    Select,
    Button,
    Tag,
    FormsModule,
    ConfirmDialog,
    RouterLink,
  ],
  templateUrl: './deadline-dashboard.html',
  providers: [ConfirmationService, ErrorMessageHandler],
})
export class DeadlineDashboard implements OnInit {
  private readonly service = inject(AdministrativeDocumentService);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly deadlines = signal<DeadlineOut[]>([]);
  readonly pagination = signal<Pagination>(new Pagination(1, PAGE_LIMIT, 0, 0));
  readonly loading = signal<boolean>(true);
  readonly operations = signal<SharingOperationOut[]>([]);
  readonly currentPageReportTemplate = signal<string>('');
  readonly busyIds = signal<ReadonlySet<number>>(new Set());

  readonly firstRow = computed(() => (this.pagination().page - 1) * this.pagination().limit);
  readonly showPaginator = computed(() => this.pagination().total_pages > 1);
  readonly operationOptions = computed<SelectOption<number>[]>(() =>
    this.operations().map((op) => ({ label: op.name, value: op.id })),
  );

  // Default to what is still owed — that is the question this board answers.
  statusFilter: DeadlineStatus | null = DeadlineStatus.OPEN;
  typeFilter: string | null = null;
  operationFilter: number | null = null;
  sortField: DeadlineSortField = DEFAULT_SORT;
  sortOrder: SortOrder = DEFAULT_ORDER;

  statusOptions: SelectOption<DeadlineStatus>[] = [];
  typeOptions: SelectOption<string>[] = [];
  sortOptions: SelectOption<DeadlineSortField>[] = [];

  constructor() {
    this.updatePaginationTranslation();
  }

  ngOnInit(): void {
    this.buildOptions();
    this.loadOperations();
    this.load(1);
  }

  private buildOptions(): void {
    this.statusOptions = [
      DeadlineStatus.OPEN,
      DeadlineStatus.MET,
      DeadlineStatus.MISSED,
      DeadlineStatus.CANCELLED,
    ].map((value) => ({
      label: this.translate.instant(deadlineStatusLabelKey(value)) as string,
      value,
    }));

    this.typeOptions = KNOWN_DEADLINE_TYPES.map((value) => ({
      label: this.translate.instant(deadlineTypeLabelKey(value)) as string,
      value,
    }));

    this.sortOptions = [
      {
        value: 'due_date',
        label: this.translate.instant('ADMINISTRATIVE_DOCUMENT.SORT.DUE_DATE') as string,
      },
      {
        value: 'created_at',
        label: this.translate.instant('ADMINISTRATIVE_DOCUMENT.SORT.CREATED_AT') as string,
      },
    ];
  }

  private loadOperations(): void {
    this.service
      .listSharingOperations()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.operations.set(Array.isArray(res.data) ? res.data : []),
        error: () => this.operations.set([]),
      });
  }

  load(page: number): void {
    this.loading.set(true);
    const query: DeadlineQuery = {
      page,
      limit: PAGE_LIMIT,
      sort: this.sortField,
      order: this.sortOrder,
    };
    if (this.statusFilter != null) query.status = this.statusFilter;
    if (this.typeFilter != null) query.deadline_type = this.typeFilter;
    if (this.operationFilter != null) query.id_sharing_operation = this.operationFilter;

    this.service
      .listDeadlines(query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.deadlines.set(Array.isArray(res.data) ? res.data : []);
          this.pagination.set(res.pagination);
          this.updatePaginationTranslation();
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.handleError(error);
        },
      });
  }

  private updatePaginationTranslation(): void {
    this.translate
      .get('ADMINISTRATIVE_DOCUMENT.DEADLINES.PAGE_REPORT_TEMPLATE_LABEL', {
        page: this.pagination().page,
        total_pages: this.pagination().total_pages,
        total: this.pagination().total,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((text: string) => this.currentPageReportTemplate.set(text));
  }

  applyFilters(): void {
    this.load(1);
  }

  clearFilters(): void {
    this.statusFilter = null;
    this.typeFilter = null;
    this.operationFilter = null;
    this.sortField = DEFAULT_SORT;
    this.sortOrder = DEFAULT_ORDER;
    this.load(1);
  }

  hasActiveFilters(): boolean {
    return (
      this.statusFilter !== DeadlineStatus.OPEN ||
      this.typeFilter != null ||
      this.operationFilter != null ||
      this.sortField !== DEFAULT_SORT ||
      this.sortOrder !== DEFAULT_ORDER
    );
  }

  lazyLoad(event: TableLazyLoadEvent): void {
    if (event.first !== undefined && event.rows) {
      this.load(event.first / event.rows + 1);
    }
  }

  pageChange(event: TablePageEvent): void {
    this.load((event.first ?? 0) / (event.rows || PAGE_LIMIT) + 1);
  }

  refresh(): void {
    this.service.invalidate();
    this.load(this.pagination().page);
  }

  // ---- actions -----------------------------------------------------------

  markMet(deadline: DeadlineOut): void {
    this.confirmResolve(deadline, DeadlineStatus.MET, 'MARK_MET');
  }

  cancel(deadline: DeadlineOut): void {
    this.confirmResolve(deadline, DeadlineStatus.CANCELLED, 'CANCEL');
  }

  private confirmResolve(
    deadline: DeadlineOut,
    status: DeadlineStatus.MET | DeadlineStatus.CANCELLED,
    keySuffix: string,
  ): void {
    this.confirmation.confirm({
      header: this.translate.instant(
        `ADMINISTRATIVE_DOCUMENT.DEADLINES.${keySuffix}_CONFIRM_HEADER`,
      ) as string,
      message: this.translate.instant(
        `ADMINISTRATIVE_DOCUMENT.DEADLINES.${keySuffix}_CONFIRM_MESSAGE`,
      ) as string,
      acceptLabel: this.translate.instant('COMMON.ACTIONS.VALIDATE') as string,
      rejectLabel: this.translate.instant('COMMON.ACTIONS.CANCEL') as string,
      accept: () => this.resolve(deadline, status),
    });
  }

  private resolve(
    deadline: DeadlineOut,
    status: DeadlineStatus.MET | DeadlineStatus.CANCELLED,
  ): void {
    this.startBusy(deadline.id);
    this.service
      .resolveDeadline(deadline.id, { status })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.stopBusy(deadline.id);
          this.snackbar.openSnackBar(
            this.translate.instant('ADMINISTRATIVE_DOCUMENT.DEADLINES.RESOLVED') as string,
            VALIDATION_TYPE,
          );
          this.refresh();
        },
        error: (error: unknown) => {
          this.stopBusy(deadline.id);
          this.handleError(error);
        },
      });
  }

  sweep(): void {
    this.confirmation.confirm({
      header: this.translate.instant(
        'ADMINISTRATIVE_DOCUMENT.DEADLINES.SWEEP_CONFIRM_HEADER',
      ) as string,
      message: this.translate.instant(
        'ADMINISTRATIVE_DOCUMENT.DEADLINES.SWEEP_CONFIRM_MESSAGE',
      ) as string,
      acceptLabel: this.translate.instant('COMMON.ACTIONS.VALIDATE') as string,
      rejectLabel: this.translate.instant('COMMON.ACTIONS.CANCEL') as string,
      accept: () => {
        this.service
          .deadlineSweep()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (res) => {
              this.snackbar.openSnackBar(
                this.translate.instant('ADMINISTRATIVE_DOCUMENT.DEADLINES.SWEEP_DONE', {
                  missed: res.data.missed,
                  rolled: res.data.rolled,
                }) as string,
                VALIDATION_TYPE,
              );
              this.refresh();
            },
            error: (error: unknown) => this.handleError(error),
          });
      },
    });
  }

  private startBusy(id: number): void {
    this.busyIds.update((set) => new Set(set).add(id));
  }

  private stopBusy(id: number): void {
    this.busyIds.update((set) => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });
  }

  // ---- presentation helpers ----------------------------------------------

  isBusy(deadline: DeadlineOut): boolean {
    return this.busyIds().has(deadline.id);
  }

  isOpen(deadline: DeadlineOut): boolean {
    return deadline.status === DeadlineStatus.OPEN;
  }

  /** An open deadline whose date has passed but which the sweep has not flipped yet. */
  isLate(deadline: DeadlineOut): boolean {
    return this.isOpen(deadline) && isOverdue(deadline.due_date);
  }

  typeLabelKey(deadline: DeadlineOut): string {
    return deadlineTypeLabelKey(deadline.deadline_type);
  }

  statusLabelKey(deadline: DeadlineOut): string {
    return deadlineStatusLabelKey(deadline.status);
  }

  statusSeverity(deadline: DeadlineOut): TagSeverity {
    return this.isLate(deadline) ? 'danger' : deadlineStatusSeverity(deadline.status);
  }

  dueDate(deadline: DeadlineOut): string {
    return formatApiDate(deadline.due_date);
  }

  private handleError(error: unknown): void {
    this.errorHandler.handleError(extractApiErrorMessage(error));
  }
}
