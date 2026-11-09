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
import { LocaleService } from '../../../../core/services/language/locale.service';
import { SharingOperationOut } from '../../../../shared/dtos/administrative-document.dtos';
import {
  ProcedureDefinitionOut,
  ProcedureItemOut,
  ProcedureListQuery,
  ProcedureStatus,
} from '../../../../shared/dtos/administrative-procedure.dtos';
import { LocaleDatePipe } from '../../../../shared/pipes/locale-format/locale-format-pipes';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { AdministrativeDocumentService } from '../../../../shared/services/administrative-document.service';
import { AdministrativeProcedureService } from '../../../../shared/services/administrative-procedure.service';
import { translatedOptions } from '../../../../shared/utils/translated-options.utils';
import { TagSeverity, extractApiErrorMessage } from '../../administrative-document-format';
import {
  I18nText,
  dueText,
  pickLabel,
  procedureStatusLabelKey,
  procedureStatusSeverity,
} from '../../procedures/procedure-format';
import { DossierCreateDialog } from '../dossier-create-dialog/dossier-create-dialog';

const PAGE_LIMIT = 20;

interface SelectOption<T> {
  label: string;
  value: T;
}

/**
 * "Toutes les démarches": every procedure of the community, newest first,
 * finished ones included (the dashboard keeps those for a month). Filters by
 * type (the catalogue's), common status and operation.
 */
@Component({
  selector: 'app-dossier-list',
  standalone: true,
  imports: [TranslatePipe, TableModule, Select, Button, Tag, FormsModule, LocaleDatePipe],
  templateUrl: './dossier-list.html',
  providers: [DialogService, ErrorMessageHandler],
})
export class DossierList implements OnInit {
  private readonly service = inject(AdministrativeProcedureService);
  private readonly documents = inject(AdministrativeDocumentService);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly translate = inject(TranslateService);
  private readonly dialogService = inject(DialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly lang = inject(LocaleService).locale;

  private dialogRef?: DynamicDialogRef | null;

  constructor() {
    this.updatePaginationTranslation();
    this.destroyRef.onDestroy(() => this.dialogRef?.destroy());
  }

  readonly procedures = signal<ProcedureItemOut[]>([]);
  readonly pagination = signal<Pagination>(new Pagination(1, PAGE_LIMIT, 0, 0));
  readonly loading = signal<boolean>(true);
  readonly operations = signal<SharingOperationOut[]>([]);
  readonly definitions = signal<ProcedureDefinitionOut[]>([]);
  readonly currentPageReportTemplate = signal<string>('');

  readonly firstRow = computed(() => (this.pagination().page - 1) * this.pagination().limit);
  readonly showPaginator = computed(() => this.pagination().total_pages > 1);
  readonly operationOptions = computed<SelectOption<number>[]>(() =>
    this.operations().map((op) => ({ label: op.name, value: op.id })),
  );
  /** Every type of the catalogue, once, in the reader's language. */
  readonly typeOptions = computed<SelectOption<string>[]>(() => {
    const lang = this.lang();
    const byCode = new Map<string, string>();
    for (const d of this.definitions()) {
      if (d.purpose === 'filing' && !byCode.has(d.code)) {
        byCode.set(d.code, pickLabel(d.labels, lang, d.code));
      }
    }
    return [...byCode].map(([value, label]) => ({ value, label }));
  });

  // Filter state is plain fields bound with [(ngModel)]; server data lives in signals.
  statusFilter: ProcedureStatus | null = null;
  typeFilter: string | null = null;
  operationFilter: number | null = null;

  readonly statusOptions = translatedOptions<SelectOption<ProcedureStatus>>(
    [
      ProcedureStatus.DRAFT,
      ProcedureStatus.READY,
      ProcedureStatus.SENT,
      ProcedureStatus.IN_FORCE,
      ProcedureStatus.REFUSED,
      ProcedureStatus.CANCELLED,
      ProcedureStatus.LAPSED,
    ].map((value) => ({ label: procedureStatusLabelKey(value), value })),
  );

  ngOnInit(): void {
    this.documents
      .listSharingOperations()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.operations.set(Array.isArray(res.data) ? res.data : []),
        error: () => this.operations.set([]),
      });
    this.service
      .listDefinitions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.definitions.set(Array.isArray(res.data) ? res.data : []),
        error: () => this.definitions.set([]),
      });

    // `/administrative-document?id_sharing_operation=2` from a sharing operation.
    // This subscription owns the first load so the filter applies to it.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const operation = Number(params.get('id_sharing_operation'));
      this.operationFilter = Number.isInteger(operation) && operation > 0 ? operation : null;
      this.load(1);
    });
  }

  load(page: number): void {
    this.loading.set(true);
    const query: ProcedureListQuery = { page, limit: PAGE_LIMIT };
    if (this.statusFilter != null) query.status = this.statusFilter;
    if (this.typeFilter != null) query.code = this.typeFilter;
    if (this.operationFilter != null) query.operation_id = this.operationFilter;

    this.service
      .listProcedures(query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.procedures.set(Array.isArray(res.data) ? res.data : []);
          this.pagination.set(res.pagination);
          this.updatePaginationTranslation();
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorHandler.handleError(extractApiErrorMessage(error));
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
    this.load(1);
  }

  hasActiveFilters(): boolean {
    return this.statusFilter != null || this.typeFilter != null || this.operationFilter != null;
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

  openProcedure(procedure: ProcedureItemOut): void {
    void this.router.navigate(['/administrative-document/procedures', procedure.id]);
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
        if (created) void this.router.navigate(['/administrative-document/procedures', created]);
      });
  }

  // ---- presentation helpers ----------------------------------------------

  typeLabel(row: ProcedureItemOut): string {
    return pickLabel(row.labels, this.lang(), row.code);
  }

  stepLabel(row: ProcedureItemOut): string {
    return pickLabel(row.step_labels, this.lang(), row.step);
  }

  statusSeverity(row: ProcedureItemOut): TagSeverity {
    return procedureStatusSeverity(row.status);
  }

  nextAction(row: ProcedureItemOut): string {
    return pickLabel(row.next_action.labels, this.lang());
  }

  due(row: ProcedureItemOut): I18nText | null {
    return dueText(row.due_in_working_days, row.next_action_due);
  }
}
