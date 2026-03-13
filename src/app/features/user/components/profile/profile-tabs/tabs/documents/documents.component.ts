import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Table, TableLazyLoadEvent, TableModule } from 'primeng/table';
import { Button } from 'primeng/button';
import { FilterMetadata } from 'primeng/api';
import { MeService } from '../../../../../../../shared/services/me.service';
import { MeDocumentDTO, MeDocumentPartialQuery } from '../../../../../../../shared/dtos/me.dtos';
import { ApiResponse, Pagination } from '../../../../../../../core/dtos/api.response';
import { ErrorMessageHandler } from '../../../../../../../shared/services-ui/error.message.handler';

@Component({
  selector: 'app-documents-user',
  imports: [TranslatePipe, TableModule, Button],
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

    if ($event.filters) {
      const extractValue = (field: string): string | null => {
        const filterMeta = $event.filters?.[field];
        if (!filterMeta) return null;
        if (Array.isArray(filterMeta)) {
          const firstConstraint = filterMeta[0] as FilterMetadata | undefined;
          return (firstConstraint?.value as string | null) ?? null;
        } else {
          return (filterMeta?.value as string | null) ?? null;
        }
      };

      const fileName = extractValue('fileName');
      if (fileName) {
        current.file_name = fileName;
      } else {
        delete current.file_name;
      }

      const fileType = extractValue('fileType');
      if (fileType) {
        current.file_type = fileType;
      } else {
        delete current.file_type;
      }
    }

    this.filter.set(current);
    this.loadDocuments();
  }

  clear(table: Table): void {
    table.clear();
    this.filter.set({ page: 1, limit: 10 });
  }

  onDownloadDocument(doc: MeDocumentDTO): void {
    this.meService
      .getDocumentById(doc.id)
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
}
