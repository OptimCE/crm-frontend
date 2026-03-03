import { Component, inject, Input, OnDestroy, OnInit, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { Ripple } from 'primeng/ripple';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Table, TableLazyLoadEvent, TableModule } from 'primeng/table';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { SnackbarNotification } from '../../../../../../../shared/services-ui/snackbar.notifcation.service';
import {
  DocumentExposedDTO,
  DocumentQueryDTO,
} from '../../../../../../../shared/dtos/document.dtos';
import { ApiResponse, Pagination } from '../../../../../../../core/dtos/api.response';
import { DocumentService } from '../../../../../../../shared/services/document.service';
import { MemberAddDocument } from '../../../../member-add-document/member-add-document';
import { VALIDATION_TYPE } from '../../../../../../../core/dtos/notification';
import { FilterMetadata } from 'primeng/api';
import { ErrorMessageHandler } from '../../../../../../../shared/services-ui/error.message.handler';

@Component({
  selector: 'app-member-view-documents-tab',
  imports: [Button, Ripple, TranslatePipe, TableModule],
  templateUrl: './member-view-documents-tab.html',
  styleUrl: './member-view-documents-tab.css',
  providers: [DialogService],
})
export class MemberViewDocumentsTab implements OnInit, OnDestroy {
  private documentService = inject(DocumentService);
  private translate = inject(TranslateService);
  private dialogService = inject(DialogService);
  private snackbar = inject(SnackbarNotification);
  private errorHandler = inject(ErrorMessageHandler);
  @Input() id!: number;
  filter = signal<DocumentQueryDTO>({ page: 1, limit: 10 });

  documentsPartialList = signal<DocumentExposedDTO[]>([]);
  paginationDocumentsInfo: Pagination = new Pagination(1, 10, 0, 1);
  currentPageReportTemplateDocuments: string = '';
  ref?: DynamicDialogRef | null;

  ngOnInit(): void {
    this.updateDocumentPaginationTranslation();
  }

  loadDocument(): void {
    try {
      this.documentsPartialList.set([]);
      this.documentService.getDocuments(this.id, this.filter()).subscribe({
        next: (response) => {
          if (response) {
            this.documentsPartialList.set(response.data as DocumentExposedDTO[]);
            this.paginationDocumentsInfo = response.pagination;
          } else {
            console.error('Error fetching documents partial list');
          }
        },
        error: (error: unknown) => {
          console.error('Error fetching documents partial list : ', error);
        },
      });
    } catch (e) {
      console.error('Error fetching partials documents ' + String(e));
    }
  }

  lazyLoadDocuments($event: TableLazyLoadEvent): void {
    const current: DocumentQueryDTO = { ...this.filter() };
    if ($event.first !== undefined && $event.rows !== undefined) {
      if ($event.rows) {
        current.page = $event.first / $event.rows + 1;
      } else {
        current.page = 1;
      }
    }
    if ($event.filters) {
      // Helper to safely extract value from PrimeNG filter structure
      const extractValue = (field: string): string | number | null => {
        const filterMeta = $event.filters?.[field];

        if (!filterMeta) return null;

        // Menu mode filters return an array of FilterMetadata
        if (Array.isArray(filterMeta)) {
          // We take the first constraint's value (since you hid operators)
          const firstConstraint = filterMeta[0] as FilterMetadata | undefined;
          return (firstConstraint?.value as string | number | null) ?? null;
        }
        // Row mode filters (if you ever switch) return a single object
        else {
          const meta = filterMeta as FilterMetadata | undefined;
          return (meta?.value as string | number | null) ?? null;
        }
      };

      // Map the specific fields from your HTML to your backend payload
      const fileName = extractValue('fileName');
      if (fileName) {
        current.file_name = fileName as string;
      } else {
        delete current.file_name;
      }

      const fileType = extractValue('fileType');
      if (fileType) {
        current.file_type = fileType as string;
      } else {
        delete current.file_type;
      }
    }
    this.filter.set(current);
    this.loadDocument();
  }

  updateDocumentPaginationTranslation(): void {
    this.translate
      .get('MEMBER.VIEW.DOCUMENTS.PAGE_REPORT_TEMPLATE_DOCUMENTS_LABEL', {
        page: this.paginationDocumentsInfo.page,
        total_pages: this.paginationDocumentsInfo.total_pages,
        total: this.paginationDocumentsInfo.total,
      })
      .subscribe((translatedText: string) => {
        this.currentPageReportTemplateDocuments = translatedText;
      });
  }

  clear(table: Table): void {
    table.clear();
    this.filter.set({ page: 1, limit: 10 });
  }

  onDownloadDocument(doc: DocumentExposedDTO): void {
    this.documentService.downloadDocument(this.id, doc.id).subscribe({
      next: (response) => {
        if (response) {
          // Check if the response contains the blob/filename object
          if ('blob' in response) {
            const url = window.URL.createObjectURL(response.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = response.filename; // Use the dynamic filename!
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
          } else {
            // This is the ApiResponse error case
            // this.errorHandler.handleError(response.data ? response.data : null);
          }
        }
      },
      error: (error) => {
        const errorData = error instanceof ApiResponse ? (error.data as string) : null;
        this.errorHandler.handleError(errorData);
      },
    });
  }

  deleteDocument(id: number): void {
    this.documentService.deleteDocument(id).subscribe((response) => {
      if (response) {
        this.loadDocument();
      }
    });
  }

  toAddDocument(): void {
    this.ref = this.dialogService.open(MemberAddDocument, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('MEMBER.VIEW.DOCUMENTS.ADD_DOCUMENT_HEADER') as string,
      data: {
        idMember: this.id,
      },
    });
    if (this.ref) {
      this.ref.onClose.subscribe((response) => {
        if (response) {
          this.translate
            .get('MEMBER.VIEW.DOCUMENTS.SUCCESS_ADDING_DOCUMENT_LABEL')
            .subscribe((translatedText: string) => {
              this.snackbar.openSnackBar(translatedText, VALIDATION_TYPE);
            });
          this.loadDocument();
        }
      });
    }
  }

  ngOnDestroy(): void {
    if (this.ref) {
      this.ref.destroy();
    }
  }
}
