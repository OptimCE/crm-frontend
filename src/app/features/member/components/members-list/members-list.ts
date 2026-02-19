import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Button } from 'primeng/button';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TableModule } from 'primeng/table';
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

  updatePaginationTranslation() {
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
  loadMembers() {
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
  onInviteMember() {
    this.ref = this.dialogService.open(MemberInvite, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('MEMBER.LIST.INVITE_MEMBER_HEADER'),
    });
    if (this.ref) {
      this.ref.onClose.subscribe((email) => {
        if (email) {
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
  onAddMember(event: Event) {
    this.ref = this.dialogService.open(MemberCreationUpdate, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('MEMBER.LIST.ADD_MEMBER_HEADER'),
    });
    if (this.ref) {
      this.ref.onClose.subscribe((result) => {
        if (result === 1) {
          // Show "Do you want to add meter associated"
          this.confirmationService.confirm({
            target: event.target as EventTarget,
            message: this.translate.instant('MEMBER.LIST.ADD_METER_FOR_MEMBER_CONFIRMATION_LABEL'),
            header: this.translate.instant('MEMBER.LIST.CONFIRMATION_HEADER'),
            icon: 'pi pi-exclamation-triangle',
            acceptIcon: 'none',
            rejectIcon: 'none',
            acceptLabel: this.translate.instant('COMMON.ACTIONS.YES'),
            rejectLabel: this.translate.instant('COMMON.ACTIONS.NO'),
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

  addMeter(member_id: number) {
    this.ref = this.dialogService.open(MeterCreation, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('MEMBER.LIST.ADD_METER_HEADER'),
      data: {
        holder_id: member_id,
      },
    });
    if (this.ref) {
      this.ref.onClose.subscribe((response) => {
        if (response) {
          this.snackbarNotification.openSnackBar(
            this.translate.instant('MEMBER.LIST.METER_MEMBER_ADDED_SUCCESSFULLY_LABEL'),
            VALIDATION_TYPE,
          );
          this.loadMembers();
        }
      });
    }
  }

  addMemberSuccess() {
    this.snackbarNotification.openSnackBar(
      this.translate.instant('MEMBER.LIST.MEMBER_ADDED_SUCCESSFULLY_LABEL'),
      VALIDATION_TYPE,
    );
    this.loadMembers();
  }

  lazyLoadMembers($event: any) {
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
      Object.entries($event.filters).forEach(([field, meta]) => {
        if ((meta as any).value) {
          current[field] = (meta as any).value;
        } else {
          delete current[field];
        }
      });
    }
    this.loadMembers();
  }

  pageChange($event: any) {
    const current: any = { ...this.filter() };
    current.page = $event.first / $event.rows + 1;
    this.filter.set(current);
    this.loadMembers();
  }

  clear(table: any) {
    table.clear();
  }

  onRowClick(member: any) {
    this.router.navigate(['/members/', member.id]);
  }

  seePendingInvite() {
    this.ref = this.dialogService.open(MemberPendingInvite, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('MEMBER.LIST.PENDING_INVITATION_HEADER'),
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
