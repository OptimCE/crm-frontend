import {Component, inject, OnInit, signal} from '@angular/core';
import { Toast } from 'primeng/toast';
import { SplitButton } from 'primeng/splitbutton';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Table, TableLazyLoadEvent, TableModule, TablePageEvent } from 'primeng/table';
import { KeyService } from '../../../../shared/services/key.service';
import { Router, RouterLink } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { Pagination } from '../../../../core/dtos/api.response';
import { KeyPartialDTO, KeyPartialQuery } from '../../../../shared/dtos/key.dtos';
import { Button } from 'primeng/button';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';

@Component({
  selector: 'app-keys-list',
  standalone: true,
  imports: [Toast, SplitButton, TranslatePipe, TableModule, Button, RouterLink],
  templateUrl: './keys-list.html',
  styleUrl: './keys-list.css',
})
export class KeysList implements OnInit {
  private keyService = inject(KeyService);
  private translate = inject(TranslateService);
  private errorHandler = inject(ErrorMessageHandler);
  private router = inject(Router);
  // keysList: KeyPartialDTO[];
  keysList = signal<KeyPartialDTO[]>([]);
  loading = signal<boolean>(true);
  page: number = 1;
  paginated: Pagination = new Pagination(0, 5, 0, 0);
  filter = signal<KeyPartialQuery>({ page: 1, limit: 10 });

  currentPageReportTemplate: string = '';
  optionsSplitButton: MenuItem[] = [
    {
      label: '',
      command: () => {
        this.addStepByStepKey();
      },
    },
  ];
  lazy = true;
  ngOnInit() {
    this.updatePaginationTranslation();
    this.initializeTranslations();
  }
  loadKeys() {
    this.loading.set(true);
    this.keyService.getKeysList(this.filter()).subscribe({
      next: (response) => {
        if (response && response.data) {
          this.keysList.set(response.data as KeyPartialDTO[]);
          this.paginated = response.pagination;
          this.updatePaginationTranslation();
        } else {
          this.errorHandler.handleError();
        }
        this.loading.set(false);
      },
      error: (error) => {
        this.errorHandler.handleError(error.data ? error.data : null);
        this.loading.set(false);
      },
    });
  }

  lazyLoadKeys($event: TableLazyLoadEvent) {
    const current: any = { ...this.filter() };
    if ($event.first !== undefined && $event.rows !== undefined) {
      if ($event.rows) {
        current.page = $event.first / $event.rows + 1;
      } else {
        current.page = 1;
      }
    }

    if ($event.sortField) {
      const sortDirection = $event.sortOrder === 1 ? 'ASC' : 'DESC';
      delete current.sort_name;
      delete current.sort_description;
      switch ($event.sortField) {
        case 'nom': {
          current.sort_name = sortDirection;
          break;
        }
        case 'description': {
          current.sort_description = sortDirection;
          break;
        }
      }
    }
    if ($event.filters) {
      Object.entries($event.filters).forEach(([field, meta]) => {
        if ((meta as any).value) {
          current[field] = (meta as any).value;
        } else {
          delete current[field];
        }
      });
    }
    this.filter.set(current);
    this.loadKeys();
  }

  initializeTranslations() {
    this.translate
      .get('KEY.LIST.ADD_STANDARD_KEY_BUTTON_LABEL')
      .subscribe((translatedText: string) => {
        this.optionsSplitButton[0].label = translatedText;
      });
  }

  updatePaginationTranslation() {
    this.translate
      .get('KEY.LIST.PAGINATED_TEMPLATE_LIST', {
        page: this.paginated.page,
        total_pages: this.paginated.total_pages,
        total: this.paginated.total,
      })
      .subscribe((translatedText: string) => {
        this.currentPageReportTemplate = translatedText;
      });
  }

  pageChange($event: TablePageEvent) {
    const current: any = { ...this.filter() };
    current.page = $event.first / $event.rows + 1;
    this.filter.set(current);
    this.loadKeys();
  }

  clear(table: Table) {
    table.clear();
    this.filter.set({ page: 1, limit: 10 });
  }

  addKey() {
    this.router.navigateByUrl('/keys/add');
  }

  addStepByStepKey() {
    this.router.navigateByUrl('/keys/add/step');
  }
}
