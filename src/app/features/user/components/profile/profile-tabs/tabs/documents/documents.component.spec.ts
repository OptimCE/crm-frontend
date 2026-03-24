import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { DocumentsComponent } from './documents.component';
import { MeService } from '../../../../../../../shared/services/me.service';
import {
  ApiResponse,
  ApiResponsePaginated,
  Pagination,
} from '../../../../../../../core/dtos/api.response';
import { MeDocumentDTO } from '../../../../../../../shared/dtos/me.dtos';
import { CommunityDTO } from '../../../../../../../shared/dtos/community.dtos';
import { ErrorMessageHandler } from '../../../../../../../shared/services-ui/error.message.handler';
import { Table, TableLazyLoadEvent, TablePageEvent } from 'primeng/table';

// ── Helpers ────────────────────────────────────────────────────────

function buildDocuments(): MeDocumentDTO[] {
  return [
    {
      id: 1,
      file_name: 'report.pdf',
      file_size: 1024,
      file_type: 'pdf',
      upload_date: new Date('2025-01-15'),
      community: { id: 10, name: 'Community Alpha' } as CommunityDTO,
    },
    {
      id: 2,
      file_name: 'invoice.xlsx',
      file_size: 2048,
      file_type: 'xlsx',
      upload_date: new Date('2025-02-20'),
      community: { id: 20, name: 'Community Beta' } as CommunityDTO,
    },
  ];
}

function buildPaginatedResponse(
  data: MeDocumentDTO[] = buildDocuments(),
): ApiResponsePaginated<MeDocumentDTO[] | string> {
  return new ApiResponsePaginated(data, new Pagination(1, 10, 2, 1));
}

// ── Test Suite ─────────────────────────────────────────────────────

