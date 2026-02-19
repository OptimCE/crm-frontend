import { Component, inject, signal } from '@angular/core';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { ErrorMessageHandler } from '../../../../../shared/services-ui/error.message.handler';
import {
  UserManagerInvitationDTO,
  UserManagerInvitationQuery,
} from '../../../../../shared/dtos/invitation.dtos';
import { InvitationService } from '../../../../../shared/services/invitation.service';

@Component({
  selector: 'app-pending-manager-invitation',
  imports: [TableModule, TranslatePipe, Button],
  templateUrl: './pending-manager-invitation.html',
  styleUrl: './pending-manager-invitation.css',
})
export class PendingManagerInvitation {
  private invitationService = inject(InvitationService);
  private errorHandler = inject(ErrorMessageHandler);
  pendingGestionnaireInvitation = signal<UserManagerInvitationDTO[]>([]);
  filter = signal<UserManagerInvitationQuery>({ page: 1, limit: 10 });
  loadingGestionnaire = true;

  loadPendingGestionnaireInvitation() {
    this.loadingGestionnaire = true;
    this.invitationService.getManagerPendingInvitation(this.filter()).subscribe({
      next: (response) => {
        if (response) {
          this.pendingGestionnaireInvitation.set(response.data as UserManagerInvitationDTO[]);
        } else {
          this.errorHandler.handleError(response);
        }
        this.loadingGestionnaire = false;
      },
      error: (error) => {
        this.errorHandler.handleError(error);
        this.loadingGestionnaire = false;
      },
    });
  }
  lazyLoadPendingGestionnaireInvitation($event: TableLazyLoadEvent) {
    const current: any = { ...this.filter() };
    if ($event.sortField) {
      const sortDirection = $event.sortOrder === 1 ? 'ASC' : 'DESC';
      delete current.sort_email;
      switch ($event.sortField) {
        case 'email': {
          current.sort_email = sortDirection;
          break;
        }
      }
    }
    this.filter.set(current);
    this.loadPendingGestionnaireInvitation();
  }

  cancelInvitation(invitation: UserManagerInvitationDTO) {
    this.invitationService.cancelManagerInvitation(invitation.id).subscribe({
      next: (response) => {
        if (response) {
          this.loadPendingGestionnaireInvitation();
        } else {
          this.errorHandler.handleError(response);
        }
      },
      error: (error) => {
        this.errorHandler.handleError(error);
      },
    });
  }
}
