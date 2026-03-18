import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { PrimeTemplate } from 'primeng/api';
import { Table, TableLazyLoadEvent, TableModule, TablePageEvent } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { Tooltip } from 'primeng/tooltip';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputGroup } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { CommunityUsersQueryDTO, UsersCommunityDTO } from '../../../../shared/dtos/community.dtos';
import { Role } from '../../../../core/dtos/role';
import { CommunityService } from '../../../../shared/services/community.service';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { InvitationService } from '../../../../shared/services/invitation.service';
import { CommunityPendingInvitation } from '../community-pending-invitation/community-pending-invitation';
import { CommunityInvitation } from '../community-invitation/community-invitation';
import { RolePipe } from '../../../../shared/pipes/role/role-pipe';
import { HeaderPage } from '../../../../layout/header-page/header-page';
import { Pagination } from '../../../../core/dtos/api.response';
import { DebouncedPInputComponent } from '../../../../shared/components/debounced-p-input/debounced-p-input.component';

@Component({
  selector: 'app-users-community-list',
  standalone: true,
  imports: [
    PrimeTemplate,
    TableModule,
    DialogModule,
    FormsModule,
    TranslatePipe,
    Button,
    Select,
    Tooltip,
    TagModule,
    RolePipe,
    HeaderPage,
    InputGroup,
    InputGroupAddonModule,
    DebouncedPInputComponent,
  ],
  templateUrl: './users-community-list.html',
  styleUrl: './users-community-list.css',
  providers: [DialogService, ErrorMessageHandler],
})
export class UsersCommunityList {
  protected userContextService = inject(UserContextService);
  private communityService = inject(CommunityService);
  private invitationService = inject(InvitationService);
  private errorHandler = inject(ErrorMessageHandler);
  private dialogService = inject(DialogService);
  private translateService = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  users = signal<UsersCommunityDTO[]>([]);
  pagination = signal<Pagination>({ page: 0, limit: 0, total: 0, total_pages: 0 });
  filter = signal<CommunityUsersQueryDTO>({ page: 1, limit: 10 });
  readonly firstRow = computed(() => (this.pagination().page - 1) * this.pagination().limit);
  readonly showPaginator = computed(() => this.pagination().total_pages > 1);
  ownId: number = -1;

  // Filter signals
  readonly searchText = signal<string>('');
  readonly roleFilter = signal<Role | null>(null);
  readonly hasActiveFilters = computed(() => !!this.searchText() || this.roleFilter() !== null);

  roleOptions = [
    { label: 'COMMON.ROLE.MEMBER', value: Role.MEMBER, severity: 'info' as const },
    { label: 'COMMON.ROLE.MANAGER', value: Role.GESTIONNAIRE, severity: 'warn' as const },
    { label: 'COMMON.ROLE.ADMIN', value: Role.ADMIN, severity: 'contrast' as const },
  ];

  // Dialog state
  dialogVisible = signal(false);
  userSelected = signal<UsersCommunityDTO | undefined>(undefined);
  roleSelected = signal<Role | -1>(-1);
  roles = [
    { name: 'COMMON.ROLE.MEMBER', value: Role.MEMBER },
    { name: 'COMMON.ROLE.MANAGER', value: Role.GESTIONNAIRE },
    { name: 'COMMON.ROLE.ADMIN', value: Role.ADMIN },
  ];
  ref?: DynamicDialogRef | null;

  constructor() {
    this.destroyRef.onDestroy(() => this.ref?.destroy());
  }

  loadUsers(): void {
    this.communityService.getUsers(this.filter()).subscribe({
      next: (response) => {
        this.users.set(response.data as UsersCommunityDTO[]);
        this.pagination.set(response.pagination);
      },
    });
  }

  applyFilters(): void {
    const current: CommunityUsersQueryDTO = { page: 1, limit: this.filter().limit };
    const text = this.searchText();
    if (text) {
      current.email = text;
    }
    const role = this.roleFilter();
    if (role !== null) {
      current.role = role;
    }
    this.filter.set(current);
    this.loadUsers();
  }

  onSearchTextChange(query: string): void {
    this.searchText.set(query);
    this.applyFilters();
  }

  onRoleFilterChange(role: Role | null): void {
    this.roleFilter.set(role);
    this.applyFilters();
  }

  lazyLoadUsers($event: TableLazyLoadEvent): void {
    const current: CommunityUsersQueryDTO = { ...this.filter() };
    if ($event.first !== undefined && $event.rows !== undefined) {
      current.page = $event.rows ? $event.first / $event.rows + 1 : 1;
    }
    if (current.page < 1) {
      current.page = 1;
    }
    this.filter.set(current);
    this.loadUsers();
  }

  pageChange($event: TablePageEvent): void {
    const current: CommunityUsersQueryDTO = { ...this.filter() };
    current.page = ($event.first ?? 0) / ($event.rows ?? 10) + 1;
    this.filter.set(current);
    this.loadUsers();
  }

  clear(table: Table): void {
    table.clear();
    this.searchText.set('');
    this.roleFilter.set(null);
    this.filter.set({ page: 1, limit: 10 });
    this.loadUsers();
  }

  openDialogEditRole(user: UsersCommunityDTO): void {
    this.dialogVisible.set(true);
    this.userSelected.set(user);
    this.roleSelected.set(-1);
  }

  updateRole(): void {
    const user = this.userSelected();
    if (this.roleSelected() === -1 || !user) {
      return;
    }
    const newRole: Role = this.roleSelected() as Role;
    user.role = newRole;

    this.communityService.patchRoleUser({ id_user: user.id_user, new_role: newRole }).subscribe({
      next: (response) => {
        if (response) {
          this.loadUsers();
        }
      },
      error: (error) => {
        this.errorHandler.handleError(error);
      },
    });
    this.dialogVisible.set(false);
    this.roleSelected.set(-1);
    this.userSelected.set(undefined);
  }

  deleteUser(user: UsersCommunityDTO): void {
    this.communityService.kick(user.id_user).subscribe((response) => {
      if (response) {
        this.loadUsers();
      }
    });
  }

  seePendingInvite(): void {
    this.ref = this.dialogService.open(CommunityPendingInvitation, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translateService.instant('COMMUNITY_PENDING_INVITATION.TITLE') as string,
    });
  }

  inviteGestionnaire(): void {
    this.ref = this.dialogService.open(CommunityInvitation, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translateService.instant('COMMUNITY_INVITATION.TITLE') as string,
    });
    if (this.ref) {
      this.ref.onClose.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((email: unknown) => {
        if (typeof email === 'string' && email) {
          this.invitationService.inviteUserToBecomeManager({ user_email: email }).subscribe({
            next: (response) => {
              if (!response) {
                this.errorHandler.handleError(response);
              }
            },
            error: (error) => {
              this.errorHandler.handleError(error);
            },
          });
        }
      });
    }
  }

  getUserDisplayName(user: UsersCommunityDTO): string {
    if (user.last_name) {
      return user.first_name ? `${user.first_name} ${user.last_name}` : user.last_name;
    }
    return user.first_name || '/';
  }

  protected readonly Role = Role;
}
