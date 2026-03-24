import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { DialogService } from 'primeng/dynamicdialog';
import { Table, TableLazyLoadEvent } from 'primeng/table';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { MemberViewDocumentsTab } from './member-view-documents-tab';
import {
  ApiResponse,
  ApiResponsePaginated,
  Pagination,
} from '../../../../../../../core/dtos/api.response';
import {
  DocumentExposedDTO,
  DocumentQueryDTO,
} from '../../../../../../../shared/dtos/document.dtos';
import { DocumentService } from '../../../../../../../shared/services/document.service';
import { ErrorMessageHandler } from '../../../../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../../../../shared/services-ui/snackbar.notifcation.service';

// ── Helpers ────────────────────────────────────────────────────────

function buildDocuments(): DocumentExposedDTO[] {
  return [
    {
      id: 1,
      file_name: 'contract.pdf',
      file_size: 1024,
      upload_date: new Date('2025-01-15'),
      file_type: 'application/pdf',
    },
    {
      id: 2,
      file_name: 'invoice.xlsx',
      file_size: 2048,
      upload_date: new Date('2025-02-20'),
      file_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  ];
}

function buildPaginatedDocumentResponse(
  data: DocumentExposedDTO[] = buildDocuments(),
  pagination: Pagination = new Pagination(1, 10, 2, 1),
): ApiResponsePaginated<DocumentExposedDTO[] | string> {
  return new ApiResponsePaginated(data, pagination);
}

// ── Test Suite ─────────────────────────────────────────────────────

describe('MemberViewDocumentsTab', () => {
  let component: MemberViewDocumentsTab;
  let fixture: ComponentFixture<MemberViewDocumentsTab>;

  let documentServiceSpy: {
    getDocuments: ReturnType<typeof vi.fn>;
    downloadDocument: ReturnType<typeof vi.fn>;
    deleteDocument: ReturnType<typeof vi.fn>;
  };
  let snackbarSpy: {
    openSnackBar: ReturnType<typeof vi.fn>;
  };
  let dialogServiceSpy: {
    open: ReturnType<typeof vi.fn>;
  };
  let errorHandlerSpy: {
    handleError: ReturnType<typeof vi.fn>;
  };

  async function createComponent(id: number = 1): Promise<void> {
    fixture = TestBed.createComponent(MemberViewDocumentsTab);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', id);
    component.ngOnInit();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    documentServiceSpy = {
      getDocuments: vi.fn().mockReturnValue(of(buildPaginatedDocumentResponse())),
      downloadDocument: vi.fn(),
      deleteDocument: vi.fn(),
    };
    snackbarSpy = { openSnackBar: vi.fn() };
    dialogServiceSpy = { open: vi.fn() };
    errorHandlerSpy = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [MemberViewDocumentsTab, TranslateModule.forRoot()],
      providers: [
        { provide: DocumentService, useValue: documentServiceSpy },
        { provide: SnackbarNotification, useValue: snackbarSpy },
      ],
    })
      .overrideComponent(MemberViewDocumentsTab, {
        remove: { providers: [DialogService, ErrorMessageHandler] },
        add: {
          providers: [
            { provide: DialogService, useValue: dialogServiceSpy },
            { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
          ],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();
  });

  // ── 1. Creation ─────────────────────────────────────────────────

  describe('creation', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should have default filter with page 1 and limit 10', () => {
      expect(component.filter().page).toBe(1);
      expect(component.filter().limit).toBe(10);
    });

    it('should have documents loaded after init (lazy load fires automatically)', () => {
      expect(component.documentsPartialList().length).toBe(2);
    });

    it('should have default search field set to file_name', () => {
      expect(component.searchField()).toBe('file_name');
    });

    it('should have default empty search text', () => {
      expect(component.searchText()).toBe('');
    });
  });

  // ── 2. ngOnInit ─────────────────────────────────────────────────

  describe('ngOnInit', () => {
    it('should set currentPageReportTemplate after init', async () => {
      await createComponent();
      expect(component.currentPageReportTemplate()).toBeTruthy();
    });
  });

  // ── 3. loadDocument ─────────────────────────────────────────────

  describe('loadDocument', () => {
    beforeEach(async () => {
      await createComponent();
      documentServiceSpy.getDocuments.mockClear();
    });

    it('should call documentService.getDocuments with id and current filter', () => {
      component.loadDocument();
      expect(documentServiceSpy.getDocuments).toHaveBeenCalledWith(1, component.filter());
    });

    it('should set documentsPartialList from response data', () => {
      const docs = buildDocuments();
      documentServiceSpy.getDocuments.mockReturnValue(of(buildPaginatedDocumentResponse(docs)));
      component.loadDocument();
      expect(component.documentsPartialList()).toEqual(docs);
    });

    it('should set paginationDocumentsInfo from response', () => {
      const pagination = new Pagination(2, 10, 25, 3);
      documentServiceSpy.getDocuments.mockReturnValue(
        of(buildPaginatedDocumentResponse(buildDocuments(), pagination)),
      );
      component.loadDocument();
      expect(component.paginationDocumentsInfo()).toEqual(pagination);
    });

    it('should call errorHandler when response is falsy', () => {
      documentServiceSpy.getDocuments.mockReturnValue(of(null));
      component.loadDocument();
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(null);
    });

    it('should call errorHandler on error', () => {
      const error = new Error('Network error');
      documentServiceSpy.getDocuments.mockReturnValue(throwError(() => error));
      component.loadDocument();
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(error);
    });
  });

  // ── 4. applyFilters ─────────────────────────────────────────────

  describe('applyFilters', () => {
    beforeEach(async () => {
      await createComponent();
      documentServiceSpy.getDocuments.mockClear();
    });

    it('should reset page to 1', () => {
      component.filter.set({ page: 3, limit: 10 });
      component.applyFilters();
      expect(component.filter().page).toBe(1);
    });

    it('should include file_name filter when searchField is file_name', () => {
      component.searchField.set('file_name');
      component.searchText.set('contract');
      component.applyFilters();
      expect(component.filter().file_name).toBe('contract');
    });

    it('should include file_type filter when searchField is file_type', () => {
      component.searchField.set('file_type');
      component.searchText.set('pdf');
      component.applyFilters();
      expect(component.filter().file_type).toBe('pdf');
    });

    it('should omit search fields when searchText is empty', () => {
      component.searchText.set('');
      component.applyFilters();
      expect(component.filter().file_name).toBeUndefined();
      expect(component.filter().file_type).toBeUndefined();
    });

    it('should call loadDocument', () => {
      component.applyFilters();
      expect(documentServiceSpy.getDocuments).toHaveBeenCalled();
    });
  });

  // ── 5. onSearchTextChange ───────────────────────────────────────

  describe('onSearchTextChange', () => {
    beforeEach(async () => {
      await createComponent();
      documentServiceSpy.getDocuments.mockClear();
    });

    it('should set searchText and trigger loadDocument', () => {
      component.onSearchTextChange('invoice');
      expect(component.searchText()).toBe('invoice');
      expect(documentServiceSpy.getDocuments).toHaveBeenCalled();
    });
  });

  // ── 6. onSearchFieldChange ──────────────────────────────────────

  describe('onSearchFieldChange', () => {
    beforeEach(async () => {
      await createComponent();
      documentServiceSpy.getDocuments.mockClear();
    });

    it('should trigger loadDocument when searchText is non-empty', () => {
      component.searchText.set('test');
      component.onSearchFieldChange();
      expect(documentServiceSpy.getDocuments).toHaveBeenCalled();
    });

    it('should not trigger loadDocument when searchText is empty', () => {
      component.searchText.set('');
      component.onSearchFieldChange();
      expect(documentServiceSpy.getDocuments).not.toHaveBeenCalled();
    });
  });

  // ── 7. lazyLoadDocuments ────────────────────────────────────────

  describe('lazyLoadDocuments', () => {
    beforeEach(async () => {
      await createComponent();
      documentServiceSpy.getDocuments.mockClear();
    });

    it('should compute correct page from event and call loadDocument', () => {
      component.lazyLoadDocuments({ first: 20, rows: 10 } as TableLazyLoadEvent);
      expect(component.filter().page).toBe(3);
      expect(documentServiceSpy.getDocuments).toHaveBeenCalled();
    });

    it('should default page to 1 when rows is 0', () => {
      component.lazyLoadDocuments({ first: 0, rows: 0 } as TableLazyLoadEvent);
      expect(component.filter().page).toBe(1);
    });

    it('should keep existing filter fields when paging', () => {
      component.filter.set({ page: 1, limit: 10, file_name: 'contract' } as DocumentQueryDTO);
      component.lazyLoadDocuments({ first: 10, rows: 10 } as TableLazyLoadEvent);
      expect(component.filter().file_name).toBe('contract');
      expect(component.filter().page).toBe(2);
    });
  });

  // ── 8. pageChange ───────────────────────────────────────────────

  describe('pageChange', () => {
    beforeEach(async () => {
      await createComponent();
      documentServiceSpy.getDocuments.mockClear();
    });

    it('should compute page from event and call loadDocument', () => {
      component.pageChange({ first: 10, rows: 10 });
      expect(component.filter().page).toBe(2);
      expect(documentServiceSpy.getDocuments).toHaveBeenCalled();
    });

    it('should set page to 1 when first is 0', () => {
      component.pageChange({ first: 0, rows: 10 });
      expect(component.filter().page).toBe(1);
    });
  });

  // ── 9. clear ────────────────────────────────────────────────────

  describe('clear', () => {
    beforeEach(async () => {
      await createComponent();
      documentServiceSpy.getDocuments.mockClear();
    });

    it('should call table.clear(), reset all filters and call loadDocument', () => {
      const mockTable = { clear: vi.fn() } as unknown as Table;

      // Set some filters first
      component.searchText.set('test');
      component.searchField.set('file_type');
      component.filter.set({ page: 3, limit: 10, file_type: 'pdf' });

      component.clear(mockTable);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockTable.clear).toHaveBeenCalled();
      expect(component.searchText()).toBe('');
      expect(component.searchField()).toBe('file_name');
      expect(component.filter()).toEqual({ page: 1, limit: 10 });
      expect(documentServiceSpy.getDocuments).toHaveBeenCalled();
    });
  });

  // ── 10. onDownloadDocument ──────────────────────────────────────

  describe('onDownloadDocument', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should create download link on success', () => {
      const blob = new Blob(['test'], { type: 'application/pdf' });
      documentServiceSpy.downloadDocument.mockReturnValue(of({ blob, filename: 'contract.pdf' }));

      const createObjectURLSpy = vi.fn().mockReturnValue('blob:test-url');
      const revokeObjectURLSpy = vi.fn();
      vi.stubGlobal('URL', {
        createObjectURL: createObjectURLSpy,
        revokeObjectURL: revokeObjectURLSpy,
      });

      const mockAnchor = { href: '', download: '', click: vi.fn() } as unknown as HTMLAnchorElement;
      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
      vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
      vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

      component.onDownloadDocument(buildDocuments()[0]);

      expect(createObjectURLSpy).toHaveBeenCalledWith(blob);
      expect(mockAnchor.download).toBe('contract.pdf');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test-url');

      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    it('should call errorHandler on error', () => {
      const apiError = new ApiResponse('Download failed', 500);
      documentServiceSpy.downloadDocument.mockReturnValue(throwError(() => apiError));

      component.onDownloadDocument(buildDocuments()[0]);

      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith('Download failed');
    });

    it('should call errorHandler with null for non-ApiResponse errors', () => {
      documentServiceSpy.downloadDocument.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      component.onDownloadDocument(buildDocuments()[0]);

      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(null);
    });
  });

  // ── 11. deleteDocument ──────────────────────────────────────────

  describe('deleteDocument', () => {
    beforeEach(async () => {
      await createComponent();
      documentServiceSpy.getDocuments.mockClear();
    });

    it('should reload documents on successful delete', () => {
      documentServiceSpy.deleteDocument.mockReturnValue(of(new ApiResponse('OK')));
      component.deleteDocument(1);
      expect(documentServiceSpy.deleteDocument).toHaveBeenCalledWith(1);
      expect(documentServiceSpy.getDocuments).toHaveBeenCalled();
    });

    it('should not reload documents when response is falsy', () => {
      documentServiceSpy.deleteDocument.mockReturnValue(of(null));
      component.deleteDocument(1);
      expect(documentServiceSpy.getDocuments).not.toHaveBeenCalled();
    });
  });

  // ── 12. toAddDocument ───────────────────────────────────────────

  describe('toAddDocument', () => {
    beforeEach(async () => {
      await createComponent();
      documentServiceSpy.getDocuments.mockClear();
    });

    it('should open dialog with correct config', () => {
      const onCloseSubject = new Subject<unknown>();
      dialogServiceSpy.open.mockReturnValue({
        onClose: onCloseSubject.asObservable(),
        destroy: vi.fn(),
      });

      component.toAddDocument();

      expect(dialogServiceSpy.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          modal: true,
          closable: true,
          closeOnEscape: true,
          data: { idMember: 1 },
        }),
      );
    });

    it('should call snackbar and reload documents when dialog closes with response', () => {
      const onCloseSubject = new Subject<unknown>();
      dialogServiceSpy.open.mockReturnValue({
        onClose: onCloseSubject.asObservable(),
        destroy: vi.fn(),
      });

      component.toAddDocument();
      onCloseSubject.next(true);

      expect(snackbarSpy.openSnackBar).toHaveBeenCalled();
      expect(documentServiceSpy.getDocuments).toHaveBeenCalled();
    });

    it('should not reload documents when dialog closes without response', () => {
      const onCloseSubject = new Subject<unknown>();
      dialogServiceSpy.open.mockReturnValue({
        onClose: onCloseSubject.asObservable(),
        destroy: vi.fn(),
      });

      component.toAddDocument();
      onCloseSubject.next(undefined);

      expect(snackbarSpy.openSnackBar).not.toHaveBeenCalled();
      expect(documentServiceSpy.getDocuments).not.toHaveBeenCalled();
    });
  });

  // ── 13. Computed signals ────────────────────────────────────────

  describe('computed signals', () => {
    beforeEach(async () => {
      await createComponent();
    });

    describe('firstRow', () => {
      it('should compute (page - 1) * limit', () => {
        component.paginationDocumentsInfo.set(new Pagination(3, 10, 30, 3));
        expect(component.firstRow()).toBe(20);
      });

      it('should be 0 when page is 1', () => {
        component.paginationDocumentsInfo.set(new Pagination(1, 10, 5, 1));
        expect(component.firstRow()).toBe(0);
      });
    });

    describe('showPaginator', () => {
      it('should be true when total_pages > 1', () => {
        component.paginationDocumentsInfo.set(new Pagination(1, 10, 25, 3));
        expect(component.showPaginator()).toBe(true);
      });

      it('should be false when total_pages is 1', () => {
        component.paginationDocumentsInfo.set(new Pagination(1, 10, 5, 1));
        expect(component.showPaginator()).toBe(false);
      });
    });

    describe('hasActiveFilters', () => {
      it('should be true when searchText is set', () => {
        component.searchText.set('test');
        expect(component.hasActiveFilters()).toBe(true);
      });

      it('should be false when searchText is empty', () => {
        component.searchText.set('');
        expect(component.hasActiveFilters()).toBe(false);
      });
    });
  });
});
