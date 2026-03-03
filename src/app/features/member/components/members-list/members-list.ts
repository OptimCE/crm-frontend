import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Button } from 'primeng/button';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Table, TableLazyLoadEvent, TableModule, TablePageEvent } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { MemberPartialQuery, MembersPartialDTO } from '../../../../shared/dtos/member.dtos';
import { MemberType, MemberStatus } from '../../../../shared/types/member.types';
import { MemberService } from '../../../../shared/services/member.service';
import { Router } from '@angular/router';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { MemberInvite } from '../member-invite/member-invite';
import { InvitationService } from '../../../../shared/services/invitation.service';
import { MemberCreationUpdate } from '../member-creation-update/member-creation-update';
import { MeterCreation } from '../../../meter/components/meter-creation/meter-creation';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { MemberPendingInvite } from '../member-pending-invite/member-pending-invite';
import { Select } from 'primeng/select';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-members-list',
  imports: [
    Toast,
    ConfirmDialog,
    Button,
    TranslatePipe,
    TableModule,
    TagModule,
    Select,
    FormsModule,
  ],
  templateUrl: './members-list.html',
  styleUrl: './members-list.css',
  providers: [DialogService, ErrorMessageHandler, ConfirmationService, MessageService],
})
export class MembersList implements OnInit, OnDestroy {
  private membersService = inject(MemberService);
  private invitationService = inject(InvitationService);
  private router = inject(Router);
  private dialogService = inject(DialogService);
  private snackbarNotification = inject(SnackbarNotification);
  private errorHandler = inject(ErrorMessageHandler);
  private translate = inject(TranslateService);
  private confirmationService = inject(ConfirmationService);
  membersPartialList = signal<MembersPartialDTO[]>([]);
  ref?: DynamicDialogRef | null;

  membreTypeCategory = [MemberType.INDIVIDUAL, MemberType.COMPANY];
  status = [MemberStatus.ACTIVE, MemberStatus.INACTIVE, MemberStatus.PENDING];
  paginationInfo = {
    page: 1,
    limit: 10,
    total: 0,
    total_pages: 1,
  };
  filter = signal<MemberPartialQuery>({ page: 1, limit: 10 });
  currentPageReportTemplate: string = '';

  ngOnInit(): void {
    this.updatePaginationTranslation();
  }

  updatePaginationTranslation(): void {
    this.translate
      .get('MEMBER.LIST.PAGE_REPORT_TEMPLATE_MEMBER_LABEL', {
        page: this.paginationInfo.page,
        total_pages: this.paginationInfo.total_pages,
        total: this.paginationInfo.total,
      })
      .subscribe((translatedText: string) => {
        this.currentPageReportTemplate = translatedText;
      });
  }
  loadMembers(): void {
    this.membersService.getMembersList(this.filter()).subscribe({
      next: (response) => {
        if (response) {
          this.membersPartialList.set(response.data as MembersPartialDTO[]);
          this.paginationInfo = response.pagination;

          this.updatePaginationTranslation();
        } else {
          this.errorHandler.handleError(response);
          console.error('Error fetching meters partial list');
        }
      },
      error: (error) => {
        this.errorHandler.handleError(error);
        console.error('Error fetching meters partial list');
      },
    });
  }
  onInviteMember(): void {
    this.ref = this.dialogService.open(MemberInvite, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('MEMBER.LIST.INVITE_MEMBER_HEADER') as string,
    });
    if (this.ref) {
      this.ref.onClose.subscribe((email: unknown) => {
        if (typeof email === 'string' && email) {
          this.invitationService.inviteUserToBecomeMember({ user_email: email }).subscribe({
            next: (response) => {
              if (response) {
                console.log('SUCCESS');
              } else {
                console.error(response);
              }
            },
            error: (error) => {
              console.error(error);
            },
          });
        }
      });
    }
  }
  onAddMember(event: Event): void {
    this.ref = this.dialogService.open(MemberCreationUpdate, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('MEMBER.LIST.ADD_MEMBER_HEADER') as string,
    });
    if (this.ref) {
      this.ref.onClose.subscribe((result: unknown) => {
        if (typeof result === 'number' && result > 0) {
          // Show "Do you want to add meter associated"
          this.confirmationService.confirm({
            target: event.target as EventTarget,
            message: this.translate.instant(
              'MEMBER.LIST.ADD_METER_FOR_MEMBER_CONFIRMATION_LABEL',
            ) as string,
            header: this.translate.instant('MEMBER.LIST.CONFIRMATION_HEADER') as string,
            icon: 'pi pi-exclamation-triangle',
            acceptIcon: 'none',
            rejectIcon: 'none',
            acceptLabel: this.translate.instant('COMMON.ACTIONS.YES') as string,
            rejectLabel: this.translate.instant('COMMON.ACTIONS.NO') as string,
            rejectButtonStyleClass: 'p-button-text',
            accept: () => {
              this.addMeter(result);
            },
            reject: () => {
              this.addMemberSuccess();
            },
          });
        }
      });
    }
  }

  addMeter(member_id: number): void {
    this.ref = this.dialogService.open(MeterCreation, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('MEMBER.LIST.ADD_METER_HEADER') as string,
      data: {
        holder_id: member_id,
      },
    });
    if (this.ref) {
      this.ref.onClose.subscribe((response) => {
        if (response) {
          this.snackbarNotification.openSnackBar(
            this.translate.instant('MEMBER.LIST.METER_MEMBER_ADDED_SUCCESSFULLY_LABEL') as string,
            VALIDATION_TYPE,
          );
          this.loadMembers();
        }
      });
    }
  }

  addMemberSuccess(): void {
    this.snackbarNotification.openSnackBar(
      this.translate.instant('MEMBER.LIST.MEMBER_ADDED_SUCCESSFULLY_LABEL') as string,
      VALIDATION_TYPE,
    );
    this.loadMembers();
  }

  lazyLoadMembers($event: TableLazyLoadEvent): void {
    const current: MemberPartialQuery = { ...this.filter() };
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
    const current: MemberPartialQuery = { ...this.filter() };
    current.page = ($event.first ?? 0) / ($event.rows ?? 10) + 1;
    this.filter.set(current);
    this.loadMembers();
  }

  clear(table: Table): void {
    table.clear();
    this.filter.set({ page: 1, limit: 10 });
    this.loadMembers();
  }

  onRowClick(member: MembersPartialDTO): void {
    void this.router.navigate(['/members/', member.id]);
  }

  seePendingInvite(): void {
    this.ref = this.dialogService.open(MemberPendingInvite, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('MEMBER.LIST.PENDING_INVITATION_HEADER') as string,
    });
  }

  ngOnDestroy(): void {
    if (this.ref) {
      this.ref.destroy();
    }
  }

  protected readonly MemberType = MemberType;
  protected readonly MemberStatus = MemberStatus;
}
