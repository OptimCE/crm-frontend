import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Select } from 'primeng/select';
import { TableLazyLoadEvent, TableModule, TablePageEvent } from 'primeng/table';
import { Tag } from 'primeng/tag';

import { Pagination } from '../../../../core/dtos/api.response';
import {
  DossierOut,
  DossierQuery,
  DossierSortField,
  DossierStatus,
  DossierType,
  SharingOperationOut,
  SortOrder,
} from '../../../../shared/dtos/administrative-document.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { AdministrativeDocumentService } from '../../../../shared/services/administrative-document.service';
import {
  TagSeverity,
  dossierStatusLabelKey,
  dossierStatusSeverity,
  dossierTypeLabelKey,
  extractApiErrorMessage,
} from '../../administrative-document-format';
import { DossierCreateDialog } from '../dossier-create-dialog/dossier-create-dialog';

const PAGE_LIMIT = 20;
const DEFAULT_SORT: DossierSortField = 'created_at';
const DEFAULT_ORDER: SortOrder = 'desc';

interface SelectOption<T> {
  label: string;
  value: T;
}

@Component({
  selector: 'app-dossier-list',
  standalone: true,
  imports: [TranslatePipe, TableModule, Select, Button, Tag, FormsModule, DatePipe],
  templateUrl: './dossier-list.html',
  providers: [DialogService, ErrorMessageHandler],
})
export class DossierList implements OnInit {
  private readonly service = inject(AdministrativeDocumentService);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly translate = inject(TranslateService);
  private readonly dialogService = inject(DialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private dialogRef?: DynamicDialogRef | null;

  constructor() {
    this.updatePaginationTranslation();
    this.destroyRef.onDestroy(() => this.dialogRef?.destroy());
  }

  readonly dossiers = signal<DossierOut[]>([]);
  readonly pagination = signal<Pagination>(new Pagination(1, PAGE_LIMIT, 0, 0));
  readonly loading = signal<boolean>(true);
  readonly operations = signal<SharingOperationOut[]>([]);
  readonly currentPageReportTemplate = signal<string>('');

  readonly firstRow = computed(() => (this.pagination().page - 1) * this.pagination().limit);
  readonly showPaginator = computed(() => this.pagination().total_pages > 1);
  readonly operationNames = computed<ReadonlyMap<number, string>>(
    () => new Map(this.operations().map((op) => [op.id, op.name])),
  );
  readonly operationOptions = computed<SelectOption<number>[]>(() =>
    this.operations().map((op) => ({ label: op.name, value: op.id })),
  );

  // Filter state is plain mutable fields bound with [(ngModel)] — only server
  // data lives in signals.
  statusFilter: DossierStatus | null = null;
  typeFilter: DossierType | null = null;
  operationFilter: number | null = null;
  sortField: DossierSortField = DEFAULT_SORT;
  sortOrder: SortOrder = DEFAULT_ORDER;

  statusOptions: SelectOption<DossierStatus>[] = [];
  typeOptions: SelectOption<DossierType>[] = [];
  sortOptions: SelectOption<DossierSortField>[] = [];

  ngOnInit(): void {
    this.buildOptions();
    this.loadOperations();

    // `/administrative-document?id_sharing_operation=2` from a sharing operation.
    // This subscription owns the first load so the filter is applied to it,
    // rather than loading unfiltered and then re-loading.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const operation = Number(params.get('id_sharing_operation'));
      this.operationFilter = Number.isInteger(operation) && operation > 0 ? operation : null;
      this.load(1);
    });
  }

  private buildOptions(): void {
    const statuses = [
      DossierStatus.IN_PREPARATION,
      DossierStatus.SUBMITTED,
      DossierStatus.COMPLETE,
      DossierStatus.CLOSED,
      DossierStatus.LAPSED,
    ];
    this.statusOptions = statuses.map((value) => ({
      label: this.translate.instant(dossierStatusLabelKey(value)) as string,
      value,
    }));

    const types = [
      DossierType.CREATION_NOTIFICATION,
      DossierType.MODIFICATION,
      DossierType.ANNUAL_REPORT,
      DossierType.SHARING_AUTHORIZATION,
      DossierType.SHARING_MODIFICATION,
      DossierType.CESSATION,
    ];
    this.typeOptions = types.map((value) => ({
      label: this.translate.instant(dossierTypeLabelKey(value)) as string,
      value,
    }));

    this.sortOptions = [
      {
        value: 'created_at',
        label: this.translate.instant('ADMINISTRATIVE_DOCUMENT.SORT.CREATED_AT') as string,
      },
      {
        value: 'updated_at',
        label: this.translate.instant('ADMINISTRATIVE_DOCUMENT.SORT.UPDATED_AT') as string,
      },
      {
        value: 'submitted_at',
        label: this.translate.instant('ADMINISTRATIVE_DOCUMENT.SORT.SUBMITTED_AT') as string,
      },
      {
        value: 'status',
        label: this.translate.instant('ADMINISTRATIVE_DOCUMENT.SORT.STATUS') as string,
      },
      {
        value: 'dossier_type',
        label: this.translate.instant('ADMINISTRATIVE_DOCUMENT.SORT.TYPE') as string,
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
    const query: DossierQuery = {
      page,
      limit: PAGE_LIMIT,
      sort: this.sortField,
      order: this.sortOrder,
    };
    if (this.statusFilter != null) query.status = this.statusFilter;
    if (this.typeFilter != null) query.dossier_type = this.typeFilter;
    if (this.operationFilter != null) query.id_sharing_operation = this.operationFilter;

    this.service
      .listDossiers(query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.dossiers.set(Array.isArray(res.data) ? res.data : []);
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
      .get('ADMINISTRATIVE_DOCUMENT.LIST.PAGE_REPORT_TEMPLATE_LABEL', {
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
      this.statusFilter != null ||
      this.typeFilter != null ||
      this.operationFilter != null ||
      this.sortField !== DEFAULT_SORT ||
      this.sortOrder !== DEFAULT_ORDER
    );
  }

  toggleSortOrder(): void {
    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    this.load(1);
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

  openDossier(dossier: DossierOut): void {
    void this.router.navigate(['/administrative-document/dossiers', dossier.id]);
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
      .subscribe((created: boolean) => {
        if (created) this.refresh();
      });
  }

  // ---- presentation helpers (templates never import the format module) ----

  typeLabelKey(dossier: DossierOut): string {
    return dossierTypeLabelKey(dossier.dossier_type);
  }

  statusLabelKey(dossier: DossierOut): string {
    return dossierStatusLabelKey(dossier.status);
  }

  statusSeverity(dossier: DossierOut): TagSeverity {
    return dossierStatusSeverity(dossier.status);
  }

  operationName(dossier: DossierOut): string {
    return (
      this.operationNames().get(dossier.id_sharing_operation) ?? `#${dossier.id_sharing_operation}`
    );
  }

  private handleError(error: unknown): void {
    this.errorHandler.handleError(extractApiErrorMessage(error));
  }
}
