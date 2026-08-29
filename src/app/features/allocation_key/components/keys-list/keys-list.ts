import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Toast } from 'primeng/toast';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Table, TableLazyLoadEvent, TableModule, TablePageEvent } from 'primeng/table';
import { KeyService } from '../../../../shared/services/key.service';
import { Router, RouterLink } from '@angular/router';
import { ApiResponse, Pagination } from '../../../../core/dtos/api.response';
import { KeyPartialDTO, KeyPartialQuery } from '../../../../shared/dtos/key.dtos';
import { Button } from 'primeng/button';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { HeaderPage } from '../../../../layout/header-page/header-page';
import { InputGroup } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { Select } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { DebouncedPInputComponent } from '../../../../shared/components/debounced-p-input/debounced-p-input.component';
import { DialogService } from 'primeng/dynamicdialog';
import {
  KeyCreationMode,
  KeyCreationModeDialog,
} from '../../../../shared/components/key-creation-mode-dialog/key-creation-mode-dialog';

@Component({
  selector: 'app-keys-list',
  standalone: true,
  imports: [
    Toast,
    TranslatePipe,
    TableModule,
    Button,
    RouterLink,
    HeaderPage,
    InputGroup,
    InputGroupAddonModule,
    Select,
    FormsModule,
    DebouncedPInputComponent,
  ],
  templateUrl: './keys-list.html',
  styleUrl: './keys-list.css',
  providers: [DialogService],
})
export class KeysList {
  private keyService = inject(KeyService);
  private translate = inject(TranslateService);
  private errorHandler = inject(ErrorMessageHandler);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private dialogService = inject(DialogService);

  readonly keysList = signal<KeyPartialDTO[]>([]);
  readonly loading = signal<boolean>(true);
  readonly paginated = signal<Pagination>(new Pagination(0, 5, 0, 0));
  readonly filter = signal<KeyPartialQuery>({ page: 1, limit: 10 });
  readonly currentPageReportTemplate = signal<string>('');

  readonly searchField = signal<string>('name');
  readonly searchText = signal<string>('');
  readonly hasActiveFilters = computed(() => !!this.searchText());
  readonly firstRow = computed(() => (this.paginated().page - 1) * this.paginated().limit);
  readonly showPaginator = computed(() => this.paginated().total_pages > 1);

  searchFieldOptions = [
    { label: 'KEY.LIST.NAME_LABEL', value: 'name' },
    { label: 'KEY.LIST.DESCRIPTION_LABEL', value: 'description' },
  ];

  lazy = true;

  constructor() {
    this.updatePaginationTranslation();
  }

  loadKeys(): void {
    this.loading.set(true);
    this.keyService
      .getKeysList(this.filter())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response && response.data) {
            this.keysList.set(response.data as KeyPartialDTO[]);
            this.paginated.set(response.pagination);
            this.updatePaginationTranslation();
          } else {
            this.errorHandler.handleError();
          }
          this.loading.set(false);
        },
        error: (error: unknown) => {
          const errorData = error instanceof ApiResponse ? (error.data as string) : null;
          this.errorHandler.handleError(errorData);
          this.loading.set(false);
        },
      });
  }

  lazyLoadKeys($event: TableLazyLoadEvent): void {
    const current: KeyPartialQuery = { ...this.filter() };
    if ($event.first !== undefined && $event.rows !== undefined) {
      current.page = $event.rows ? $event.first / $event.rows + 1 : 1;
    }
    if (current.page < 1) {
      current.page = 1;
    }
    this.filter.set(current);
    this.loadKeys();
  }

  applyFilters(): void {
    const current: KeyPartialQuery = { page: 1, limit: this.filter().limit };
    const text = this.searchText();
    if (text) {
      const field = this.searchField();
      if (field === 'name') current.name = text;
      else if (field === 'description') current.description = text;
    }
    this.filter.set(current);
    this.loadKeys();
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

  updatePaginationTranslation(): void {
    const p = this.paginated();
    this.translate
      .get('KEY.LIST.PAGINATED_TEMPLATE_LIST', {
        page: p.page,
        total_pages: p.total_pages,
        total: p.total,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translatedText: string) => {
        this.currentPageReportTemplate.set(translatedText);
      });
  }

  pageChange($event: TablePageEvent): void {
    const current: KeyPartialQuery = { ...this.filter() };
    current.page = $event.first / $event.rows + 1;
    this.filter.set(current);
    this.loadKeys();
  }

  clear(table: Table): void {
    table.clear();
    this.searchText.set('');
    this.searchField.set('name');
    this.filter.set({ page: 1, limit: 10 });
    this.loadKeys();
  }

  /**
   * Both creation modes reach the same key — so ask which one instead of hiding the wizard in a
   * dropdown whose visible half looked like it could not build a standard key.
   */
  openCreationMode(): void {
    const ref = this.dialogService.open(KeyCreationModeDialog, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      width: '34rem',
      styleClass: 'responsive-dialog',
      header: this.translate.instant('KEY.CREATE_MODE.HEADER') as string,
    });

    ref?.onClose
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((mode: KeyCreationMode | null) => {
        if (mode === 'full') this.addKey();
        else if (mode === 'step') this.addStepByStepKey();
      });
  }

  addKey(): void {
    void this.router.navigateByUrl('/keys/add');
  }

  addStepByStepKey(): void {
    void this.router.navigateByUrl('/keys/add/step');
  }
}
