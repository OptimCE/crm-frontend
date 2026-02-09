import {Component, OnInit, signal} from '@angular/core';
import {TableLazyLoadEvent, TableModule, TablePageEvent} from "primeng/table";
import {TranslatePipe} from "@ngx-translate/core";
import {Button} from "primeng/button";
import {ApiResponse, Pagination} from '../../../../../../core/dtos/api.response';
import {UserService} from '../../../../../../shared/services/user.service';
import {
  UserManagerInvitationDTO,
  UserManagerInvitationQuery,
  UserMemberInvitationDTO,
  UserMemberInvitationQuery
} from '../../../../../../shared/dtos/invitation.dtos';
import {InvitationService} from '../../../../../../shared/services/invitation.service';
import {DialogService} from 'primeng/dynamicdialog';

@Component({
  selector: 'app-invitation-gestionnaire',
  imports: [
    TableModule,
    TranslatePipe,
    Button
  ],
  templateUrl: './invitation-gestionnaire.html',
  styleUrl: './invitation-gestionnaire.css',
  providers: [DialogService]
})
export class InvitationGestionnaire{
  pagination = signal<Pagination>({page: -1,total: -1,total_pages: -1,limit:-1});
  gestionnaireInvitation= signal<UserManagerInvitationDTO[]|[]>([]);
  currentPageReportTemplateDocuments!: string;
  loadingGestionnaire= signal<boolean>(false);
  filterManagerInvitation = signal<UserManagerInvitationQuery>({page: 1, limit: 10})
  page: number = 1;
  constructor(
    private invitationService: InvitationService,
  ) {}

  loadGestionnaireInvitation(){
    this.loadingGestionnaire.set(true);
    this.gestionnaireInvitation.set([]);
    this.invitationService.getOwnManagerPendingInvitation(this.filterManagerInvitation()).subscribe(
      {
        next:(response)=>
        {
          if (response) {
            this.gestionnaireInvitation.set(response.data as UserManagerInvitationDTO[]);
          }
          this.loadingGestionnaire.set(false);
        },
        error:(error) => {
          console.error(error);
          //TODO: Handle error
          this.loadingGestionnaire.set(false);
        },
      }
    );
  }
  lazyLoadGestionnaireInvitation(_$event?: TableLazyLoadEvent) {
    // Set filters here
    this.loadGestionnaireInvitation();
  }

  pageChangeGestionnaire($event: TablePageEvent) {
    this.page = $event.first / $event.rows + 1;
    this.lazyLoadGestionnaireInvitation($event);
  }


  acceptGestionnaireInvitation(invitation: UserManagerInvitationDTO) {
    this.invitationService.acceptInvitationManager({invitation_id: invitation.id}).subscribe({
      next: (response)=>{
        if(response){
          // TODO: Display snackbar
          this.loadGestionnaireInvitation()
        }
      },
      error:(error) => {
        // TODO: Handle error
        console.error(error);
      }
    })

  }

  refuseGestionnaireInvitation(invitation: UserManagerInvitationDTO) {
    this.invitationService.refuseManagerInvitation(invitation.id).subscribe({
      next: (response)=>{
        if(response){
          // TODO: Display snackbar
          this.loadGestionnaireInvitation()
        }
      },
      error:(error) => {
        // TODO: Handle error
        console.error(error);
      }
    })
  }
}
