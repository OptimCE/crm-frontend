import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Button } from 'primeng/button';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Tooltip } from 'primeng/tooltip';
import { Tag } from 'primeng/tag';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { CommunityQueryDTO, MyCommunityDTO } from '../../../../shared/dtos/community.dtos';
import { CommunityService } from '../../../../shared/services/community.service';
import { ConfirmationService, MessageService } from 'primeng/api';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { CommunityDialog } from './community-dialog/community-dialog';

@Component({
  selector: 'app-user-communities',
  imports: [Toast, ConfirmDialog, Button, TranslatePipe, Tooltip, Tag, TableModule],
  templateUrl: './user-communities.html',
  styleUrl: './user-communities.css',
  providers: [DialogService, ConfirmationService, MessageService],
})
export class UserCommunities implements OnInit, OnDestroy {
  private communityService = inject(CommunityService);
  protected userContextService = inject(UserContextService);
  private dialogService = inject(DialogService);
  private translate = inject(TranslateService);
  communities = signal<MyCommunityDTO[]>([]);
  filter = signal<CommunityQueryDTO>({ page: 1, limit: 10 });
  // communityID = 0;
  // protected activeGroup = signal<string|null>(null)
  ref?: DynamicDialogRef | null;


  ngOnInit(): void {
    this.fetchCurrentCommunityId();
  }

  fetchCurrentCommunityId() {
    // this.activeGroup.set(this.userContextService.activeCommunityId())
  }

  loadCommunities() {
    this.communityService.getMyCommunities(this.filter()).subscribe({
      next: (response) => {
        if (response) {
          this.communities.set(response.data as MyCommunityDTO[]);
        } else {
          // this.errorHandler.handleError(response);
        }
      },
      error: (_error) => {
        // this.errorHandler.handleError(error);
      },
    });
  }

  lazyLoadCommunities($event: TableLazyLoadEvent) {
    const current: any = { ...this.filter() };
    if ($event.sortField) {
      const sortDirection = $event.sortOrder === 1 ? 'ASC' : 'DESC';
      delete current.sort_name;
      switch ($event.sortField) {
        case 'name': {
          current.sort_name = sortDirection;
          break;
        }
      }
    }

    this.loadCommunities();
  }

  joinCommunity(community: MyCommunityDTO) {
    this.userContextService.switchCommunity(community.auth_community_id);
    console.log('SWITCHED');
    console.log(this.userContextService.activeCommunityId());
    console.log(this.userContextService.activeCommunityRole());
    // this.communityService.getAuthorize(community.id_community).subscribe(
    //   {
    //     next: async(response)=>
    //     {
    //       if (response && response.success) {
    //         this.authService.fetchWhoamiDataWReturn().then(() => {
    //           this.fetchCurrentCommunityId();
    //         });
    //         // Send notification and refresh user view
    //         this.snackbar.openSnackBar(this.translate.instant('success.community_joined', {name: community.community_name}), VALIDATION_TYPE);
    //       } else {
    //         this.errorHandler.handleError(response);
    //       }
    //     },
    //     error:(error) => {
    //       this.errorHandler.handleError(error);
    //     },
    //   }
    // );
  }

  updateNameCommunity(_community: MyCommunityDTO) {
    // this.ref = this.dialogService.open(CommunityUpdateComponent, {
    //   modal: true,
    //   closable: true,
    //   closeOnEscape: true,
    //   header: this.translate.instant('update_community.title'),
    // });
    // this.ref.onClose.subscribe((newName) => {
    //   if (newName) {
    //     this.communityService.update(new CommunityDTO(community.id_community, newName)).subscribe(
    //       {
    //         next:(response)=>
    //         {
    //           if (response && response.success) {
    //             this.loadCommunities();
    //           } else {
    //             this.errorHandler.handleError(response);
    //           }
    //         },
    //         error:(error) => {
    //           this.errorHandler.handleError(error);
    //         },
    //       }
    //     );
    //   }
    // });
  }

  createCommunity() {
    this.ref = this.dialogService.open(CommunityDialog, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('COMMUNITY.CREATE.TITLE'),
    });
    this.ref?.onClose.subscribe((result) => {
      if (result) {
        this.loadCommunities();
      }
    });
  }

  leaveCommunity(_event: Event, _community: any) {
    // this.communityService.leaveCommunity(new LeaveCommunity(community.id_community, false)).subscribe(
    //   {
    //     next: (response)=>
    //     {
    //       if (response && response.success) {
    //         this.fetchCurrentCommunityId();
    //         this.loadCommunities();
    //       } else {
    //         if (response.error_code === 11111) {
    //           // Display confirm
    //           this.confirmationService.confirm({
    //             target: event.target as EventTarget,
    //             message: this.translate.instant('success.community_will_be_deleted'),
    //             header: this.translate.instant('success.confirmation'),
    //             icon: 'pi pi-exclamation-triangle',
    //             acceptIcon: 'none',
    //             rejectIcon: 'none',
    //             acceptLabel: this.translate.instant('shared.yes'),
    //             rejectLabel: this.translate.instant('shared.no'),
    //             rejectButtonStyleClass: 'p-button-text',
    //             accept: () => {
    //               this.communityService.leaveCommunity(new LeaveCommunity(community.id, false)).subscribe(
    //                 {
    //                   next: (response) => {
    //                     if (response && response.success) {
    //                       this.fetchCurrentCommunityId();
    //                       this.loadCommunities();
    //                     } else {
    //                       this.errorHandler.handleError(response);
    //                     }
    //                   },
    //                   error: (error) => {
    //                     this.errorHandler.handleError(error);
    //                   },
    //                 }
    //               );
    //             },
    //             reject: () => {
    //               this.messageService.add({
    //                 severity: 'error',
    //                 summary: this.translate.instant('success.rejected'),
    //                 detail: this.translate.instant('success.you_have_rejected'),
    //                 life: 3000
    //               });
    //             },
    //           });
    //         } else {
    //           this.errorHandler.handleError(response);
    //         }
    //       }
    //     },
    //     error:(error) => {
    //       this.errorHandler.handleError(error);
    //     },
    //   }
    // );
  }

  ngOnDestroy(): void {
    if (this.ref) {
      this.ref.destroy();
    }
  }
}
