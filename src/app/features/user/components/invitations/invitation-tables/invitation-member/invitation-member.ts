import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { EncodeNewMemberSelfComponent } from './dialogs/encode-new-member/encode-new-member-self.component';
import { CompanyDTO, IndividualDTO } from '../../../../../../shared/dtos/member.dtos';
import { InvitationDetailComponent } from './dialogs/invitation-detail/invitation-detail.component';
import { MeService } from '../../../../../../shared/services/me.service';

@Component({
  selector: 'app-invitation-member',
  imports: [TableModule, TranslatePipe, Tag, Button, DatePipe],
  templateUrl: './invitation-member.html',
  styleUrl: './invitation-member.css',
  providers: [DialogService],
})
export class InvitationMember {
  private invitationService = inject(InvitationService);
  private meService = inject(MeService);
  private dialogService = inject(DialogService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  readonly pagination = signal<Pagination>({ page: -1, total: -1, total_pages: -1, limit: -1 });
  readonly invitations = signal<UserMemberInvitationDTO[] | []>([]);
  readonly currentPageReportTemplateDocuments = signal<string>('');
  readonly loading = signal<boolean>(false);
  readonly page = signal<number>(1);
  readonly pageInvitation = signal<number>(1);
  private ref: DynamicDialogRef | null = null;
  readonly filterMemberInvitation = signal<UserMemberInvitationQuery>({ page: 1, limit: 10 });

  constructor() {
    this.destroyRef.onDestroy(() => this.ref?.destroy());
  }

  loadMemberInvitation(): void {
    this.loading.set(true);
    this.invitations.set([]);
    this.meService
      .getOwnMembersPendingInviation(this.filterMemberInvitation())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: ApiResponse<UserMemberInvitationDTO[] | string>) => {
          if (response && response.data) {
            this.invitations.set(response.data as UserMemberInvitationDTO[]);
          }
          this.loading.set(false);
        },
        error: (error: unknown) => {
          console.error(error);
          this.loading.set(false);
        },
      });
  }

  lazyLoadMemberInvitation(_$event?: TableLazyLoadEvent): void {
    // Filter here
    this.loadMemberInvitation();
  }

  pageChangeInvitation($event: TablePageEvent): void {
    this.pageInvitation.set($event.first / $event.rows + 1);
    this.loadMemberInvitation();
  }

  acceptInvitation(invitation: UserMemberInvitationDTO): void {
    this.meService
      .acceptInvitationMember({ invitation_id: invitation.id })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response) {
            this.loadMemberInvitation();
          }
        },
        error: (error: unknown) => {
          console.error(error);
        },
      });
  }

  refuseInvitation(invitation: UserMemberInvitationDTO): void {
    this.meService
      .refuseMemberInvitation(invitation.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response) {
            this.loadMemberInvitation();
          }
        },
        error: (error: unknown) => {
          console.error(error);
        },
      });
  }

  fetchDetail(invitation: UserMemberInvitationDTO): void {
    this.meService
      .getOwnMemberPendingInvitationById(invitation.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response: ApiResponse<IndividualDTO | CompanyDTO | string>) => {
        if (response && response.data) {
          const data = response.data as IndividualDTO | CompanyDTO;
          this.ref = this.dialogService.open(InvitationDetailComponent, {
            header: this.translate.instant('INVITATION.MEMBER.SEE_DETAIL.TITLE') as string,
            modal: true,
            closable: true,
            closeOnEscape: true,
            data: {
              member: data,
              member_type: data.member_type,
            },
          });
        }
      });
  }

  encodeNewMember(invitation: UserMemberInvitationDTO): void {
    this.ref = this.dialogService.open(EncodeNewMemberSelfComponent, {
      header: this.translate.instant('INVITATION.ENCODE_NEW_MEMBER_TITLE') as string,
      modal: true,
      closable: true,
      closeOnEscape: true,
      data: {
        invitationID: invitation.id,
      },
    });
    this.ref?.onClose.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result: boolean) => {
      if (result) {
        this.loadMemberInvitation();
      }
    });
  }
}
