import {
  AfterViewInit,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Table, TableLazyLoadEvent, TableModule, TablePageEvent } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { Button } from 'primeng/button';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { KeyPartialDTO, KeyPartialQuery } from '../../../../shared/dtos/key.dtos';
import { Pagination } from '../../../../core/dtos/api.response';
import { KeyService } from '../../../../shared/services/key.service';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { SharingOperationService } from '../../../../shared/services/sharing_operation.service';
import { Tooltip } from 'primeng/tooltip';

interface SharingOperationAddKeyDialogData {
  id: number;
  /**
   * Seeds the name filter. Set when returning from key creation so the brand-new key is the one
   * listed, ready to attach.
   */
  prefillName?: string;
}

/**
 * What this dialog closes with:
 * - `true` — a key was attached to the operation;
 * - `{ action: 'create' }` — the user wants to build a new key instead, and the caller should drive
 *   that flow (the dialog closes rather than nesting another one);
 * - `undefined` — plain dismissal.
 */
export type SharingOperationAddKeyResult = true | { action: 'create' } | undefined;

@Component({
  selector: 'app-sharing-operation-add-key',
  standalone: true,
  imports: [TableModule, TagModule, Button, TranslatePipe, Tooltip],
  templateUrl: './sharing-operation-add-key.html',
  styleUrl: './sharing-operation-add-key.css',
  providers: [ErrorMessageHandler],
})
export class SharingOperationAddKey implements OnInit, AfterViewInit {
  private keysService = inject(KeyService);
  private config = inject(DynamicDialogConfig);
  private sharingOpService = inject(SharingOperationService);
  private ref = inject(DynamicDialogRef);
  private errorHandler = inject(ErrorMessageHandler);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  readonly keysList = signal<KeyPartialDTO[]>([]);
  readonly loading = signal<boolean>(true);
  readonly page = signal<number>(1);
  readonly paginated = signal<Pagination>(new Pagination(0, 5, 0, 0));
  readonly selectedKey = signal<KeyPartialDTO | undefined>(undefined);
  readonly currentPageReportTemplate = signal<string>('');
  private readonly dialogData = this.config.data as SharingOperationAddKeyDialogData;
  readonly id = this.dialogData.id;
  readonly prefillName = this.dialogData.prefillName;
  readonly table = viewChild<Table<KeyPartialDTO>>('dt');

  readonly firstRow = computed(() => (this.paginated().page - 1) * this.paginated().limit);
  readonly showPaginator = computed(() => this.paginated().total_pages > 1);

  loadKeys($event?: TableLazyLoadEvent, changeIsLoaded: boolean = true): void {
    if (changeIsLoaded) {
      this.loading.set(true);
    }
    try {
      const params: KeyPartialQuery = { page: 1, limit: 10 };

      if ($event && $event.filters) {
        if ($event.filters['nom']) {
          const filter = Array.isArray($event.filters['nom'])
            ? $event.filters['nom'][0]
            : $event.filters['nom'];
          if (filter.value) {
            params.name = filter.value as string;
          }
        }
        if ($event.filters['description']) {
          const filter = Array.isArray($event.filters['description'])
            ? $event.filters['description'][0]
            : $event.filters['description'];
          if (filter.value) {
            params.description = filter.value as string;
          }
        }
      }
      this.keysService
        .getKeysList({ ...params })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => {
            if (response) {
              this.keysList.set(response.data as KeyPartialDTO[]);
              this.paginated.set(response.pagination);
              if (changeIsLoaded) {
                this.loading.set(false);
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

  ngOnInit(): void {
    this.updatePaginationTranslation();
  }

  ngAfterViewInit(): void {
    if (!this.prefillName) return;
    // Drive the table's own filter rather than injecting the name into the query behind its back:
    // the filter box then shows the value, and clearing it really does clear it.
    this.table()?.filter(this.prefillName, 'nom', 'contains');
  }

  updatePaginationTranslation(): void {
    this.translate
      .get('SHARING_OPERATION.ADD_KEY.PAGE_REPORT_TEMPLATE_KEYS_LABEL', {
        page: this.paginated().page,
        total_pages: this.paginated().total_pages,
        total: this.paginated().total,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translatedText: string) => {
        this.currentPageReportTemplate.set(translatedText);
      });
  }
  pageChange($event: TablePageEvent): void {
    this.page.set($event.first / $event.rows + 1);
    this.loadKeys();
  }

  clear(table: Table<KeyPartialDTO>): void {
    table.clear();
  }

  /**
   * Hands the "build a new key" flow back to the caller. Closing first keeps the meter-import
   * dialog from being stacked on top of this one.
   */
  createKey(): void {
    this.ref.close({ action: 'create' });
  }

  addKey(): void {
    const key = this.selectedKey();
    if (!key) return;
    this.sharingOpService
      .addKeyToSharing({ id_sharing: this.id, id_key: key.id })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response) {
            this.ref.close(true);
          } else {
            this.errorHandler.handleError();
          }
        },
        error: (error: { data?: unknown }) => {
          this.errorHandler.handleError(error.data ?? null);
        },
      });
  }
}
