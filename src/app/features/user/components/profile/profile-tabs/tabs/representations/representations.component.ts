import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Table, TableLazyLoadEvent, TableModule, TablePageEvent } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { Select } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputGroup } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { MeService } from '../../../../../../../shared/services/me.service';
import {
  MeMemberPartialQuery,
  MeMembersPartialDTO,
} from '../../../../../../../shared/dtos/me.dtos';
import { MemberType, MemberStatus } from '../../../../../../../shared/types/member.types';
import { ErrorMessageHandler } from '../../../../../../../shared/services-ui/error.message.handler';
import { Pagination } from '../../../../../../../core/dtos/api.response';
import { DebouncedPInputComponent } from '../../../../../../../shared/components/debounced-p-input/debounced-p-input.component';

@Component({
  selector: 'app-representations-user',
  imports: [
    TranslatePipe,
    TableModule,
    TagModule,
    Select,
    FormsModule,
    Button,
    InputGroup,
    InputGroupAddonModule,
    DebouncedPInputComponent,
  ],
  templateUrl: './representations.component.html',
  styleUrl: './representations.component.css',
  providers: [ErrorMessageHandler],
})
export class RepresentationsComponent {
  private meService = inject(MeService);
  private errorHandler = inject(ErrorMessageHandler);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  readonly membersPartialList = signal<MeMembersPartialDTO[]>([]);

  memberTypeCategory = [MemberType.INDIVIDUAL, MemberType.COMPANY];
  statusCategory = [MemberStatus.ACTIVE, MemberStatus.INACTIVE, MemberStatus.PENDING];

  readonly searchField = signal<string>('community_name');
  readonly searchText = signal<string>('');
  readonly typeFilter = signal<MemberType | null>(null);
  readonly statusFilter = signal<MemberStatus | null>(null);

  searchFieldOptions = [
    { label: 'PROFILE.REPRESENTATIONS.COMMUNITY_LABEL', value: 'community_name' },
    { label: 'MEMBER.LIST.NAME_LABEL', value: 'name' },
  ];

  readonly hasActiveFilters = computed(
    () => !!this.searchText() || this.typeFilter() !== null || this.statusFilter() !== null,
  );

  readonly paginationInfo = signal<Pagination>({ page: 1, limit: 10, total: 0, total_pages: 1 });
  readonly filter = signal<MeMemberPartialQuery>({ page: 1, limit: 10 });
  readonly currentPageReportTemplate = signal<string>('');
  readonly firstRow = computed(
    () => (this.paginationInfo().page - 1) * this.paginationInfo().limit,
  );
  readonly showPaginator = computed(() => this.paginationInfo().total_pages > 1);

  constructor() {
    this.updatePaginationTranslation();
  }

  updatePaginationTranslation(): void {
    this.translate
      .get('PROFILE.REPRESENTATIONS.PAGE_REPORT_TEMPLATE_LABEL', {
        page: this.paginationInfo().page,
        total_pages: this.paginationInfo().total_pages,
        total: this.paginationInfo().total,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translatedText: string) => {
        this.currentPageReportTemplate.set(translatedText);
      });
  }

  applyFilters(): void {
    const current: MeMemberPartialQuery = { page: 1, limit: this.filter().limit };

    const text = this.searchText();
    if (text) {
      const field = this.searchField();
      if (field === 'community_name') current.community_name = text;
      else if (field === 'name') current.name = text;
    }

    const type = this.typeFilter();
    if (type !== null) {
      current.member_type = type;
    }

    const status = this.statusFilter();
    if (status !== null) {
      current.status = status;
    }

    this.filter.set(current);
    this.loadMembers();
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

  onTypeFilterChange(type: MemberType | null): void {
    this.typeFilter.set(type);
    this.applyFilters();
  }

  onStatusFilterChange(status: MemberStatus | null): void {
    this.statusFilter.set(status);
    this.applyFilters();
  }

  loadMembers(): void {
    this.meService
      .getMembers(this.filter())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response) {
            this.membersPartialList.set(response.data as MeMembersPartialDTO[]);
            this.paginationInfo.set(response.pagination);
            this.updatePaginationTranslation();
          } else {
            this.errorHandler.handleError(response);
          }
        },
        error: (error) => {
          this.errorHandler.handleError(error);
        },
      });
  }

  lazyLoadMembers($event: TableLazyLoadEvent): void {
    const current: MeMemberPartialQuery = { ...this.filter() };

    if ($event.first !== undefined && $event.rows !== undefined) {
      if ($event.rows) {
        current.page = $event.first / $event.rows + 1;
      } else {
        current.page = 1;
      }
    }

    this.filter.set(current);
    this.loadMembers();
  }

  pageChange($event: TablePageEvent): void {
    const current: MeMemberPartialQuery = { ...this.filter() };
    current.page = ($event.first ?? 0) / ($event.rows ?? 10) + 1;
    this.filter.set(current);
    this.loadMembers();
  }

  clear(table: Table): void {
    table.clear();
    this.searchText.set('');
    this.searchField.set('community_name');
    this.typeFilter.set(null);
    this.statusFilter.set(null);
    this.filter.set({ page: 1, limit: 10 });
    this.loadMembers();
  }

  onRowClick(member: MeMembersPartialDTO): void {
    // TODO: Navigate to member detail view
    console.log('Row clicked:', member.id);
  }

  protected readonly MemberType = MemberType;
  protected readonly MemberStatus = MemberStatus;
}
