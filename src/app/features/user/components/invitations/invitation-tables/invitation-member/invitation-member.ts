import { Component, inject, OnDestroy, signal } from '@angular/core';
import { TableLazyLoadEvent, TableModule, TablePageEvent } from 'primeng/table';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Tag } from 'primeng/tag';
import { Button } from 'primeng/button';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { DatePipe } from '@angular/common';
import { ApiResponse, Pagination } from '../../../../../../core/dtos/api.response';
import {
  UserMemberInvitationDTO,
  UserMemberInvitationQuery,
} from '../../../../../../shared/dtos/invitation.dtos';
import { InvitationService } from '../../../../../../shared/services/invitation.service';
import { EncodeNewMemberComponent } from './dialogs/encode-new-member/encode-new-member.component';
import { CompanyDTO, IndividualDTO } from '../../../../../../shared/dtos/member.dtos';
import { InvitationDetailComponent } from './dialogs/invitation-detail/invitation-detail.component';

@Component({
  selector: 'app-invitation-member',
  imports: [TableModule, TranslatePipe, Tag, Button, DatePipe],
  templateUrl: './invitation-member.html',
  styleUrl: './invitation-member.css',
  providers: [DialogService],
})
export class InvitationMember implements OnDestroy {
  private invitationService = inject(InvitationService);
  private dialogService = inject(DialogService);
  private translate = inject(TranslateService);
  pagination = signal<Pagination>({ page: -1, total: -1, total_pages: -1, limit: -1 });
  invitations = signal<UserMemberInvitationDTO[] | []>([]);
  currentPageReportTemplateDocuments!: string;
  loading = signal<boolean>(false);
  page: number = 1;
  pageInvitation: number = 1;
  ref: DynamicDialogRef | null = null;
  filterMemberInvitation = signal<UserMemberInvitationQuery>({ page: 1, limit: 10 });

  loadMemberInvitation(): void {
    this.loading.set(true);
    this.invitations.set([]);
    this.invitationService.getOwnMembersPendingInviation(this.filterMemberInvitation()).subscribe({
      next: (response: ApiResponse<any>) => {
        if (response && response.data) {
          this.invitations.set(response.data as UserMemberInvitationDTO[]);
        }
        this.loading.set(false);
      },
      error: (error) => {
        console.error(error);
        //TODO: Handle error
        this.loading.set(false);
      },
    });
  }

  lazyLoadMemberInvitation(_$event?: TableLazyLoadEvent): void {
    // Filter here
    this.loadMemberInvitation();
  }

  pageChangeInvitation($event: TablePageEvent): void {
    this.pageInvitation = $event.first / $event.rows + 1;
    this.loadMemberInvitation();
  }

  acceptInvitation(invitation: UserMemberInvitationDTO): void {
    this.invitationService.acceptInvitationMember({ invitation_id: invitation.id }).subscribe({
      next: (response) => {
        if (response) {
          // TODO: Display snackbar
          this.loadMemberInvitation();
        }
      },
      error: (error) => {
        // TODO: Handle error snackbar
        console.error(error);
      },
    });
  }

  refuseInvitation(invitation: UserMemberInvitationDTO): void {
    this.invitationService.refuseMemberInvitation(invitation.id).subscribe({
      next: (response) => {
        if (response) {
          // TODO: Display snackbar
          this.loadMemberInvitation();
        }
      },
      error: (error) => {
        // TODO: Handle error snackbar
        console.error(error);
      },
    });
  }

  fetchDetail(invitation: UserMemberInvitationDTO): void {
    this.invitationService
      .getOwnMemberPendingInvitationById(invitation.id)
      .subscribe((response) => {
        if (response) {
          this.ref = this.dialogService.open(InvitationDetailComponent, {
            header: this.translate.instant('INVITATION.SEE_DETAIL.TITLE') as string,
            modal: true,
            closable: true,
            closeOnEscape: true,
            data: {
              member: response.data,
              member_type: (response.data as IndividualDTO | CompanyDTO).member_type,
            },
          });
        }
      });
  }

  encodeNewMember(invitation: UserMemberInvitationDTO): void {
    this.ref = this.dialogService.open(EncodeNewMemberComponent, {
      header: this.translate.instant('INVITATION.ENCODE_NEW_MEMBER_TITLE') as string,
      modal: true,
      closable: true,
      closeOnEscape: true,
      data: {
        invitationID: invitation.id,
      },
    });
    if (this.ref) {
      this.ref.onClose.subscribe((result) => {
        if (result) {
          this.loadMemberInvitation();
        }
      });
    }
  }
  ngOnDestroy(): void {
    if (this.ref) {
      this.ref.destroy();
    }
  }
}
