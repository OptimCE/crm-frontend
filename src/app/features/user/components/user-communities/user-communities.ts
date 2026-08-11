import { Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { safeReturnUrl } from '../../../../core/guards/active-community.guard';
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
import { Role } from '../../../../core/dtos/role';
import { CommunityDialog } from './community-dialog/community-dialog';
import { HeaderPage } from '../../../../layout/header-page/header-page';
import { ApiResponse, Pagination } from '../../../../core/dtos/api.response';
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
  private router = inject(Router);
  private dialogService = inject(DialogService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);
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

  /**
   * Where `activeCommunityGuard` was headed when it bounced the user here.
   * Bound from `?returnUrl=` by `withComponentInputBinding()` (app.config.ts).
   */
  readonly returnUrl = input<string | undefined>();
  /** auth_community_id currently being entered, for the button's spinner. */
  readonly entering = signal<string | null>(null);

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

  /**
   * Enters a community and goes somewhere.
   *
   * This used to switch the context and navigate nowhere: the sidebar changed
   * under you and you stayed on the same page, which is the dead end that made
   * the community dashboard unreachable.
   *
   * Navigation is deliberately NOT awaited on the annexe catalogue.
   * `switchCommunity` only flips a signal; `CommunityServicesStore` then fetches.
   * Blocking the most important click in the app on that request would cost
   * several hundred ms of dead UI and would still be wrong if it failed — the
   * store resolves per community id instead, so the dashboard's own tiles wait
   * on `ensureLoaded()` and show a skeleton rather than a wrong answer.
   */
  joinCommunity(community: MyCommunityDTO): void {
    this.entering.set(community.auth_community_id);
    this.userContextService.switchCommunity(community.auth_community_id);
    void this.router.navigateByUrl(safeReturnUrl(this.returnUrl()) ?? '/dashboard');
  }

  /** Is this row the community the session is currently working inside? */
  isActiveCommunity(community: MyCommunityDTO): boolean {
    return this.userContextService.activeCommunityId() === community.auth_community_id;
  }

  /**
   * An ADMIN cannot leave the community they are working inside: they are the
   * only role that can administer it, so walking out would orphan it. Every
   * other case — any role on another community, MEMBER/MANAGER on this one —
   * keeps the button.
   */
  canLeave(community: MyCommunityDTO): boolean {
    return (
      !this.isActiveCommunity(community) ||
      !this.userContextService.compareWithActiveRole(Role.ADMIN)
    );
  }

  /**
   * Both destinations below resolve the community from the session context, not
   * from a route param, so they are only ever rendered on the active row.
   */
  goToCommunityInfo(): void {
    void this.router.navigateByUrl('/communities/info');
  }

  goToDashboard(): void {
    void this.router.navigateByUrl('/dashboard');
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

  leaveCommunity(event: Event, community: MyCommunityDTO): void {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      header: this.translate.instant('COMMUNITY.LIST.LEAVE_CONFIRM_HEADER') as string,
      message: this.translate.instant('COMMUNITY.LIST.LEAVE_CONFIRM_MESSAGE', {
        name: community.name,
      }) as string,
      acceptLabel: this.translate.instant('COMMON.ACTIONS.VALIDATE') as string,
      rejectLabel: this.translate.instant('COMMON.ACTIONS.CANCEL') as string,
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this.communityService
          .leave(community.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.messageService.add({
                severity: 'success',
                summary: this.translate.instant('COMMUNITY.LIST.LEAVE_SUCCESS') as string,
              });
              // Membership changed: refresh token + context, then reload the list.
              void this.keycloak.updateToken(-1).then(() => {
                this.userContextService.refreshUserContext();
                this.loadCommunities();
              });
            },
            error: (error: unknown) => {
              const detail = error instanceof ApiResponse ? (error.data as string) : null;
              this.messageService.add({
                severity: 'error',
                summary: this.translate.instant('COMMON.ERRORS.EXCEPTION') as string,
                detail: detail ?? undefined,
              });
            },
          });
      },
    });
  }

  pageChange($event: TablePageEvent): void {
    const current: CommunityQueryDTO = { ...this.filter() };
    current.page = ($event.first ?? 0) / ($event.rows ?? 10) + 1;
    this.filter.set(current);
    this.loadCommunities();
  }
}
