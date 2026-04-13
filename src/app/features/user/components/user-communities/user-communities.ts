import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Button } from 'primeng/button';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Tag } from 'primeng/tag';
import { Table, TableLazyLoadEvent, TableModule, TablePageEvent } from 'primeng/table';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { CommunityQueryDTO, MyCommunityDTO } from '../../../../shared/dtos/community.dtos';
import { CommunityService } from '../../../../shared/services/community.service';
import { ConfirmationService, MessageService } from 'primeng/api';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { CommunityDialog } from './community-dialog/community-dialog';
import { HeaderPage } from '../../../../layout/header-page/header-page';
import { Pagination } from '../../../../core/dtos/api.response';
import { DebouncedPInputComponent } from '../../../../shared/components/debounced-p-input/debounced-p-input.component';
import Keycloak from 'keycloak-js';

@Component({
  selector: 'app-user-communities',
  imports: [
    Toast,
    ConfirmDialog,
    Button,
    TranslatePipe,
    Tag,
    TableModule,
    HeaderPage,
    DebouncedPInputComponent,
  ],
  templateUrl: './user-communities.html',
  styleUrl: './user-communities.css',
  providers: [DialogService, ConfirmationService, MessageService],
})
export class UserCommunities {
  private communityService = inject(CommunityService);
  protected userContextService = inject(UserContextService);
  private keycloak = inject(Keycloak);
  private dialogService = inject(DialogService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  readonly communities = signal<MyCommunityDTO[]>([]);
  readonly filter = signal<CommunityQueryDTO>({ page: 1, limit: 10 });
  readonly pagination = signal<Pagination>({ page: 0, limit: 0, total: 0, total_pages: 0 });
  readonly currentPageReportTemplate = signal<string>('');
  readonly firstRow = computed(() => (this.pagination().page - 1) * this.pagination().limit);
  readonly showPaginator = computed(() => this.pagination().total_pages > 1);
  private ref?: DynamicDialogRef | null;

  readonly searchText = signal<string>('');
  readonly hasActiveFilters = computed(() => !!this.searchText());

  constructor() {
    this.destroyRef.onDestroy(() => this.ref?.destroy());
    this.updatePaginationTranslation();
  }

  updatePaginationTranslation(): void {
    this.translate
      .get('COMMUNITY.LIST.PAGE_REPORT_TEMPLATE_LABEL', {
        page: this.pagination().page,
        total_pages: this.pagination().total_pages,
        total: this.pagination().total,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translatedText: string) => {
        this.currentPageReportTemplate.set(translatedText);
      });
  }

  applyFilters(): void {
    const current: CommunityQueryDTO = { page: 1, limit: this.filter().limit };
    const text = this.searchText();
    if (text) {
      current.name = text;
    }
    this.filter.set(current);
    this.loadCommunities();
  }

  onSearchTextChange(query: string): void {
    this.searchText.set(query);
    this.applyFilters();
  }

  clear(table: Table): void {
    table.clear();
    this.searchText.set('');
    this.filter.set({ page: 1, limit: 10 });
    this.loadCommunities();
  }

  loadCommunities(): void {
    this.communityService
      .getMyCommunities(this.filter())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response) {
            this.communities.set(response.data as MyCommunityDTO[]);
            this.pagination.set(response.pagination);
            this.updatePaginationTranslation();
          }
        },
        error: (_error) => {
          // TODO: Handle error
        },
      });
  }

  lazyLoadCommunities($event: TableLazyLoadEvent): void {
    const current: CommunityQueryDTO = { ...this.filter() };
    if ($event.first !== undefined && $event.rows !== undefined) {
      current.page = $event.rows ? $event.first / $event.rows + 1 : 1;
    }
    this.filter.set(current);
    this.loadCommunities();
  }

  joinCommunity(community: MyCommunityDTO): void {
    this.userContextService.switchCommunity(community.auth_community_id);
  }

  updateNameCommunity(_community: MyCommunityDTO): void {
    // TODO: Implement community name update
  }

  createCommunity(): void {
    this.ref = this.dialogService.open(CommunityDialog, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('COMMUNITY.CREATE.TITLE') as string,
    });
    this.ref?.onClose.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result: boolean) => {
      if (result) {
        void this.keycloak.updateToken(-1).then(() => {
          this.userContextService.refreshUserContext();
          this.loadCommunities();
        });
      }
    });
  }

  leaveCommunity(_event: Event, _community: MyCommunityDTO): void {
    // TODO: Implement leave community
  }

  pageChange($event: TablePageEvent): void {
    const current: CommunityQueryDTO = { ...this.filter() };
    current.page = ($event.first ?? 0) / ($event.rows ?? 10) + 1;
    this.filter.set(current);
    this.loadCommunities();
  }
}
