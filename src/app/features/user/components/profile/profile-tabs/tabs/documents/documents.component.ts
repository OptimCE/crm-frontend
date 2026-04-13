import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Table, TableLazyLoadEvent, TableModule, TablePageEvent } from 'primeng/table';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { InputGroup } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { MeService } from '../../../../../../../shared/services/me.service';
import { MeDocumentDTO, MeDocumentPartialQuery } from '../../../../../../../shared/dtos/me.dtos';
import { ApiResponse, Pagination } from '../../../../../../../core/dtos/api.response';
import { downloadFromUrl } from '../../../../../../../shared/utils/download.utils';
import { ErrorMessageHandler } from '../../../../../../../shared/services-ui/error.message.handler';
import { DebouncedPInputComponent } from '../../../../../../../shared/components/debounced-p-input/debounced-p-input.component';

@Component({
  selector: 'app-documents-user',
  imports: [
    TranslatePipe,
    TableModule,
    Button,
    Select,
    FormsModule,
    InputGroup,
    InputGroupAddonModule,
    DebouncedPInputComponent,
  ],
  templateUrl: './documents.component.html',
  styleUrl: './documents.component.css',
  providers: [ErrorMessageHandler],
})
export class DocumentsComponent {
  private meService = inject(MeService);
  private errorHandler = inject(ErrorMessageHandler);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  readonly documentsPartialList = signal<MeDocumentDTO[]>([]);
  readonly filter = signal<MeDocumentPartialQuery>({ page: 1, limit: 10 });
  readonly paginationInfo = signal<Pagination>(new Pagination(1, 10, 0, 1));
  readonly currentPageReportTemplate = signal<string>('');
  readonly firstRow = computed(
    () => (this.paginationInfo().page - 1) * this.paginationInfo().limit,
  );
  readonly showPaginator = computed(() => this.paginationInfo().total_pages > 1);

  readonly searchField = signal<string>('community_name');
  readonly searchText = signal<string>('');
  readonly hasActiveFilters = computed(() => !!this.searchText());

  searchFieldOptions = [
    { label: 'PROFILE.DOCUMENTS.COMMUNITY_LABEL', value: 'community_name' },
    { label: 'PROFILE.DOCUMENTS.NAME_LABEL', value: 'file_name' },
    { label: 'PROFILE.DOCUMENTS.TYPE_LABEL', value: 'file_type' },
  ];

  constructor() {
    this.updatePaginationTranslation();
  }

  updatePaginationTranslation(): void {
    this.translate
      .get('PROFILE.DOCUMENTS.PAGE_REPORT_TEMPLATE_LABEL', {
        page: this.paginationInfo().page,
        total_pages: this.paginationInfo().total_pages,
        total: this.paginationInfo().total,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translatedText: string) => {
        this.currentPageReportTemplate.set(translatedText);
      });
  }

  applyFilters(): void {
    const current: MeDocumentPartialQuery = { page: 1, limit: this.filter().limit };

    const text = this.searchText();
    if (text) {
      const field = this.searchField();
      if (field === 'community_name') current.community_name = text;
      else if (field === 'file_name') current.file_name = text;
      else if (field === 'file_type') current.file_type = text;
    }

    this.filter.set(current);
    this.loadDocuments();
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

  loadDocuments(): void {
    this.meService
      .getDocuments(this.filter())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response) {
            this.documentsPartialList.set(response.data as MeDocumentDTO[]);
            this.paginationInfo.set(response.pagination);
            this.updatePaginationTranslation();
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
    const current: MeDocumentPartialQuery = { ...this.filter() };

    if ($event.first !== undefined && $event.rows !== undefined) {
      if ($event.rows) {
        current.page = $event.first / $event.rows + 1;
      } else {
        current.page = 1;
      }
    }

    this.filter.set(current);
    this.loadDocuments();
  }

  pageChange($event: TablePageEvent): void {
    const current: MeDocumentPartialQuery = { ...this.filter() };
    current.page = ($event.first ?? 0) / ($event.rows ?? 10) + 1;
    this.filter.set(current);
    this.loadDocuments();
  }

  clear(table: Table): void {
    table.clear();
    this.searchText.set('');
    this.searchField.set('community_name');
    this.filter.set({ page: 1, limit: 10 });
    this.loadDocuments();
  }

  onDownloadDocument(doc: MeDocumentDTO): void {
    this.meService
      .getDocumentById(doc.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          downloadFromUrl(response.data.url, response.data.fileName);
        },
        error: (error) => {
          const errorData = error instanceof ApiResponse ? (error.data as string) : null;
          this.errorHandler.handleError(errorData);
        },
      });
  }
}
