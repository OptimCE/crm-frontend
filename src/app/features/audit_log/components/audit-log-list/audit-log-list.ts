import { DatePipe, JsonPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Table, TableLazyLoadEvent, TableModule, TablePageEvent } from 'primeng/table';
import { HeaderPage } from '../../../../layout/header-page/header-page';
import { AUDIT_ACTIONS } from '../../../../shared/constants/audit-actions';
import { AuditLogDTO, AuditLogQuery } from '../../../../shared/dtos/audit-log.dtos';
import { AuditLogService } from '../../../../shared/services/audit-log.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { ERROR_TYPE } from '../../../../core/dtos/notification';

interface AuditLogErrorBody {
  data?: string;
  error_code?: number;
}

@Component({
  selector: 'app-audit-log-list',
  imports: [
    Button,
    TranslatePipe,
    TableModule,
    Select,
    DatePicker,
    InputText,
    InputNumber,
    FormsModule,
    HeaderPage,
    DatePipe,
    JsonPipe,
  ],
  templateUrl: './audit-log-list.html',
  styleUrl: './audit-log-list.css',
  providers: [ErrorMessageHandler],
})
export class AuditLogList {
  private auditLogService = inject(AuditLogService);
  private errorHandler = inject(ErrorMessageHandler);
  private snackbarNotification = inject(SnackbarNotification);
  private translate = inject(TranslateService);

  readonly auditLogs = signal<AuditLogDTO[]>([]);
  readonly paginationInfo = signal({ page: 1, limit: 10, total: 0, total_pages: 1 });
  readonly filter = signal<AuditLogQuery>({
    page: 1,
    limit: 10,
    sort_timestamp: 'DESC',
  });
  readonly currentPageReportTemplate = signal<string>('');
  readonly loading = signal<boolean>(true);
  readonly expandedRows = signal<Record<string, boolean>>({});

  readonly actionFilter = signal<string | null>(null);
  readonly entityTypeFilter = signal<string>('');
  readonly entityIdFilter = signal<string>('');
  readonly userIdFilter = signal<number | null>(null);
  readonly fromFilter = signal<Date | null>(null);
  readonly toFilter = signal<Date | null>(null);

  readonly hasActiveFilters = computed(
    () =>
      this.actionFilter() !== null ||
      !!this.entityTypeFilter() ||
      !!this.entityIdFilter() ||
      this.userIdFilter() !== null ||
      this.fromFilter() !== null ||
      this.toFilter() !== null,
  );
  readonly firstRow = computed(
    () => (this.paginationInfo().page - 1) * this.paginationInfo().limit,
  );
  readonly showPaginator = computed(() => this.paginationInfo().total_pages > 1);

  readonly actionOptions = AUDIT_ACTIONS.map((code) => ({
    label: `AUDIT.ACTIONS.${code}`,
    value: code,
  }));

  constructor() {
    this.updatePaginationTranslation();
  }

  updatePaginationTranslation(): void {
    this.translate
      .get('AUDIT.LIST.PAGE_REPORT_TEMPLATE_LABEL', {
        page: this.paginationInfo().page,
        total_pages: this.paginationInfo().total_pages,
        total: this.paginationInfo().total,
      })
      .subscribe((translatedText: string) => {
        this.currentPageReportTemplate.set(translatedText);
      });
  }

  loadAuditLogs(): void {
    this.loading.set(true);
    this.auditLogService.getAuditLogList(this.filter()).subscribe({
      next: (response) => {
        if (response) {
          this.auditLogs.set(response.data as AuditLogDTO[]);
          this.paginationInfo.set(response.pagination);
          this.updatePaginationTranslation();
          this.expandedRows.set({});
        } else {
          this.errorHandler.handleError(response);
        }
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.errorHandler.handleError(error);
        this.loading.set(false);
      },
    });
  }

