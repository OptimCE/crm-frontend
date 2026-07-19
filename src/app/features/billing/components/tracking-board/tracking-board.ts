import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { DatePicker } from 'primeng/datepicker';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Tooltip } from 'primeng/tooltip';

import { ApiResponse, Pagination } from '../../../../core/dtos/api.response';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import {
  InvoiceOut,
  InvoiceQuery,
  InvoiceSortField,
  InvoiceStatus,
  SortOrder,
} from '../../../../shared/dtos/billing.dtos';
import { BillingService } from '../../../../shared/services/billing.service';
import { MemberService } from '../../../../shared/services/member.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { invoiceStatusLabelKey, toApiDate } from '../../billing-format';
import { InvoiceList } from '../invoice-list/invoice-list';

const PAGE_LIMIT = 20;
const MEMBERS_PAGE_LIMIT = 500;

interface StatusOption {
  label: string;
  value: InvoiceStatus;
}

interface SortOption {
  label: string;
  value: InvoiceSortField;
}

interface MemberOption {
  label: string;
  value: number;
}

const DEFAULT_SORT: InvoiceSortField = 'issued_at';
const DEFAULT_ORDER: SortOrder = 'desc';

@Component({
  selector: 'app-tracking-board',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    Button,
    ConfirmDialog,
    DatePicker,
    Select,
    Skeleton,
    Tooltip,
    InvoiceList,
  ],
  providers: [ConfirmationService, ErrorMessageHandler],
  templateUrl: './tracking-board.html',
})
export class TrackingBoard implements OnInit {
  private readonly service = inject(BillingService);
  private readonly memberService = inject(MemberService);
  private readonly translate = inject(TranslateService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  readonly invoices = signal<InvoiceOut[]>([]);
  readonly loading = signal<boolean>(true);
  readonly pagination = signal<Pagination>(new Pagination(1, PAGE_LIMIT, 0, 0));
  readonly memberNames = signal<ReadonlyMap<number, string>>(new Map());

  statusFilter: InvoiceStatus | null = null;
  participant: number | null = null;
  issuedFrom: Date | null = null;
  issuedTo: Date | null = null;
  sortField: InvoiceSortField = DEFAULT_SORT;
  sortOrder: SortOrder = DEFAULT_ORDER;

  statusOptions: StatusOption[] = [];
  sortOptions: SortOption[] = [];

  readonly hasMultiplePages = computed(() => this.pagination().total_pages > 1);

  readonly memberOptions = computed<MemberOption[]>(() =>
    [...this.memberNames().entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  );

  ngOnInit(): void {
    const statuses = [
      InvoiceStatus.DRAFT,
      InvoiceStatus.ISSUED,
      InvoiceStatus.SENT,
      InvoiceStatus.PAID,
      InvoiceStatus.OVERDUE,
      InvoiceStatus.CANCELLED,
      InvoiceStatus.RENDER_FAILED,
    ];
    this.statusOptions = statuses.map((value) => ({
      label: this.translate.instant(invoiceStatusLabelKey(value)) as string,
      value,
    }));

    this.sortOptions = [
      { value: 'issued_at', label: this.translate.instant('BILLING.SORT.ISSUED_DATE') as string },
      { value: 'due_date', label: this.translate.instant('BILLING.SORT.DUE_DATE') as string },
      { value: 'total', label: this.translate.instant('BILLING.SORT.AMOUNT') as string },
      { value: 'number', label: this.translate.instant('BILLING.SORT.NUMBER') as string },
      { value: 'status', label: this.translate.instant('BILLING.SORT.STATUS') as string },
    ];

    this.loadMembers();
    this.load(1);
  }

  private loadMembers(): void {
    this.memberService
      .getMembersList({ page: 1, limit: MEMBERS_PAGE_LIMIT })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const map = new Map<number, string>();
          if (Array.isArray(res.data)) {
            for (const member of res.data) map.set(member.id, member.name);
          }
          this.memberNames.set(map);
        },
        error: () => {
          /* names fall back to #id */
        },
      });
  }

  load(page: number): void {
    this.loading.set(true);
    const query: InvoiceQuery = {
      page,
      limit: PAGE_LIMIT,
      sort: this.sortField,
      order: this.sortOrder,
    };
    if (this.statusFilter != null) query.status = this.statusFilter;
    if (this.participant != null) query.participant = this.participant;
    const from = toApiDate(this.issuedFrom);
    const to = toApiDate(this.issuedTo);
    if (from) query.issued_from = from;
    if (to) query.issued_to = to;
    this.service
      .listInvoices(query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.invoices.set(Array.isArray(res.data) ? res.data : []);
          this.pagination.set(res.pagination);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.handleError(error);
        },
      });
  }

  /** Any filter/sort change reloads from the first page. */
  applyFilters(): void {
    this.load(1);
  }

  toggleSortOrder(): void {
    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    this.load(1);
  }

  clearFilters(): void {
    this.statusFilter = null;
    this.participant = null;
    this.issuedFrom = null;
    this.issuedTo = null;
    this.sortField = DEFAULT_SORT;
    this.sortOrder = DEFAULT_ORDER;
    this.load(1);
  }

  hasActiveFilters(): boolean {
    return (
      this.statusFilter != null ||
      this.participant != null ||
      this.issuedFrom != null ||
      this.issuedTo != null ||
      this.sortField !== DEFAULT_SORT ||
      this.sortOrder !== DEFAULT_ORDER
    );
  }

  refresh(): void {
    this.service.invalidate();
    this.load(this.pagination().page);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.pagination().total_pages) return;
    this.load(page);
  }

  sweep(): void {
    this.confirmation.confirm({
      header: this.translate.instant('BILLING.TRACKING.SWEEP_CONFIRM_HEADER') as string,
      message: this.translate.instant('BILLING.TRACKING.SWEEP_CONFIRM_MESSAGE') as string,
      acceptLabel: this.translate.instant('COMMON.ACTIONS.VALIDATE') as string,
      rejectLabel: this.translate.instant('COMMON.ACTIONS.CANCEL') as string,
      accept: () => {
        this.service
          .overdueSweep()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (res) => {
              this.snackbar.openSnackBar(
                this.translate.instant('BILLING.TRACKING.SWEEP_DONE', {
                  count: res.data.marked,
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

  private handleError(error: unknown): void {
    this.errorHandler.handleError(error instanceof ApiResponse ? (error.data as string) : null);
  }
}
