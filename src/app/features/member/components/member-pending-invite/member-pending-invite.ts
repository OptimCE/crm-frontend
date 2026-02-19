import { Component, inject, signal } from '@angular/core';
import { Tag, TagModule } from 'primeng/tag';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import {
  UserMemberInvitationDTO,
  UserMemberInvitationQuery,
} from '../../../../shared/dtos/invitation.dtos';
import { InvitationService } from '../../../../shared/services/invitation.service';

@Component({
  selector: 'app-member-pending-invite',
  standalone: true,
  imports: [Tag, TranslatePipe, Button, TableModule, TagModule],
  templateUrl: './member-pending-invite.html',
  styleUrl: './member-pending-invite.css',
})
export class MemberPendingInvite {
  private invitationService = inject(InvitationService);
  pendingMembresInvitation = signal<UserMemberInvitationDTO[]>([]);
  filter = signal<UserMemberInvitationQuery>({ page: 1, limit: 10 });
  loadingMembers = true;

  loadPendingMemberInvitation() {
    this.loadingMembers = true;
    this.invitationService.getMembersPendingInviation(this.filter()).subscribe({
      next: (response) => {
        if (response) {
          this.pendingMembresInvitation.set(response.data as UserMemberInvitationDTO[]);
        } else {
          console.error(response);
        }
        this.loadingMembers = false;
      },
      error: (error) => {
        console.error(error);
        this.loadingMembers = false;
      },
    });
  }
  lazyLoadPendingMemberInvitation($event: TableLazyLoadEvent) {
    const current: any = { ...this.filter() };
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
    this.loadPendingMemberInvitation();
  }

  cancelMemberInvitation(invitation: UserMemberInvitationDTO) {
    this.invitationService.cancelMemberInvitation(invitation.id).subscribe({
      next: (response) => {
        if (response) {
          this.loadPendingMemberInvitation();
        } else {
          console.error(response);
        }
      },
      error: (error) => {
        console.error(error);
      },
    });
  }
}
