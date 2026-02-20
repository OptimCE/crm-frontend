import { Component, inject, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { PrimeTemplate } from 'primeng/api';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiResponse } from '../../../../../core/dtos/api.response';
import {
  UserMemberInvitationDTO,
  UserMemberInvitationQuery,
} from '../../../../../shared/dtos/invitation.dtos';
import { ErrorMessageHandler } from '../../../../../shared/services-ui/error.message.handler';
import { InvitationService } from '../../../../../shared/services/invitation.service';

@Component({
  selector: 'app-pending-member-invitation',
  imports: [Button, PrimeTemplate, TableModule, Tag, TranslatePipe],
  templateUrl: './pending-member-invitation.html',
  styleUrl: './pending-member-invitation.css',
})
export class PendingMemberInvitation {
  private invitationService = inject(InvitationService);
  private errorHandler = inject(ErrorMessageHandler);
  pendingMembresInvitation = signal<UserMemberInvitationDTO[]>([]);
  loadingMembers = true;
  filter = signal<UserMemberInvitationQuery>({ page: 1, limit: 10 });

  loadPendingMemberInvitation(): void {
    this.loadingMembers = true;
    this.invitationService.getMembersPendingInviation(this.filter()).subscribe({
      next: (response) => {
        if (response) {
          this.pendingMembresInvitation.set(response.data as UserMemberInvitationDTO[]);
        } else {
          this.errorHandler.handleError(response);
        }
        this.loadingMembers = false;
      },
      error: (error) => {
        this.errorHandler.handleError(error);
        this.loadingMembers = false;
      },
    });
  }
  lazyLoadPendingMemberInvitation($event: TableLazyLoadEvent): void {
    const current: UserMemberInvitationQuery = { ...this.filter() };
    if ($event.sortField) {
      const sortDirection = $event.sortOrder === 1 ? 'ASC' : 'DESC';
      delete current.sort_email;
      delete current.sort_name;
      switch ($event.sortField) {
        case 'email': {
          current.sort_email = sortDirection;
          break;
        }
        case 'name': {
          current.sort_name = sortDirection;
          break;
        }
      }
    }
    this.filter.set(current);
    this.loadPendingMemberInvitation();
  }

  cancelMemberInvitation(invitation: UserMemberInvitationDTO): void {
    this.invitationService.cancelMemberInvitation(invitation.id).subscribe({
      next: (response) => {
        if (response) {
          this.loadPendingMemberInvitation();
        } else {
          this.errorHandler.handleError();
        }
      },
      error: (error: unknown) => {
        const errorData = error instanceof ApiResponse ? (error.data as string) : null;
        this.errorHandler.handleError(errorData);
      },
    });
  }
}
