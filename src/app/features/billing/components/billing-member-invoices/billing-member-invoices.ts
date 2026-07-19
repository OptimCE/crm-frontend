import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';

import { ApiResponse, Pagination } from '../../../../core/dtos/api.response';
import { ERROR_TYPE } from '../../../../core/dtos/notification';
import {
  InvoiceOut,
  InvoiceSortField,
  InvoiceStatus,
  InvoiceType,
  MyInvoiceQuery,
  SortOrder,
} from '../../../../shared/dtos/billing.dtos';
import { BillingService } from '../../../../shared/services/billing.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { downloadBlob } from '../../../../shared/utils/download.utils';
import { HeaderPage } from '../../../../layout/header-page/header-page';
import {
  formatMoney,
  invoiceStatusLabelKey,
  invoiceStatusSeverity,
  invoiceTypeLabelKey,
  TagSeverity,
  toApiDate,
} from '../../billing-format';

const PAGE_LIMIT = 20;

const DEFAULT_SORT: InvoiceSortField = 'issued_at';
const DEFAULT_ORDER: SortOrder = 'desc';

interface StatusOption {
  label: string;
  value: InvoiceStatus;
}

interface SortOption {
  label: string;
  value: InvoiceSortField;
}

/**
 * Member self-service view. Lists only the caller's own invoices via
 * `GET /invoices/mine` — the server scopes the result to the authenticated
 * member from the auth header, so no member-id lookup happens here.
 * Reused as the manager console's "My invoices" tab (pass [showHeader]="false").
 */
@Component({
  selector: 'app-billing-member-invoices',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    TranslatePipe,
    Button,
    DatePicker,
    Select,
    Skeleton,
    Tag,
    Tooltip,
    HeaderPage,
  ],
  providers: [ErrorMessageHandler],
  templateUrl: './billing-member-invoices.html',
})
export class BillingMemberInvoices implements OnInit {
  private readonly service = inject(BillingService);
  private readonly translate = inject(TranslateService);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly destroyRef = inject(DestroyRef);

  readonly showHeader = input<boolean>(true);

  readonly invoices = signal<InvoiceOut[]>([]);
  readonly loading = signal<boolean>(true);
  readonly pagination = signal<Pagination>(new Pagination(1, PAGE_LIMIT, 0, 0));

  statusFilter: InvoiceStatus | null = null;
  issuedFrom: Date | null = null;
  issuedTo: Date | null = null;
  sortField: InvoiceSortField = DEFAULT_SORT;
  sortOrder: SortOrder = DEFAULT_ORDER;

  statusOptions: StatusOption[] = [];
  sortOptions: SortOption[] = [];

  readonly hasMultiplePages = computed(() => this.pagination().total_pages > 1);

  protected readonly skeletons = [1, 2, 3];

  ngOnInit(): void {
    const statuses = [
      InvoiceStatus.ISSUED,
      InvoiceStatus.SENT,
      InvoiceStatus.PAID,
      InvoiceStatus.OVERDUE,
      InvoiceStatus.CANCELLED,
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
    this.load(1);
  }

  load(page: number): void {
    this.loading.set(true);
    const query: MyInvoiceQuery = {
      page,
      limit: PAGE_LIMIT,
      sort: this.sortField,
      order: this.sortOrder,
    };
    if (this.statusFilter != null) query.status = this.statusFilter;
    const from = toApiDate(this.issuedFrom);
    const to = toApiDate(this.issuedTo);
    if (from) query.issued_from = from;
    if (to) query.issued_to = to;
    this.service
      .listMyInvoices(query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.invoices.set(Array.isArray(res.data) ? res.data : []);
          this.pagination.set(res.pagination);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorHandler.handleError(
            error instanceof ApiResponse ? (error.data as string) : null,
          );
        },
      });
  }

  applyFilters(): void {
    this.load(1);
  }

  toggleSortOrder(): void {
    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    this.load(1);
  }

  clearFilters(): void {
    this.statusFilter = null;
    this.issuedFrom = null;
    this.issuedTo = null;
    this.sortField = DEFAULT_SORT;
    this.sortOrder = DEFAULT_ORDER;
    this.load(1);
  }

  hasActiveFilters(): boolean {
    return (
      this.statusFilter != null ||
      this.issuedFrom != null ||
      this.issuedTo != null ||
      this.sortField !== DEFAULT_SORT ||
      this.sortOrder !== DEFAULT_ORDER
    );
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.pagination().total_pages) return;
    this.load(page);
  }

  // ----- display helpers -------------------------------------------------

  statusLabelKey(inv: InvoiceOut): string {
    return invoiceStatusLabelKey(inv.status);
  }
  statusSeverity(inv: InvoiceOut): TagSeverity {
    return invoiceStatusSeverity(inv.status);
  }
  typeLabelKey(inv: InvoiceOut): string {
    return invoiceTypeLabelKey(inv.type);
  }
  isCreditNote(inv: InvoiceOut): boolean {
    return inv.type === InvoiceType.CREDIT_NOTE;
  }
  money(inv: InvoiceOut): string {
    return formatMoney(inv.total, inv.currency);
  }

  // ----- PDF (view-only) -------------------------------------------------

  downloadPdf(inv: InvoiceOut): void {
    this.service
      .downloadInvoicePdf(inv.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ blob, filename }) => downloadBlob(blob, filename),
        error: () =>
          this.snackbar.openSnackBar(
            this.translate.instant('BILLING.PDF.DOWNLOAD_FAILED') as string,
            ERROR_TYPE,
          ),
      });
  }
}
