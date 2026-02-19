import { Component, inject, OnInit } from '@angular/core';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { Button } from 'primeng/button';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { KeyPartialDTO } from '../../../../shared/dtos/key.dtos';
import { Pagination } from '../../../../core/dtos/api.response';
import { KeyService } from '../../../../shared/services/key.service';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { SharingOperationService } from '../../../../shared/services/sharing_operation.service';

@Component({
  selector: 'app-sharing-operation-add-key',
  standalone: true,
  imports: [TableModule, TagModule, Button, TranslatePipe],
  templateUrl: './sharing-operation-add-key.html',
  styleUrl: './sharing-operation-add-key.css',
  providers: [ErrorMessageHandler],
})
export class SharingOperationAddKey implements OnInit {
  private keysService = inject(KeyService);
  private config = inject(DynamicDialogConfig);
  private sharingOpService = inject(SharingOperationService);
  private ref = inject(DynamicDialogRef);
  private errorHandler = inject(ErrorMessageHandler);
  private translate = inject(TranslateService);
  keysList: KeyPartialDTO[] = [];
  loading: boolean = true;
  page: number = 1;
  paginated: Pagination = new Pagination(0, 5, 0, 0);
  selectedKey?: KeyPartialDTO;
  id: number;
  currentPageReportTemplate: string = '';

  constructor() {
    this.loading = true;
    this.page = 1;
    this.id = this.config.data.id;
  }

  loadKeys($event?: any, changeIsLoaded: boolean = true) {
    if (changeIsLoaded) {
      this.loading = true;
    }
    try {
      const params: any = {};

      if ($event && $event.filters) {
        for (const key in $event.filters) {
          const filter = $event.filters[key];
          if (filter) {
            if (Array.isArray(filter)) {
              if (filter[0].value !== null) {
                params[key] = filter[0].value;
              }
            }
          }
        }
      }
      this.keysService.getKeysList({ page: this.page, limit: 10, ...params }).subscribe({
        next: (response) => {
          if (response) {
            this.keysList = response.data as KeyPartialDTO[];
            this.paginated = response.pagination;
            if (changeIsLoaded) {
              this.loading = false;
            }
            this.updatePaginationTranslation();
          } else {
            this.errorHandler.handleError(response);
          }
        },
        error: (error) => {
          this.errorHandler.handleError(error);
        },
      });
    } catch (e) {
      this.errorHandler.handleError(e);
    }
  }

  ngOnInit() {
    this.updatePaginationTranslation();
  }

  updatePaginationTranslation() {
    console.log('THIS PAGINATED : ', this.paginated);
    this.translate
      .get('SHARING_OPERATION.ADD_KEY.PAGE_REPORT_TEMPLATE_KEYS_LABEL', {
        page: this.paginated.page,
        total_pages: this.paginated.total_pages,
        total: this.paginated.total,
      })
      .subscribe((translatedText: string) => {
        this.currentPageReportTemplate = translatedText;
      });
  }
  pageChange($event: any) {
    this.page = $event.first / $event.rows + 1;
    this.loadKeys();
  }

  clear(table: any) {
    table.clear();
  }

  addKey() {
    this.sharingOpService
      .addKeyToSharing({ id_sharing: this.id, id_key: this.selectedKey!.id })
      .subscribe({
        next: (response) => {
          if (response) {
            this.ref.close(true);
          } else {
            this.errorHandler.handleError();
          }
        },
        error: (error) => {
          this.errorHandler.handleError(error.data ?? null);
        },
      });
  }
}
