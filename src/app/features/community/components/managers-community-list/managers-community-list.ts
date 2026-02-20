import { Component, inject, OnInit, signal } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { PrimeTemplate } from 'primeng/api';
import { RolePipe } from '../../../../shared/pipes/role/role-pipe';
import { SplitButtonModule } from 'primeng/splitbutton';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TranslatePipe } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { CommunityService } from '../../../../shared/services/community.service';
import { CommunityUsersQueryDTO, UsersCommunityDTO } from '../../../../shared/dtos/community.dtos';
import { Role } from '../../../../core/dtos/role';

@Component({
  selector: 'app-managers-community-list',
  standalone: true,
  imports: [
    DialogModule,
    PrimeTemplate,
    RolePipe,
    SplitButtonModule,
    TableModule,
    TranslatePipe,
    FormsModule,
  ],
  templateUrl: './managers-community-list.html',
  styleUrl: './managers-community-list.css',
})
export class ManagersCommunityList implements OnInit {
  private communityService = inject(CommunityService);
  users = signal<UsersCommunityDTO[]>([]);
  filter = signal<CommunityUsersQueryDTO>({ page: 1, limit: 10 });
  dialogVisible: boolean = false;
  userSelected: UsersCommunityDTO | null = null;
  roleSelected: Role | -1 = -1;

  ngOnInit(): void {
    this.dialogVisible = false;
    this.roleSelected = -1;
    this.userSelected = null;
  }

  loadUsers(): void {
    this.communityService.getAdmins(this.filter()).subscribe((response) => {
      if (response) {
        this.users.set(response.data as UsersCommunityDTO[]);
      }
    });
  }
  lazyLoadUsers($event: TableLazyLoadEvent): void {
    const current: CommunityUsersQueryDTO = { ...this.filter() };
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
      delete current.sort_role;
      switch ($event.sortField) {
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
}
