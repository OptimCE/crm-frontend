import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PrimeTemplate } from 'primeng/api';
import { Table, TableLazyLoadEvent, TableModule, TablePageEvent } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { InputGroup } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { CommunityService } from '../../../../shared/services/community.service';
import { CommunityUsersQueryDTO, UsersCommunityDTO } from '../../../../shared/dtos/community.dtos';
import { Role } from '../../../../core/dtos/role';
import { Pagination } from '../../../../core/dtos/api.response';
import { RolePipe } from '../../../../shared/pipes/role/role-pipe';
import { HeaderPage } from '../../../../layout/header-page/header-page';
import { DebouncedPInputComponent } from '../../../../shared/components/debounced-p-input/debounced-p-input.component';

@Component({
  selector: 'app-managers-community-list',
  standalone: true,
  imports: [
    PrimeTemplate,
    TableModule,
    TagModule,
    TranslatePipe,
    FormsModule,
    Button,
    Select,
    RolePipe,
    HeaderPage,
    InputGroup,
    InputGroupAddonModule,
    DebouncedPInputComponent,
  ],
  templateUrl: './managers-community-list.html',
  styleUrl: './managers-community-list.css',
})
export class ManagersCommunityList {
  private communityService = inject(CommunityService);

  users = signal<UsersCommunityDTO[]>([]);
  pagination = signal<Pagination>({ page: 0, limit: 0, total: 0, total_pages: 0 });
  filter = signal<CommunityUsersQueryDTO>({ page: 1, limit: 10 });
  readonly firstRow = computed(() => (this.pagination().page - 1) * this.pagination().limit);
  readonly showPaginator = computed(() => this.pagination().total_pages > 1);

  // Filter signals
  readonly searchText = signal<string>('');
  readonly roleFilter = signal<Role | null>(null);
  readonly hasActiveFilters = computed(() => !!this.searchText() || this.roleFilter() !== null);

  roleOptions = [
    { label: 'COMMON.ROLE.MANAGER', value: Role.GESTIONNAIRE, severity: 'warn' as const },
    { label: 'COMMON.ROLE.ADMIN', value: Role.ADMIN, severity: 'contrast' as const },
  ];

  loadUsers(): void {
    this.communityService.getAdmins(this.filter()).subscribe({
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

  getUserDisplayName(user: UsersCommunityDTO): string {
    if (user.last_name) {
      return user.first_name ? `${user.first_name} ${user.last_name}` : user.last_name;
    }
    return user.first_name || '/';
  }

  protected readonly Role = Role;
}
