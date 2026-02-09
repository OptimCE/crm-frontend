import {Component, OnDestroy, signal} from '@angular/core';
import {TableLazyLoadEvent, TableModule, TablePageEvent} from "primeng/table";
import {TranslatePipe, TranslateService} from "@ngx-translate/core";
import {Tag} from "primeng/tag";
import {Button} from "primeng/button";
import {DialogService, DynamicDialogRef} from "primeng/dynamicdialog";
import {DatePipe} from "@angular/common";
import {ApiResponse, Pagination} from '../../../../../../core/dtos/api.response';
import {UserMemberInvitationDTO, UserMemberInvitationQuery} from '../../../../../../shared/dtos/invitation.dtos';
import {InvitationService} from '../../../../../../shared/services/invitation.service';

@Component({
  selector: 'app-invitation-member',
  imports: [
    TableModule,
    TranslatePipe,
    Tag,
    Button,
    DatePipe
  ],
  templateUrl: './invitation-member.html',
  styleUrl: './invitation-member.css',
  providers: [DialogService]
})
export class InvitationMember implements OnDestroy{
  pagination = signal<Pagination>({page: -1,total: -1,total_pages: -1,limit:-1});
  invitations = signal<UserMemberInvitationDTO[]|[]>([]);
  currentPageReportTemplateDocuments!: string;
  loading= signal<boolean>(false);
  page: number = 1;
  pageInvitation: number = 1;
  ref: DynamicDialogRef | null = null;
  filterMemberInvitation = signal<UserMemberInvitationQuery>({page: 1, limit: 10})
  constructor(
    private invitationService: InvitationService,
    private dialogService: DialogService,
    private translate: TranslateService,
  ) {}

  loadMemberInvitation(){
    this.loading.set(true);
    this.invitations.set([]);
    this.invitationService.getOwnMembersPendingInviation(this.filterMemberInvitation()).subscribe(
      {
        next:(response: ApiResponse<any>)=>
        {
          if (response && response.data) {
            this.invitations.set(response.data as UserMemberInvitationDTO[]);
          }
          this.loading.set(false);
        },
        error:(error) => {
          console.error(error);
          //TODO: Handle error
          this.loading.set(false);
        },
      }
    );
  }

  lazyLoadMemberInvitation(_$event?: TableLazyLoadEvent) {
    // Filter here
    this.loadMemberInvitation();
  }


  pageChangeInvitation($event: TablePageEvent) {
    this.pageInvitation = $event.first / $event.rows + 1;
    this.loadMemberInvitation();
  }

  acceptInvitation(invitation: UserMemberInvitationDTO) {
    this.invitationService.acceptInvitationMember({invitation_id: invitation.id}).subscribe({
      next: (response)=>{
        if (response) {
          // TODO: Display snackbar
          this.loadMemberInvitation();
        }
      },
      error:(error) => {
        // TODO: Handle error snackbar
        console.error(error);
      }
    });
  }

  refuseInvitation(invitation: UserMemberInvitationDTO) {
    this.invitationService.refuseMemberInvitation(invitation.id).subscribe({
      next: (response)=>{
        if (response) {
          // TODO: Display snackbar
          this.loadMemberInvitation();
        }
      },
      error:(error) => {
        // TODO: Handle error snackbar
        console.error(error);
      }
    });
  }


  fetchDetail(invitation: UserMemberInvitationDTO) {
    // this.userService.getInvitationDetailById(invitation.id).subscribe((response) => {
    //   if (response && response.success) {
    //     this.translate.get('invitation.invitation_detail').subscribe((translation) => {
    //       this.ref = this.dialogService.open(InvitationDetailComponent, {
    //         header: translation,
    //         modal: true,
    //         closable: true,
    //         closeOnEscape: true,
    //         data: {
    //           member: response.data,
    //           member_type: (response.data as IndividualsDTO | LegalEntitiesDTO).member_type,
    //         },
    //       });
    //     });
    //   }
    // });
  }

  encodeNewMember(invitation: UserMemberInvitationDTO) {
    // this.translate.get('invitation.encode_new_member').subscribe((translation) => {
    //   this.ref = this.dialogService.open(EncodeNewMemberComponent, {
    //     header: translation,
    //     modal: true,
    //     closable: true,
    //     closeOnEscape: true,
    //     data: {
    //       invitationID: invitation.id,
    //     },
    //   });
    //   if(this.ref){
    //     this.ref.onClose.subscribe((result) => {
    //       if (result) {
    //         this.loadMemberInvitation();
    //       }
    //     });
    //   }
    //
    // });
  }
  ngOnDestroy(): void {
    if(this.ref){
      this.ref.destroy();
    }
  }
}
