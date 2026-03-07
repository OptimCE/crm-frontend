import { Component, inject, OnInit, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Table, TableLazyLoadEvent, TableModule, TablePageEvent } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { Select } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { MeService } from '../../../../../../../shared/services/me.service';
import {
  MeMemberPartialQuery,
  MeMembersPartialDTO,
} from '../../../../../../../shared/dtos/me.dtos';
import { MemberType, MemberStatus } from '../../../../../../../shared/types/member.types';
import { ErrorMessageHandler } from '../../../../../../../shared/services-ui/error.message.handler';

@Component({
  selector: 'app-representations-user',
  imports: [TranslatePipe, TableModule, TagModule, Select, FormsModule, Button],
  templateUrl: './representations.component.html',
  styleUrl: './representations.component.css',
  providers: [ErrorMessageHandler],
})
export class RepresentationsComponent implements OnInit {
  private meService = inject(MeService);
  private errorHandler = inject(ErrorMessageHandler);
  private translate = inject(TranslateService);

  membersPartialList = signal<MeMembersPartialDTO[]>([]);

  memberTypeCategory = [MemberType.INDIVIDUAL, MemberType.COMPANY];
  status = [MemberStatus.ACTIVE, MemberStatus.INACTIVE, MemberStatus.PENDING];

  paginationInfo = {
    page: 1,
    limit: 10,
    total: 0,
    total_pages: 1,
  };
  filter = signal<MeMemberPartialQuery>({ page: 1, limit: 10 });
  currentPageReportTemplate: string = '';

  ngOnInit(): void {
    this.updatePaginationTranslation();
  }

  updatePaginationTranslation(): void {
    this.translate
      .get('PROFILE.REPRESENTATIONS.PAGE_REPORT_TEMPLATE_LABEL', {
        page: this.paginationInfo.page,
        total_pages: this.paginationInfo.total_pages,
        total: this.paginationInfo.total,
      })
      .subscribe((translatedText: string) => {
        this.currentPageReportTemplate = translatedText;
      });
  }

  loadMembers(): void {
    this.meService.getMembers(this.filter()).subscribe({
      next: (response) => {
        if (response) {
          this.membersPartialList.set(response.data as MeMembersPartialDTO[]);
          this.paginationInfo = response.pagination;
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

    if ($event.sortField) {
      const sortDirection = $event.sortOrder === 1 ? 'ASC' : 'DESC';
      delete current.sort_type;
      delete current.sort_name;
      delete current.sort_status;

      switch ($event.sortField) {
        case 'type': {
          current.sort_type = sortDirection;
          break;
        }
        case 'name': {
          current.sort_name = sortDirection;
          break;
        }
        case 'status': {
          current.sort_status = sortDirection;
          break;
        }
      }
    }

    if ($event.filters) {
      const communityFilter = $event.filters['community'];
      if (communityFilter && !Array.isArray(communityFilter) && communityFilter.value) {
        current.community_name = communityFilter.value as string;
      } else {
        delete current.community_name;
      }

      const typeFilter = $event.filters['type'];
      if (typeFilter && !Array.isArray(typeFilter) && typeFilter.value !== undefined) {
        current.member_type = typeFilter.value as MemberType;
      } else {
        delete current.member_type;
      }

      const nameFilter = $event.filters['name'];
      if (nameFilter && !Array.isArray(nameFilter) && nameFilter.value) {
        current.name = nameFilter.value as string;
      } else {
        delete current.name;
      }

      const statusFilter = $event.filters['status'];
      if (statusFilter && !Array.isArray(statusFilter) && statusFilter.value !== undefined) {
        current.status = statusFilter.value as MemberStatus;
      } else {
        delete current.status;
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
