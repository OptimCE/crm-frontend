import {Component, inject, Input, OnDestroy, OnInit, signal} from '@angular/core';
import { Button } from 'primeng/button';
import { Ripple } from 'primeng/ripple';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { SnackbarNotification } from '../../../../../../../shared/services-ui/snackbar.notifcation.service';
import {
  DocumentExposedDTO,
  DocumentQueryDTO,
} from '../../../../../../../shared/dtos/document.dtos';
import { Pagination } from '../../../../../../../core/dtos/api.response';
import { DocumentService } from '../../../../../../../shared/services/document.service';
import { MemberAddDocument } from '../../../../member-add-document/member-add-document';
import { VALIDATION_TYPE } from '../../../../../../../core/dtos/notification';
import { FilterMetadata } from 'primeng/api';

@Component({
  selector: 'app-member-view-documents-tab',
  imports: [Button, Ripple, TranslatePipe, TableModule],
  templateUrl: './member-view-documents-tab.html',
  styleUrl: './member-view-documents-tab.css',
  providers: [DialogService],
})
export class MemberViewDocumentsTab implements OnInit, OnDestroy {
  private documentService = inject(DocumentService);
  private translate = inject(TranslateService)
  private dialogService = inject(DialogService)
  private snackbar = inject(SnackbarNotification)
  @Input() id!: number;
  filter = signal<DocumentQueryDTO>({ page: 1, limit: 10 });

  documentsPartialList = signal<DocumentExposedDTO[]>([]);
  paginationDocumentsInfo: Pagination = new Pagination(1, 10, 0, 1);
  currentPageReportTemplateDocuments: string = '';
  ref?: DynamicDialogRef | null;

  ngOnInit() {
    this.updateDocumentPaginationTranslation();
  }

  loadDocument() {
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
        error: (error) => {
          console.error('Error fetching documents partial list : ', error);
        },
      });
    } catch (e) {
      console.error('Error fetching partials documents ' + e);
    }
  }

  lazyLoadDocuments($event: TableLazyLoadEvent) {
    const current: any = { ...this.filter() };
    if ($event.first !== undefined && $event.rows !== undefined) {
      if ($event.rows) {
        current.page = $event.first / $event.rows + 1;
      } else {
        current.page = 1;
      }
    }
    if ($event.filters) {
      // Helper to safely extract value from PrimeNG filter structure
      const extractValue = (field: string) => {
        const filterMeta = $event.filters![field];

        if (!filterMeta) return null;

        // Menu mode filters return an array of FilterMetadata
        if (Array.isArray(filterMeta)) {
          // We take the first constraint's value (since you hid operators)
          return filterMeta[0].value;
        }
        // Row mode filters (if you ever switch) return a single object
        else {
          return (filterMeta as FilterMetadata).value;
        }
      };

      // Map the specific fields from your HTML to your backend payload
      const fileName = extractValue('fileName');
      if (fileName) current.fileName = fileName;

      const fileType = extractValue('fileType');
      if (fileType) current.fileType = fileType;

      const fileSize = extractValue('fileSize');
      if (fileSize) current.fileSize = fileSize;

      const uploadDate = extractValue('uploadDate');
      if (uploadDate) current.uploadDate = uploadDate;
    }
    this.filter.set(current);
    this.loadDocument();
  }

  updateDocumentPaginationTranslation() {
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

  clear(table: any) {
    table.clear();
    this.filter.set({ page: 1, limit: 10 });
  }

  onDownloadDocument(doc: any) {
    this.documentService.downloadDocument(this.id, doc.id).subscribe((response) => {
      if (response) {
        const blob = new Blob([response], { type: doc.fileType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    });
  }

  deleteDocument(id: number) {
    this.documentService.deleteDocument(id).subscribe((response) => {
      if (response) {
        this.loadDocument();
      }
    });
  }

  toAddDocument() {
    this.ref = this.dialogService.open(MemberAddDocument, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('MEMBER.VIEW.DOCUMENTS.ADD_DOCUMENT_HEADER'),
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

  ngOnDestroy() {
    if (this.ref) {
      this.ref.destroy();
    }
  }
}
