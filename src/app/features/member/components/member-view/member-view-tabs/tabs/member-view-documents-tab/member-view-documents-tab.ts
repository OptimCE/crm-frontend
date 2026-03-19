import { Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Table, TableLazyLoadEvent, TableModule, TablePageEvent } from 'primeng/table';
import { Select } from 'primeng/select';
import { InputGroup } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
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
import { ErrorMessageHandler } from '../../../../../../../shared/services-ui/error.message.handler';
import { DebouncedPInputComponent } from '../../../../../../../shared/components/debounced-p-input/debounced-p-input.component';

@Component({
  selector: 'app-member-view-documents-tab',
  imports: [
    Button,
    TranslatePipe,
    TableModule,
    Select,
    FormsModule,
    InputGroup,
    InputGroupAddonModule,
    DebouncedPInputComponent,
  ],
  templateUrl: './member-view-documents-tab.html',
  styleUrl: './member-view-documents-tab.css',
  providers: [DialogService, ErrorMessageHandler],
})
export class MemberViewDocumentsTab implements OnInit {
  private documentService = inject(DocumentService);
  private translate = inject(TranslateService);
  private dialogService = inject(DialogService);
  private snackbar = inject(SnackbarNotification);
  private errorHandler = inject(ErrorMessageHandler);
  private destroyRef = inject(DestroyRef);
  readonly id = input.required<number>();

  readonly filter = signal<DocumentQueryDTO>({ page: 1, limit: 10 });
  readonly documentsPartialList = signal<DocumentExposedDTO[]>([]);
  readonly paginationDocumentsInfo = signal<Pagination>(new Pagination(1, 10, 0, 1));
  readonly currentPageReportTemplate = signal<string>('');
  ref?: DynamicDialogRef | null;

  // Signal-based filter state
  readonly searchField = signal<string>('file_name');
  readonly searchText = signal<string>('');
  readonly hasActiveFilters = computed(() => !!this.searchText());

  searchFieldOptions = [
    { label: 'MEMBER.VIEW.DOCUMENTS.NAME_LABEL', value: 'file_name' },
    { label: 'MEMBER.VIEW.DOCUMENTS.TYPE_LABEL', value: 'file_type' },
  ];

  // Pagination computed signals
  readonly firstRow = computed(
    () => (this.paginationDocumentsInfo().page - 1) * this.paginationDocumentsInfo().limit,
  );
  readonly showPaginator = computed(() => this.paginationDocumentsInfo().total_pages > 1);

  constructor() {
    this.destroyRef.onDestroy(() => this.ref?.destroy());
  }

  ngOnInit(): void {
    this.updateDocumentPaginationTranslation();
  }

  applyFilters(): void {
    const current: DocumentQueryDTO = { page: 1, limit: this.filter().limit };

    const text = this.searchText();
    if (text) {
      const field = this.searchField();
      if (field === 'file_name') current.file_name = text;
      else if (field === 'file_type') current.file_type = text;
    }

    this.filter.set(current);
    this.loadDocument();
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

  loadDocument(): void {
    this.documentService
      .getDocuments(this.id(), this.filter())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response) {
            this.documentsPartialList.set(response.data as DocumentExposedDTO[]);
            this.paginationDocumentsInfo.set(response.pagination);
            this.updateDocumentPaginationTranslation();
          } else {
            this.errorHandler.handleError(response);
          }
        },
        error: (error) => {
          this.errorHandler.handleError(error);
        },
      });
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

    this.filter.set(current);
    this.loadDocument();
  }

  pageChange($event: TablePageEvent): void {
    const current: DocumentQueryDTO = { ...this.filter() };
    current.page = ($event.first ?? 0) / ($event.rows ?? 10) + 1;
    this.filter.set(current);
    this.loadDocument();
  }

  updateDocumentPaginationTranslation(): void {
    this.translate
      .get('MEMBER.VIEW.DOCUMENTS.PAGE_REPORT_TEMPLATE_DOCUMENTS_LABEL', {
        page: this.paginationDocumentsInfo().page,
        total_pages: this.paginationDocumentsInfo().total_pages,
        total: this.paginationDocumentsInfo().total,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translatedText: string) => {
        this.currentPageReportTemplate.set(translatedText);
      });
  }

  clear(table: Table): void {
    table.clear();
    this.searchText.set('');
    this.searchField.set('file_name');
    this.filter.set({ page: 1, limit: 10 });
    this.loadDocument();
  }

  onDownloadDocument(doc: DocumentExposedDTO): void {
    this.documentService
      .downloadDocument(this.id(), doc.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response && 'blob' in response) {
            const url = window.URL.createObjectURL(response.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = response.filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
          }
        },
        error: (error) => {
          const errorData = error instanceof ApiResponse ? (error.data as string) : null;
          this.errorHandler.handleError(errorData);
        },
      });
  }

  deleteDocument(id: number): void {
    this.documentService
      .deleteDocument(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => {
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
        idMember: this.id(),
      },
    });
    if (this.ref) {
      this.ref.onClose.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((response) => {
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
}
