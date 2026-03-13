import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { PrimeTemplate } from 'primeng/api';
import { TableLazyLoadEvent, TableModule, TablePageEvent } from 'primeng/table';
import { SplitButtonModule } from 'primeng/splitbutton';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { Tooltip } from 'primeng/tooltip';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
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

@Component({
  selector: 'app-users-community-list',
  standalone: true,
  imports: [
    PrimeTemplate,
    TableModule,
    SplitButtonModule,
    DialogModule,
    InputTextModule,
    FormsModule,
    TranslatePipe,
    Button,
    Select,
    Tooltip,
    RolePipe,
    HeaderPage,
  ],
  templateUrl: './users-community-list.html',
  styleUrl: './users-community-list.css',
  providers: [DialogService, ErrorMessageHandler],
})
export class UsersCommunityList implements OnInit, OnDestroy {
  protected userContextService = inject(UserContextService);
  private communityService = inject(CommunityService);
  private invitationService = inject(InvitationService);
  private errorHandler = inject(ErrorMessageHandler);
  private dialogService = inject(DialogService);
  private translateService = inject(TranslateService);
  users = signal<UsersCommunityDTO[]>([]);
  pagination = signal<Pagination>({ page: 0, limit: 0, total: 0, total_pages: 0 });
  filter = signal<CommunityUsersQueryDTO>({ page: 1, limit: 10 });
  readonly firstRow = computed(() => (this.pagination().page - 1) * this.pagination().limit);
  ownId: number = -1;
  dialogVisible = signal(false);
  userSelected = signal<UsersCommunityDTO | undefined>(undefined);
  roleSelected = signal<Role | -1>(-1);
  roles = signal([
    { name: '', value: Role.MEMBER },
    { name: '', value: Role.GESTIONNAIRE },
    { name: '', value: Role.ADMIN },
  ]);
  ref?: DynamicDialogRef | null;

  ngOnInit(): void {
    // Initialize role names with translations
    this.translateService
      .get(['COMMON.ROLE.MEMBER', 'COMMON.ROLE.MANAGER', 'COMMON.ROLE.ADMIN'])
      .subscribe((translations: Record<string, string>) => {
        this.roles.set([
          { name: translations['COMMON.ROLE.MEMBER'], value: Role.MEMBER },
          { name: translations['COMMON.ROLE.MANAGER'], value: Role.GESTIONNAIRE },
          { name: translations['COMMON.ROLE.ADMIN'], value: Role.ADMIN },
        ]);
      });
  }

  loadUsers(): void {
    this.communityService.getUsers(this.filter()).subscribe({
      next: (response) => {
        this.users.set(response.data as UsersCommunityDTO[]);
        this.pagination.set(response.pagination);
      },
    });
  }
  lazyLoadUsers($event: TableLazyLoadEvent): void {
    const current: CommunityUsersQueryDTO = { ...this.filter() };
    if ($event.sortField) {
      const sortDirection = $event.sortOrder === 1 ? 'ASC' : 'DESC';
      delete current.sort_email;
      delete current.sort_name;
      delete current.sort_role;
      switch ($event.sortField) {
        case 'email': {
          current.sort_email = sortDirection;
          break;
        }
        case 'name': {
          current.sort_name = sortDirection;
          break;
        }
        case 'role': {
          current.sort_role = sortDirection;
          break;
        }
      }
    }
    this.filter.set(current);
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

  protected readonly ADMIN = Role.ADMIN;

  seePendingInvite(): void {
    this.translateService
      .get('COMMUNITY_PENDING_INVITATION.TITLE')
      .subscribe((translation: string) => {
        this.ref = this.dialogService.open(CommunityPendingInvitation, {
          modal: true,
          closable: true,
          closeOnEscape: true,
          header: translation,
        });
      });
  }

  inviteGestionnaire(): void {
    this.translateService.get('COMMUNITY_INVITATION.TITLE').subscribe((translation: string) => {
      this.ref = this.dialogService.open(CommunityInvitation, {
        modal: true,
        closable: true,
        closeOnEscape: true,
        header: translation,
      });
      this.ref?.onClose.subscribe((email: unknown) => {
        if (typeof email === 'string' && email) {
          this.invitationService.inviteUserToBecomeManager({ user_email: email }).subscribe({
            next: (response) => {
              if (response) {
                // Success case handled
              } else {
                this.errorHandler.handleError(response);
              }
            },
            error: (error) => {
              this.errorHandler.handleError(error);
            },
          });
        }
      });
    });
  }

  protected readonly GESTIONNAIRE = Role.GESTIONNAIRE;
  protected readonly MEMBER = Role.MEMBER;

  ngOnDestroy(): void {
    if (this.ref) {
      this.ref.destroy();
    }
  }

  protected readonly Role = Role;

  pageChange($event: TablePageEvent): void {
    const current: CommunityUsersQueryDTO = { ...this.filter() };
    current.page = $event.first / $event.rows + 1;
    this.filter.set(current);
    this.loadUsers();
  }
}