  applyFilters(): void {
    const current: AuditLogQuery = {
      page: 1,
      limit: this.filter().limit,
      sort_timestamp: this.filter().sort_timestamp ?? 'DESC',
    };
    const action = this.actionFilter();
    if (action !== null) current.action = action;
    const entityType = this.entityTypeFilter().trim();
    if (entityType) current.entity_type = entityType;
    const entityId = this.entityIdFilter().trim();
    if (entityId) current.entity_id = entityId;
    const userId = this.userIdFilter();
    if (userId !== null) current.user_id = userId;
    const from = this.fromFilter();
    if (from) current.from = from.toISOString();
    const to = this.toFilter();
    if (to) current.to = to.toISOString();
    this.filter.set(current);
    this.loadAuditLogs();
  }

  lazyLoad($event: TableLazyLoadEvent): void {
    const current: AuditLogQuery = { ...this.filter() };
    if ($event.first !== undefined && $event.rows !== undefined) {
      current.page = $event.rows ? $event.first / $event.rows + 1 : 1;
    }
    if (current.page < 1) current.page = 1;
    if ($event.sortField === 'timestamp' && $event.sortOrder !== undefined) {
      current.sort_timestamp = $event.sortOrder === 1 ? 'ASC' : 'DESC';
    }
    this.filter.set(current);
    this.loadAuditLogs();
  }

  pageChange($event: TablePageEvent): void {
    const current: AuditLogQuery = { ...this.filter() };
    current.page = ($event.first ?? 0) / ($event.rows ?? 10) + 1;
    this.filter.set(current);
    this.loadAuditLogs();
  }

  clear(table: Table): void {
    table.clear();
    this.actionFilter.set(null);
    this.entityTypeFilter.set('');
    this.entityIdFilter.set('');
    this.userIdFilter.set(null);
    this.fromFilter.set(null);
    this.toFilter.set(null);
    this.filter.set({ page: 1, limit: 10, sort_timestamp: 'DESC' });
    this.loadAuditLogs();
  }

  toggleRow(row: AuditLogDTO): void {
    const current = { ...this.expandedRows() };
    if (current[row.id]) {
      delete current[row.id];
    } else {
      current[row.id] = true;
    }
    this.expandedRows.set(current);
  }

  isExpanded(row: AuditLogDTO): boolean {
    return !!this.expandedRows()[row.id];
  }

  onActionFilterChange(action: string | null): void {
    this.actionFilter.set(action);
    this.applyFilters();
  }

  onEntityTypeChange(value: string): void {
    this.entityTypeFilter.set(value);
    this.applyFilters();
  }

  onEntityIdChange(value: string): void {
    this.entityIdFilter.set(value);
    this.applyFilters();
  }

  onUserIdChange(value: number | null): void {
    this.userIdFilter.set(value);
    this.applyFilters();
  }

  onFromChange(value: Date | null): void {
    this.fromFilter.set(value);
    this.applyFilters();
  }

  onToChange(value: Date | null): void {
    this.toFilter.set(value);
    this.applyFilters();
  }

  onExport(): void {
    this.auditLogService.exportAuditLogCsv(this.filter()).subscribe({
      next: (response: HttpResponse<Blob>) => {
        const body = response.body;
        if (!body) {
          this.errorHandler.handleError();
          return;
        }
        const filename = this.extractFilename(response) ?? this.defaultFilename();
        const url = URL.createObjectURL(body);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
      },
      error: (error: HttpErrorResponse) => {
        const body = error.error as AuditLogErrorBody | null;
        if (body?.error_code === 32000) {
          this.snackbarNotification.openSnackBar(
            this.translate.instant('AUDIT.EXPORT.TOO_LARGE') as string,
            ERROR_TYPE,
          );
          return;
        }
        this.errorHandler.handleError(body?.data);
      },
    });
  }

  private extractFilename(response: HttpResponse<Blob>): string | null {
    const disposition = response.headers.get('Content-Disposition');
    if (!disposition) return null;
    const match = /filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i.exec(disposition);
    return match ? decodeURIComponent(match[1]) : null;
  }

  private defaultFilename(): string {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `audit-log-${stamp}.csv`;
  }
}
