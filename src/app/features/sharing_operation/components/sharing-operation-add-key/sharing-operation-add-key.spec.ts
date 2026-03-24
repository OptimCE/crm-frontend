import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Table, TableLazyLoadEvent, TablePageEvent } from 'primeng/table';

import { SharingOperationAddKey } from './sharing-operation-add-key';
import { KeyService } from '../../../../shared/services/key.service';
import { SharingOperationService } from '../../../../shared/services/sharing_operation.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { KeyPartialDTO } from '../../../../shared/dtos/key.dtos';
import { ApiResponse, ApiResponsePaginated, Pagination } from '../../../../core/dtos/api.response';

// ── Helpers ──────────────────────────────────────────────────────────

const fakeKeysList: KeyPartialDTO[] = [
  { id: 1, name: 'Key A', description: 'Description A' },
  { id: 2, name: 'Key B', description: 'Description B' },
];

function keysResponse(): ApiResponsePaginated<KeyPartialDTO[] | string> {
  return new ApiResponsePaginated(fakeKeysList, new Pagination(1, 10, 2, 1));
}

// ── Test Suite ───────────────────────────────────────────────────────

describe('SharingOperationAddKey', () => {
  let component: SharingOperationAddKey;
  let fixture: ComponentFixture<SharingOperationAddKey>;
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };
  let dialogConfigStub: { data: { id: number } };
  let keyServiceSpy: { getKeysList: ReturnType<typeof vi.fn> };
  let sharingOpServiceSpy: { addKeyToSharing: ReturnType<typeof vi.fn> };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    dialogRefSpy = { close: vi.fn() };
    dialogConfigStub = { data: { id: 42 } };
    keyServiceSpy = { getKeysList: vi.fn().mockReturnValue(of(keysResponse())) };
    sharingOpServiceSpy = { addKeyToSharing: vi.fn().mockReturnValue(of(new ApiResponse('ok'))) };
    errorHandlerSpy = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SharingOperationAddKey, TranslateModule.forRoot()],
      providers: [
        { provide: DynamicDialogRef, useValue: dialogRefSpy },
        { provide: DynamicDialogConfig, useValue: dialogConfigStub },
        { provide: KeyService, useValue: keyServiceSpy },
        { provide: SharingOperationService, useValue: sharingOpServiceSpy },
        { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(SharingOperationAddKey, {
        set: {
          template: '',
          providers: [{ provide: ErrorMessageHandler, useValue: errorHandlerSpy }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(SharingOperationAddKey);
    component = fixture.componentInstance;
  });

  // ── 1. Creation & initialization ──────────────────────────────────

  describe('initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should read the sharing operation id from dialog config', () => {
      expect(component.id).toBe(42);
    });

    it('should call updatePaginationTranslation on ngOnInit', () => {
      const spy = vi.spyOn(component, 'updatePaginationTranslation');
      component.ngOnInit();
      expect(spy).toHaveBeenCalled();
    });
  });

  // ── 2. Computed signals ───────────────────────────────────────────

  describe('computed signals', () => {
    it('should compute firstRow from paginated page and limit', () => {
      component['paginated'].set(new Pagination(3, 5, 25, 5));
      expect(component.firstRow()).toBe(10); // (3-1) * 5
    });

    it('should show paginator when total_pages > 1', () => {
      component['paginated'].set(new Pagination(1, 5, 15, 3));
      expect(component.showPaginator()).toBe(true);
    });

    it('should not show paginator when total_pages is 1', () => {
      component['paginated'].set(new Pagination(1, 5, 3, 1));
      expect(component.showPaginator()).toBe(false);
    });
  });

  // ── 3. loadKeys ───────────────────────────────────────────────────

  describe('loadKeys', () => {
    it('should set loading to true and call getKeysList', () => {
      component.loadKeys();
      expect(component.loading()).toBe(false); // false after subscribe completes
      expect(keyServiceSpy.getKeysList).toHaveBeenCalledWith({ page: 1, limit: 10 });
    });

    it('should populate keysList and paginated from response', () => {
      component.loadKeys();
      expect(component.keysList()).toEqual(fakeKeysList);
      expect(component.paginated().page).toBe(1);
      expect(component.paginated().total).toBe(2);
    });

    it('should not toggle loading when changeIsLoaded is false', () => {
      component.loading.set(false);
      component.loadKeys(undefined, false);
      expect(component.loading()).toBe(false);
    });

    it('should pass name filter from event filters', () => {
      const event: TableLazyLoadEvent = {
        filters: {
          nom: { value: 'search-name', matchMode: 'contains' },
        },
      };
      component.loadKeys(event);
      expect(keyServiceSpy.getKeysList).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        name: 'search-name',
      });
    });

    it('should pass description filter from event filters', () => {
      const event: TableLazyLoadEvent = {
        filters: {
          description: { value: 'search-desc', matchMode: 'contains' },
        },
      };
      component.loadKeys(event);
      expect(keyServiceSpy.getKeysList).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        description: 'search-desc',
      });
    });

    it('should handle array filters and use the first element', () => {
      const event: TableLazyLoadEvent = {
        filters: {
          nom: [{ value: 'array-name', matchMode: 'contains' }],
        },
      };
      component.loadKeys(event);
      expect(keyServiceSpy.getKeysList).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        name: 'array-name',
      });
    });

    it('should ignore filters with no value', () => {
      const event: TableLazyLoadEvent = {
        filters: {
          nom: { value: null, matchMode: 'contains' },
        },
      };
      component.loadKeys(event);
      expect(keyServiceSpy.getKeysList).toHaveBeenCalledWith({ page: 1, limit: 10 });
    });

    it('should call errorHandler when response is falsy', () => {
      keyServiceSpy.getKeysList.mockReturnValue(of(null));
      component.loadKeys();
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(null);
    });

    it('should call errorHandler on observable error', () => {
      keyServiceSpy.getKeysList.mockReturnValue(throwError(() => new Error('Network error')));
      component.loadKeys();
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });
  });

  // ── 4. updatePaginationTranslation ────────────────────────────────

  describe('updatePaginationTranslation', () => {
    it('should update currentPageReportTemplate signal', () => {
      const translateService = TestBed.inject(TranslateService);
      vi.spyOn(translateService, 'get').mockReturnValue(of('Page 1 of 1 (0 total)'));
      component.updatePaginationTranslation();
      expect(component.currentPageReportTemplate()).toBe('Page 1 of 1 (0 total)');
    });
  });

  // ── 5. pageChange ─────────────────────────────────────────────────

  describe('pageChange', () => {
    it('should update page signal and call loadKeys', () => {
      const loadKeysSpy = vi.spyOn(component, 'loadKeys');
      const event: TablePageEvent = { first: 10, rows: 5 };
      component.pageChange(event);
      expect(component.page()).toBe(3); // 10/5 + 1
      expect(loadKeysSpy).toHaveBeenCalled();
    });
  });

  // ── 6. clear ──────────────────────────────────────────────────────

  describe('clear', () => {
    it('should call table.clear()', () => {
      const clearFn = vi.fn();
      const mockTable = { clear: clearFn } as unknown as Table<KeyPartialDTO>;
      component.clear(mockTable);
      expect(clearFn).toHaveBeenCalled();
    });
  });

  // ── 7. addKey ─────────────────────────────────────────────────────

  describe('addKey', () => {
    it('should do nothing when no key is selected', () => {
      component.selectedKey.set(undefined);
      component.addKey();
      expect(sharingOpServiceSpy.addKeyToSharing).not.toHaveBeenCalled();
    });

    it('should call addKeyToSharing with correct ids and close dialog on success', () => {
      component.selectedKey.set(fakeKeysList[0]);
      component.addKey();
      expect(sharingOpServiceSpy.addKeyToSharing).toHaveBeenCalledWith({
        id_sharing: 42,
        id_key: 1,
      });
      expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
    });

    it('should call errorHandler when response is falsy', () => {
      sharingOpServiceSpy.addKeyToSharing.mockReturnValue(of(null));
      component.selectedKey.set(fakeKeysList[0]);
      component.addKey();
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });

    it('should call errorHandler with error data on observable error', () => {
      sharingOpServiceSpy.addKeyToSharing.mockReturnValue(
        throwError(() => ({ data: 'KEY_ALREADY_ASSIGNED' })),
      );
      component.selectedKey.set(fakeKeysList[0]);
      component.addKey();
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith('KEY_ALREADY_ASSIGNED');
    });

    it('should call errorHandler with null when error has no data', () => {
      sharingOpServiceSpy.addKeyToSharing.mockReturnValue(throwError(() => ({})));
      component.selectedKey.set(fakeKeysList[0]);
      component.addKey();
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(null);
    });
  });
});
