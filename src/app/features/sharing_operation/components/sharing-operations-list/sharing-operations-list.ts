import {Component, inject, OnInit, signal} from '@angular/core';
import { Button } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PrimeTemplate } from 'primeng/api';
import { ReactiveFormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
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
  sharingOperationList = signal<SharingOperationPartialDTO[]>([]);
  paginationInfo: Pagination = new Pagination(1, 10, 0, 1);
  ref?: DynamicDialogRef | null;
  filter = signal<SharingOperationPartialQuery>({ page: 1, limit: 10 });
  currentPageReportTemplate: string = '';


  ngOnInit(): void {
    this.updatePaginationTranslation();
  }

  updatePaginationTranslation() {
    this.translate
      .get('SHARING_OPERATION.LIST.PAGE_REPORT_TEMPLATE_SHARING_OP_LABEL', {
        page: this.paginationInfo.page,
        total_pages: this.paginationInfo.total_pages,
        total: this.paginationInfo.total,
      })
      .subscribe((translatedText: string) => {
        this.currentPageReportTemplate = translatedText;
      });
  }

  onAddSharingOperation() {
    this.ref = this.dialogService.open(SharingOperationCreationUpdate, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('SHARING_OPERATION.LIST.ADD_SHARING_OP_HEADER'),
      baseZIndex: 1500,
    });
    if (this.ref) {
      this.ref.onClose.subscribe((result) => {
        if (result) {
          this.snackbarNotification.openSnackBar(
            this.translate.instant(
              'SHARING_OPERATION.LIST.SHARING_OPERATION_ADDED_SUCCESSFULLY_LABEL',
            ),
            VALIDATION_TYPE,
          );
          this.loadSharingOperation();
        }
      });
    }
  }

  loadSharingOperation() {
    this.sharingOperationsService.getSharingOperationList(this.filter()).subscribe({
      next: (response) => {
        if (response) {
          this.sharingOperationList.set(response.data as SharingOperationPartialDTO[]);
          this.paginationInfo = response.pagination;
        } else {
          console.error('Error fetching meters partial list');
        }
      },
      error: (_error) => {
        console.error('Error fetching meters partial list');
      },
    });
  }

  lazyLoadSharingOperation($event: any) {
    const current: any = { ...this.filter() };
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
      delete current.sort_status;

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
      Object.entries($event.filters).forEach(([field, meta]) => {
        if ((meta as any).value) {
          current[field] = (meta as any).value;
        } else {
          delete current[field];
        }
      });
    }
    this.loadSharingOperation();
  }

  pageChange($event: any) {
    const current: any = { ...this.filter() };
    current.page = $event.first / $event.rows + 1;
    this.filter.set(current);
    this.loadSharingOperation();
  }

  clear(dt: any) {
    dt.clear();
  }

  onRowClick(sharingOp: any) {
    this.routing.navigate(['/members/sharing/', sharingOp.id]);
  }
}
