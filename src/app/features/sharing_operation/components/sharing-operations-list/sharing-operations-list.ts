import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Button } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PrimeTemplate } from 'primeng/api';
import { ReactiveFormsModule } from '@angular/forms';
import { Table, TableLazyLoadEvent, TableModule, TablePageEvent } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SharingOperationTypePipe } from '../../../../shared/pipes/sharing-operation-type/sharing-operation-type-pipe';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import {
  SharingOperationPartialDTO,
  SharingOperationPartialQuery,
} from '../../../../shared/dtos/sharing_operation.dtos';
import { Pagination } from '../../../../core/dtos/api.response';
import { SharingOperationService } from '../../../../shared/services/sharing_operation.service';
import { Router } from '@angular/router';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { SharingOperationCreationUpdate } from '../sharing-operation-creation-update/sharing-operation-creation-update';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { HeaderPage } from '../../../../layout/header-page/header-page';

@Component({
  selector: 'app-sharing-operations-list',
  standalone: true,
  imports: [
    Button,
    InputTextModule,
    PrimeTemplate,
    ReactiveFormsModule,
    TableModule,
    TagModule,
    SharingOperationTypePipe,
    TranslatePipe,
    HeaderPage,
  ],
  templateUrl: './sharing-operations-list.html',
  styleUrl: './sharing-operations-list.css',
  providers: [DialogService, ErrorMessageHandler],
})
export class SharingOperationsList implements OnInit {
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

  readonly firstRow = computed(
    () => (this.paginationInfo().page - 1) * this.paginationInfo().limit,
  );
  readonly showPaginator = computed(() => this.paginationInfo().total_pages > 1);

  ngOnInit(): void {
    this.updatePaginationTranslation();
  }

  updatePaginationTranslation(): void {
    this.translate
      .get('SHARING_OPERATION.LIST.PAGE_REPORT_TEMPLATE_SHARING_OP_LABEL', {
        page: this.paginationInfo().page,
        total_pages: this.paginationInfo().total_pages,
        total: this.paginationInfo().total,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translatedText: string) => {
        this.currentPageReportTemplate.set(translatedText);
      });
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
          } else {
            console.error('Error fetching meters partial list');
          }
        },
        error: (_error) => {
          console.error('Error fetching meters partial list');
        },
      });
  }

  lazyLoadSharingOperation($event: TableLazyLoadEvent): void {
    const current: SharingOperationPartialQuery = { ...this.filter() };
    if ($event.first !== undefined && $event.rows !== undefined) {
      if ($event.rows) {
        current.page = $event.first / $event.rows + 1;
      } else {
        current.page = 1;
      }
    }

    if ($event.sortField) {
      const sortDirection = $event.sortOrder === 1 ? 'ASC' : 'DESC';
      delete current.sort_type;
      delete current.sort_name;

      switch ($event.sortField) {
        case 'type': {
          current.sort_type = sortDirection;
          break;
        }
        case 'name': {
          current.sort_name = sortDirection;
          break;
        }
      }
    }
    if ($event.filters) {
      const nameFilter = $event.filters['name'];
      if (nameFilter && !Array.isArray(nameFilter) && nameFilter.value) {
        current.name = nameFilter.value as string;
      } else {
        delete current.name;
      }

      const typeFilter = $event.filters['type'];
      if (typeFilter && !Array.isArray(typeFilter) && typeFilter.value) {
        current.type = typeFilter.value as string;
      } else {
        delete current.type;
      }
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

  clear(dt: Table): void {
    dt.clear();
    this.filter.set({ page: 1, limit: 10 });
    this.loadSharingOperation();
  }

  onRowClick(sharingOp: SharingOperationPartialDTO): void {
    void this.routing.navigate(['/sharing_operations/', sharingOp.id]);
  }
}