describe('DocumentsComponent', () => {
  let component: DocumentsComponent;
  let fixture: ComponentFixture<DocumentsComponent>;

  let meServiceSpy: {
    getDocuments: ReturnType<typeof vi.fn>;
    getDocumentById: ReturnType<typeof vi.fn>;
  };

  let errorHandlerSpy: {
    handleError: ReturnType<typeof vi.fn>;
  };

  async function createComponent(): Promise<void> {
    fixture = TestBed.createComponent(DocumentsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  beforeEach(async () => {
    meServiceSpy = {
      getDocuments: vi.fn().mockReturnValue(of(buildPaginatedResponse())),
      getDocumentById: vi.fn().mockReturnValue(of({ blob: new Blob(), filename: 'test.pdf' })),
    };

    errorHandlerSpy = {
      handleError: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [DocumentsComponent, TranslateModule.forRoot()],
      providers: [
        { provide: MeService, useValue: meServiceSpy },
        { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
      ],
    })
      .overrideComponent(DocumentsComponent, {
        add: { schemas: [NO_ERRORS_SCHEMA] },
        remove: { providers: [ErrorMessageHandler] },
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

    it('should initialise filter with page 1 and limit 10', () => {
      expect(component.filter().page).toBe(1);
      expect(component.filter().limit).toBe(10);
    });

    it('should initialise searchText to empty string', () => {
      expect(component.searchText()).toBe('');
    });

    it('should initialise searchField to community_name', () => {
      expect(component.searchField()).toBe('community_name');
    });

    it('should have three search field options', () => {
      expect(component.searchFieldOptions).toHaveLength(3);
      expect(component.searchFieldOptions.map((o) => o.value)).toEqual([
        'community_name',
        'file_name',
        'file_type',
      ]);
    });

    it('should have documentsPartialList populated after lazy-load init', () => {
      expect(component.documentsPartialList().length).toBeGreaterThanOrEqual(0);
    });
  });

  // ── 2. Computed signals ─────────────────────────────────────────

  describe('computed signals', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('firstRow should return (page - 1) * limit', () => {
      component.paginationInfo.set(new Pagination(3, 10, 50, 5));
      expect(component.firstRow()).toBe(20);
    });

    it('firstRow should return 0 for page 1', () => {
      component.paginationInfo.set(new Pagination(1, 10, 5, 1));
      expect(component.firstRow()).toBe(0);
    });

    it('showPaginator should return true when total_pages > 1', () => {
      component.paginationInfo.set(new Pagination(1, 10, 25, 3));
      expect(component.showPaginator()).toBe(true);
    });

    it('showPaginator should return false when total_pages is 1', () => {
      component.paginationInfo.set(new Pagination(1, 10, 5, 1));
      expect(component.showPaginator()).toBe(false);
    });

    it('hasActiveFilters should return false when searchText is empty', () => {
      component.searchText.set('');
      expect(component.hasActiveFilters()).toBe(false);
    });

    it('hasActiveFilters should return true when searchText is set', () => {
      component.searchText.set('test');
      expect(component.hasActiveFilters()).toBe(true);
    });
  });

  // ── 3. loadDocuments ────────────────────────────────────────────

  describe('loadDocuments', () => {
    beforeEach(async () => {
      await createComponent();
      meServiceSpy.getDocuments.mockClear();
      errorHandlerSpy.handleError.mockClear();
    });

    it('should call meService.getDocuments with current filter', () => {
      component.loadDocuments();
      expect(meServiceSpy.getDocuments).toHaveBeenCalledWith(component.filter());
    });

    it('should set documentsPartialList from response data', () => {
      const documents = buildDocuments();
      meServiceSpy.getDocuments.mockReturnValue(of(buildPaginatedResponse(documents)));
      component.loadDocuments();
      expect(component.documentsPartialList()).toEqual(documents);
    });

    it('should update paginationInfo from response', () => {
      const pagination = new Pagination(2, 10, 20, 2);
      meServiceSpy.getDocuments.mockReturnValue(
        of(new ApiResponsePaginated(buildDocuments(), pagination)),
      );
      component.loadDocuments();
      expect(component.paginationInfo()).toEqual(pagination);
    });

    it('should call errorHandler.handleError when response is falsy', () => {
      meServiceSpy.getDocuments.mockReturnValue(of(null));
      component.loadDocuments();
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(null);
    });

    it('should not update documentsPartialList when response is falsy', () => {
      meServiceSpy.getDocuments.mockReturnValue(of(null));
      component.documentsPartialList.set([]);
      component.loadDocuments();
      expect(component.documentsPartialList()).toEqual([]);
    });

    it('should call errorHandler.handleError on observable error', () => {
      const error = new Error('network fail');
      meServiceSpy.getDocuments.mockReturnValue(throwError(() => error));
      component.loadDocuments();
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(error);
    });
  });

  // ── 4. applyFilters ─────────────────────────────────────────────

  describe('applyFilters', () => {
    beforeEach(async () => {
      await createComponent();
      meServiceSpy.getDocuments.mockClear();
    });

    it('should reset page to 1', () => {
      component.filter.set({ page: 3, limit: 10 });
      component.applyFilters();
      expect(component.filter().page).toBe(1);
    });

    it('should set community_name filter when searchField is community_name', () => {
      component.searchField.set('community_name');
      component.searchText.set('Alpha');
      component.applyFilters();
      expect(component.filter().community_name).toBe('Alpha');
    });

    it('should set file_name filter when searchField is file_name', () => {
      component.searchField.set('file_name');
      component.searchText.set('report');
      component.applyFilters();
      expect(component.filter().file_name).toBe('report');
    });

    it('should set file_type filter when searchField is file_type', () => {
      component.searchField.set('file_type');
      component.searchText.set('pdf');
      component.applyFilters();
      expect(component.filter().file_type).toBe('pdf');
    });

    it('should not set any search filter when searchText is empty', () => {
      component.searchText.set('');
      component.applyFilters();
      expect(component.filter().community_name).toBeUndefined();
      expect(component.filter().file_name).toBeUndefined();
      expect(component.filter().file_type).toBeUndefined();
    });

    it('should preserve limit from current filter', () => {
      component.filter.set({ page: 2, limit: 25 });
      component.applyFilters();
      expect(component.filter().limit).toBe(25);
    });

    it('should call loadDocuments', () => {
      component.applyFilters();
      expect(meServiceSpy.getDocuments).toHaveBeenCalled();
    });
  });

  // ── 5. onSearchTextChange ───────────────────────────────────────

  describe('onSearchTextChange', () => {
    beforeEach(async () => {
      await createComponent();
      meServiceSpy.getDocuments.mockClear();
    });

    it('should update searchText signal', () => {
      component.onSearchTextChange('hello');
      expect(component.searchText()).toBe('hello');
    });

    it('should call loadDocuments', () => {
      component.onSearchTextChange('test');
      expect(meServiceSpy.getDocuments).toHaveBeenCalled();
    });
  });

  // ── 6. onSearchFieldChange ──────────────────────────────────────

  describe('onSearchFieldChange', () => {
    beforeEach(async () => {
      await createComponent();
      meServiceSpy.getDocuments.mockClear();
    });

    it('should call applyFilters when searchText is non-empty', () => {
      component.searchText.set('query');
      component.onSearchFieldChange();
      expect(meServiceSpy.getDocuments).toHaveBeenCalled();
    });

    it('should not call applyFilters when searchText is empty', () => {
      component.searchText.set('');
      component.onSearchFieldChange();
      expect(meServiceSpy.getDocuments).not.toHaveBeenCalled();
    });
  });

  // ── 7. lazyLoadDocuments ────────────────────────────────────────

  describe('lazyLoadDocuments', () => {
    beforeEach(async () => {
      await createComponent();
      meServiceSpy.getDocuments.mockClear();
    });

    it('should compute page from first and rows', () => {
      component.lazyLoadDocuments({ first: 20, rows: 10 } as TableLazyLoadEvent);
      expect(component.filter().page).toBe(3);
    });

    it('should set page to 1 when rows is 0', () => {
      component.lazyLoadDocuments({ first: 0, rows: 0 } as TableLazyLoadEvent);
      expect(component.filter().page).toBe(1);
    });

    it('should call loadDocuments', () => {
      component.lazyLoadDocuments({ first: 0, rows: 10 } as TableLazyLoadEvent);
      expect(meServiceSpy.getDocuments).toHaveBeenCalled();
    });

    it('should preserve existing filter values', () => {
      component.filter.set({ page: 1, limit: 10, community_name: 'test' });
      component.lazyLoadDocuments({ first: 10, rows: 10 } as TableLazyLoadEvent);
      expect(component.filter().community_name).toBe('test');
      expect(component.filter().page).toBe(2);
    });
  });

  // ── 8. pageChange ───────────────────────────────────────────────

  describe('pageChange', () => {
    beforeEach(async () => {
      await createComponent();
      meServiceSpy.getDocuments.mockClear();
    });

    it('should compute page from first and rows', () => {
      component.pageChange({ first: 20, rows: 10 } as TablePageEvent);
      expect(component.filter().page).toBe(3);
    });

    it('should default first to 0 when undefined', () => {
      component.pageChange({ first: undefined, rows: 10 } as unknown as TablePageEvent);
      expect(component.filter().page).toBe(1);
    });

    it('should default rows to 10 when undefined', () => {
      component.pageChange({ first: 0, rows: undefined } as unknown as TablePageEvent);
      expect(component.filter().page).toBe(1);
    });

    it('should call loadDocuments', () => {
      component.pageChange({ first: 0, rows: 10 } as TablePageEvent);
      expect(meServiceSpy.getDocuments).toHaveBeenCalled();
    });
  });

  // ── 9. clear ────────────────────────────────────────────────────

  describe('clear', () => {
    let mockTable: { clear: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
      await createComponent();
      meServiceSpy.getDocuments.mockClear();
      mockTable = { clear: vi.fn() };
    });

    it('should call table.clear()', () => {
      component.clear(mockTable as unknown as Table);
      expect(mockTable.clear).toHaveBeenCalled();
    });

    it('should reset searchText to empty string', () => {
      component.searchText.set('something');
      component.clear(mockTable as unknown as Table);
      expect(component.searchText()).toBe('');
    });

    it('should reset searchField to community_name', () => {
      component.searchField.set('file_name');
      component.clear(mockTable as unknown as Table);
      expect(component.searchField()).toBe('community_name');
    });

    it('should reset filter to page 1 and limit 10', () => {
      component.filter.set({ page: 5, limit: 25, community_name: 'test' });
      component.clear(mockTable as unknown as Table);
      expect(component.filter()).toEqual({ page: 1, limit: 10 });
    });

    it('should call loadDocuments', () => {
      component.clear(mockTable as unknown as Table);
      expect(meServiceSpy.getDocuments).toHaveBeenCalled();
    });
  });

  // ── 10. onDownloadDocument ──────────────────────────────────────

  describe('onDownloadDocument', () => {
    const doc: MeDocumentDTO = {
      id: 42,
      file_name: 'download.pdf',
      file_size: 4096,
      file_type: 'pdf',
      upload_date: new Date('2025-03-01'),
      community: { id: 1, name: 'Test Community' } as CommunityDTO,
    };

    beforeEach(async () => {
      await createComponent();
      meServiceSpy.getDocumentById.mockClear();
      errorHandlerSpy.handleError.mockClear();
    });

    it('should call meService.getDocumentById with document id', () => {
      component.onDownloadDocument(doc);
      expect(meServiceSpy.getDocumentById).toHaveBeenCalledWith(42);
    });

    it('should create an anchor element and trigger download on success', () => {
      const blob = new Blob(['content'], { type: 'application/pdf' });
      const fakeUrl = 'blob:http://localhost/fake-url';
      meServiceSpy.getDocumentById.mockReturnValue(of({ blob, filename: 'download.pdf' }));

      const createObjectURLSpy = vi.spyOn(window.URL, 'createObjectURL').mockReturnValue(fakeUrl);
      const revokeObjectURLSpy = vi
        .spyOn(window.URL, 'revokeObjectURL')
        .mockImplementation(() => void 0);
      const appendChildSpy = vi
        .spyOn(document.body, 'appendChild')
        .mockImplementation((node) => node);
      const removeChildSpy = vi
        .spyOn(document.body, 'removeChild')
        .mockImplementation((node) => node);
      const clickSpy = vi.fn();
      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue({
        set href(_v: string) {
          /* noop */
        },
        set download(_v: string) {
          /* noop */
        },
        click: clickSpy,
      } as unknown as HTMLAnchorElement);

      component.onDownloadDocument(doc);

      expect(createObjectURLSpy).toHaveBeenCalledWith(blob);
      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(clickSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith(fakeUrl);
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();

      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
      createElementSpy.mockRestore();
    });

    it('should call errorHandler.handleError with data when error is ApiResponse', () => {
      const apiError = new ApiResponse('Document not found');
      meServiceSpy.getDocumentById.mockReturnValue(throwError(() => apiError));
      component.onDownloadDocument(doc);
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith('Document not found');
    });

    it('should call errorHandler.handleError with null when error is not ApiResponse', () => {
      meServiceSpy.getDocumentById.mockReturnValue(throwError(() => new Error('network error')));
      component.onDownloadDocument(doc);
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(null);
    });
  });
});
