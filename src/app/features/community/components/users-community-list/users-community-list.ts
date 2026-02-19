import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import { PrimeTemplate } from 'primeng/api';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
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
  filter = signal<CommunityUsersQueryDTO>({ page: 1, limit: 10 });
  ownId: number = -1;
  dialogVisible: boolean = false;
  userSelected?: UsersCommunityDTO;
  roleSelected: any;
  roles = [
    { name: '', value: Role.MEMBER },
    { name: '', value: Role.GESTIONNAIRE },
    { name: '', value: Role.ADMIN },
  ];
  ref?: DynamicDialogRef | null;


  ngOnInit(): void {
    this.dialogVisible = false;
    this.roleSelected = -1;

    // Initialize role names with translations
    this.translateService
      .get(['COMMON.ROLE.MEMBER', 'COMMON.ROLE.MANAGER', 'COMMON.ROLE.ADMIN'])
      .subscribe((translations) => {
        this.roles = [
          { name: translations['COMMON.ROLE.MEMBER'], value: Role.MEMBER },
          { name: translations['COMMON.ROLE.MANAGER'], value: Role.GESTIONNAIRE },
          { name: translations['COMMON.ROLE.ADMIN'], value: Role.ADMIN },
        ];
      });
  }

  loadUsers() {
    this.communityService.getUsers(this.filter()).subscribe((response) => {
      if (response) {
        this.users.set(response.data as UsersCommunityDTO[]);
      }
    });
  }
  lazyLoadUsers($event: TableLazyLoadEvent) {
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

  openDialogEditRole(user: UsersCommunityDTO) {
    this.dialogVisible = true;
    this.userSelected = user;
    this.roleSelected = -1;
  }
  updateRole() {
    if (this.roleSelected === -1 || !this.userSelected) {
      return;
    }
    this.userSelected.role = this.roleSelected;

    this.communityService
      .patchRoleUser({ id_user: this.userSelected.id_user, new_role: this.roleSelected })
      .subscribe({
        next: (response) => {
          if (response) {
            this.loadUsers();
          }
        },
        error: (error) => {
          this.errorHandler.handleError(error);
        },
      });
    this.dialogVisible = false;
    this.roleSelected = -1;
    this.userSelected = undefined;
  }
  deleteUser(user: UsersCommunityDTO) {
    this.communityService.kick(user.id_user).subscribe((response) => {
      if (response) {
        this.loadUsers();
      }
    });
  }

  protected readonly ADMIN = Role.ADMIN;

  seePendingInvite() {
    this.translateService.get('COMMUNITY_PENDING_INVITATION.TITLE').subscribe((translation) => {
      this.ref = this.dialogService.open(CommunityPendingInvitation, {
        modal: true,
        closable: true,
        closeOnEscape: true,
        header: translation,
      });
    });
  }

  inviteGestionnaire() {
    this.translateService.get('COMMUNITY_INVITATION.TITLE').subscribe((translation) => {
      this.ref = this.dialogService.open(CommunityInvitation, {
        modal: true,
        closable: true,
        closeOnEscape: true,
        header: translation,
      });
      this.ref?.onClose.subscribe((email) => {
        if (email) {
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
}
