import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { InputGroup } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { Table, TableLazyLoadEvent, TableModule, TablePageEvent } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import {
  SharingOperationPartialDTO,
  SharingOperationPartialQuery,
} from '../../../../shared/dtos/sharing_operation.dtos';
import { Pagination } from '../../../../core/dtos/api.response';
import { SharingOperationService } from '../../../../shared/services/sharing_operation.service';
import { SharingOperationType } from '../../../../shared/types/sharing_operation.types';
import { SharingOperationTypePipe } from '../../../../shared/pipes/sharing-operation-type/sharing-operation-type-pipe';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { SharingOperationCreationUpdate } from '../sharing-operation-creation-update/sharing-operation-creation-update';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { HeaderPage } from '../../../../layout/header-page/header-page';
import { DebouncedPInputComponent } from '../../../../shared/components/debounced-p-input/debounced-p-input.component';

@Component({
  selector: 'app-sharing-operations-list',
  standalone: true,
  imports: [
    Button,
    FormsModule,
    Select,
    InputGroup,
    InputGroupAddonModule,
    TableModule,
    TagModule,
    TranslatePipe,
    HeaderPage,
    DebouncedPInputComponent,
  ],
  templateUrl: './sharing-operations-list.html',
  styleUrl: './sharing-operations-list.css',
  providers: [DialogService, ErrorMessageHandler],
})
export class SharingOperationsList {
  private sharingOperationsService = inject(SharingOperationService);
  private routing = inject(Router);
  private dialogService = inject(DialogService);
  private snackbarNotification = inject(SnackbarNotification);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  readonly sharingOperationList = signal<SharingOperationPartialDTO[]>([]);
  readonly paginationInfo = signal<Pagination>(new Pagination(1, 10, 0, 1));
  readonly filter = signal<SharingOperationPartialQuery>({ page: 1, limit: 10 });
  readonly currentPageReportTemplate = signal<string>('');
  ref?: DynamicDialogRef | null;

  // Filter signals
  readonly searchField = signal<string>('name');
  readonly searchText = signal<string>('');
  readonly typeFilter = signal<SharingOperationType | null>(null);
  readonly hasActiveFilters = computed(() => !!this.searchText() || this.typeFilter() !== null);

  readonly firstRow = computed(
    () => (this.paginationInfo().page - 1) * this.paginationInfo().limit,
  );
  readonly showPaginator = computed(() => this.paginationInfo().total_pages > 1);

  searchFieldOptions = [{ label: 'SHARING_OPERATION.LIST.NAME_LABEL', value: 'name' }];

  typeOptions = [
    {
      label: 'SHARING_OPERATION.TYPE.INSIDE_BUILDING',
      value: SharingOperationType.LOCAL,
      icon: 'pi pi-home',
    },
    { label: 'SHARING_OPERATION.TYPE.CER', value: SharingOperationType.CER, icon: 'pi pi-sitemap' },
    { label: 'SHARING_OPERATION.TYPE.CEC', value: SharingOperationType.CEC, icon: 'pi pi-globe' },
  ];

  constructor() {
    this.destroyRef.onDestroy(() => this.ref?.destroy());
    this.updatePaginationTranslation();
  }

  updatePaginationTranslation(): void {
    this.translate
      .get('SHARING_OPERATION.LIST.PAGE_REPORT_TEMPLATE_SHARING_OP_LABEL', {
        page: this.paginationInfo().page,
        total_pages: this.paginationInfo().total_pages,
        total: this.paginationInfo().total,
      })
      .subscribe((translatedText: string) => {
        this.currentPageReportTemplate.set(translatedText);
      });
  }

  applyFilters(): void {
    const current: SharingOperationPartialQuery = { page: 1, limit: this.filter().limit };
    const text = this.searchText();
    if (text) {
      current.name = text;
    }
    const type = this.typeFilter();
    if (type !== null) {
      current.type = String(type);
    }
    this.filter.set(current);
    this.loadSharingOperation();
  }

  onSearchTextChange(query: string): void {
    this.searchText.set(query);
    this.applyFilters();
  }

  onSearchFieldChange(): void {
    if (this.searchText()) {
      this.applyFilters();
    }
  }

  onTypeFilterChange(type: SharingOperationType | null): void {
    this.typeFilter.set(type);
    this.applyFilters();
  }

  onAddSharingOperation(): void {
    this.ref = this.dialogService.open(SharingOperationCreationUpdate, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('SHARING_OPERATION.LIST.ADD_SHARING_OP_HEADER') as string,
      baseZIndex: 1500,
    });
    if (this.ref) {
      this.ref.onClose.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
        if (result) {
          this.snackbarNotification.openSnackBar(
            this.translate.instant(
              'SHARING_OPERATION.LIST.SHARING_OPERATION_ADDED_SUCCESSFULLY_LABEL',
            ) as string,
            VALIDATION_TYPE,
          );
          this.loadSharingOperation();
        }
      });
    }
  }

  loadSharingOperation(): void {
    this.sharingOperationsService
      .getSharingOperationList(this.filter())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response) {
            this.sharingOperationList.set(response.data as SharingOperationPartialDTO[]);
            this.paginationInfo.set(response.pagination);
            this.updatePaginationTranslation();
          } else {
            console.error('Error fetching sharing operations partial list');
          }
        },
        error: (_error) => {
          console.error('Error fetching sharing operations partial list');
        },
      });
  }

  lazyLoadSharingOperation($event: TableLazyLoadEvent): void {
    const current: SharingOperationPartialQuery = { ...this.filter() };
    if ($event.first !== undefined && $event.rows !== undefined) {
      current.page = $event.rows ? $event.first / $event.rows + 1 : 1;
    }
    if (current.page < 1) {
      current.page = 1;
    }
    this.filter.set(current);
    this.loadSharingOperation();
  }

  pageChange($event: TablePageEvent): void {
    const current: SharingOperationPartialQuery = { ...this.filter() };
    current.page = ($event.first ?? 0) / ($event.rows ?? 10) + 1;
    this.filter.set(current);
    this.loadSharingOperation();
  }

  clear(table: Table): void {
    table.clear();
    this.searchText.set('');
    this.searchField.set('name');
    this.typeFilter.set(null);
    this.filter.set({ page: 1, limit: 10 });
    this.loadSharingOperation();
  }

  onRowClick(sharingOp: SharingOperationPartialDTO): void {
    void this.routing.navigate(['/sharing_operations/', sharingOp.id]);
  }

  protected readonly SharingOperationType = SharingOperationType;
}
