import {Component, inject, OnInit, signal} from '@angular/core';
import { ProgressSpinner } from 'primeng/progressspinner';
import { Dialog } from 'primeng/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Ripple } from 'primeng/ripple';
import { CompanyDTO, IndividualDTO, MemberLinkDTO } from '../../../../shared/dtos/member.dtos';
import { PartialMeterDTO } from '../../../../shared/dtos/meter.dtos';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ActivatedRoute, Router } from '@angular/router';
import { MemberService } from '../../../../shared/services/member.service';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { MemberCreationUpdate } from '../member-creation-update/member-creation-update';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { InvitationService } from '../../../../shared/services/invitation.service';
import { MemberStatus, MemberType } from '../../../../shared/types/member.types';
import { Tag } from 'primeng/tag';
import { Divider } from 'primeng/divider';
import { Checkbox } from 'primeng/checkbox';
import { AddressPipe } from '../../../../shared/pipes/address/address-pipe';
import { MemberViewTabs } from './member-view-tabs/member-view-tabs';
import { FormsModule } from '@angular/forms';

enum InvitationStatus {
  LOADING = 0,
  ACCEPTED = 1,
  PENDING = 2,
  NO_INVITE = 3,
}
@Component({
  selector: 'app-member-view',
  standalone: true,
  imports: [
    ProgressSpinner,
    Dialog,
    TranslatePipe,
    Button,
    Ripple,
    Tag,
    Divider,
    Checkbox,
    AddressPipe,
    MemberViewTabs,
    FormsModule,
  ],
  templateUrl: './member-view.html',
  styleUrl: './member-view.css',
  providers: [DialogService],
})
export class MemberView implements OnInit {
  private route = inject(ActivatedRoute);
  private memberService = inject(MemberService);
  private invitationService = inject(InvitationService);
  private routing = inject(Router);
  private dialogService = inject(DialogService);
  private snackbar = inject(SnackbarNotification);
  private translate = inject(TranslateService);
  isLoading = signal<boolean>(true);
  id!: number;
  individual?: IndividualDTO;
  legalEntity?: CompanyDTO;
  member?: IndividualDTO | CompanyDTO;
  status?: number;
  membersType?: number;
  metersPartialList?: PartialMeterDTO[];
  individualInvitationLink?: MemberLinkDTO;
  managerInvitationLink?: MemberLinkDTO;
  individualInvitationStatus: InvitationStatus = InvitationStatus.LOADING;
  managerInvitationStatus: InvitationStatus = InvitationStatus.LOADING;
  ref?: DynamicDialogRef | null;
  alertPopupVisible: boolean = false;
  currentPageReportTemplate: string = '';


  ngOnInit(): void {
    this.isLoading.set(true);
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    if (id === '') {
      this.routing.navigate(['//members/member/']);
      return;
    }
    this.id = +id;
    if (this.id) {
      this.loadMember();
    }
  }

  loadMember() {
    this.memberService.getMember(this.id).subscribe((response) => {
      if (response) {
        if ((response.data as IndividualDTO | CompanyDTO).member_type === 1) {
          this.individual = response.data as IndividualDTO;
          this.member = response.data as IndividualDTO;
          this.membersType = 1;
          this.status = this.individual.status;
          this.loadInvitationStatusIndividual(this.individual.id, this.individual.email);
          if (this.individual.manager) {
            this.loadInvitationStatusManager(this.individual.id, this.individual.manager.email);
          }
        } else if ((response.data as IndividualDTO | CompanyDTO).member_type === 2) {
          this.legalEntity = response.data as CompanyDTO;
          this.member = response.data as CompanyDTO;
          this.membersType = 2;
          this.status = this.legalEntity.status;
          this.loadInvitationStatusManager(this.legalEntity.id, this.legalEntity.manager.email);
        }
      }
      this.isLoading.set(false);
    });
  }

  loadInvitationStatusIndividual(id: number, email: string) {
    this.individualInvitationStatus = InvitationStatus.LOADING;
    this.memberService.getMemberLink(id, { email: email }).subscribe(
      (response) => {
        if (response) {
          this.individualInvitationLink = response.data as MemberLinkDTO;
          switch (this.individualInvitationLink.status) {
            case MemberStatus.ACTIVE:
              this.individualInvitationStatus = InvitationStatus.ACCEPTED;
              break;
            case MemberStatus.PENDING:
              this.individualInvitationStatus = InvitationStatus.PENDING;
              break;
            case MemberStatus.INACTIVE:
              this.individualInvitationStatus = InvitationStatus.NO_INVITE;
              break;
          }
        }
      },
      (_error) => {
        this.individualInvitationStatus = InvitationStatus.NO_INVITE;
      },
    );
  }

  loadInvitationStatusManager(id: number, email: string) {
    this.managerInvitationStatus = InvitationStatus.LOADING;
    this.memberService.getMemberLink(id, { email }).subscribe(
      (response) => {
        if (response) {
          this.managerInvitationLink = response.data as MemberLinkDTO;
          switch (this.managerInvitationLink.status) {
            case MemberStatus.ACTIVE:
              this.managerInvitationStatus = InvitationStatus.ACCEPTED;
              break;
            case MemberStatus.PENDING:
              this.managerInvitationStatus = InvitationStatus.PENDING;
              break;
            case MemberStatus.INACTIVE:
              this.managerInvitationStatus = InvitationStatus.NO_INVITE;
              break;
          }
        }
      },
      (_error) => {
        this.managerInvitationStatus = InvitationStatus.NO_INVITE;
      },
    );
  }

  toModify() {
    this.ref = this.dialogService.open(MemberCreationUpdate, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('MEMBER.VIEW.UPDATE_A_MEMBER_HEADER'),
      data: {
        member: this.individual || this.legalEntity,
      },
    });
    if (this.ref) {
      this.ref.onClose.subscribe((response) => {
        if (response) {
          this.snackbar.openSnackBar(
            this.translate.instant('MEMBER.VIEW.MEMBER_UPDATE_SUCCESSFULLY_LABEL'),
            VALIDATION_TYPE,
          );
          this.loadMember();
        }
      });
    }
  }

  setStatus(status: number) {
    if (this.status === 1) {
      let found = false;
      if (this.metersPartialList && this.metersPartialList.length > 0) {
        // Check if there is something else than inactif
        for (const meter of this.metersPartialList) {
          if (meter.status !== 2) {
            found = true;
            break;
          }
        }
        if (found) {
          this.alertPopupVisible = true;
          return;
        }
      }
    }
    this.memberService
      .patchMemberStatus({ status: status, id_member: this.id })
      .subscribe((response) => {
        if (response) {
          this.snackbar.openSnackBar(
            this.translate.instant('MEMBER.VIEW.MEMBER_STATUS_UPDATE_SUCCESSFULLY_LABEL'),
            VALIDATION_TYPE,
          );
          this.loadMember();
        }
      });
  }

  invite(manager = false) {
    let email;
    if (manager) {
      email = this.individual ? this.individual?.manager?.email : this.legalEntity?.manager.email;
    } else {
      email = this.individual?.email;
    }
    const id = this.individual ? this.individual.id : this.legalEntity?.id;
    this.memberService
      .patchMemberLink({ id_member: id!, user_email: email as string })
      .subscribe((response) => {
        if (response) {
          if (manager) {
            this.loadInvitationStatusManager(id as number, email as string);
          } else {
            this.loadInvitationStatusIndividual(id as number, email as string);
          }
        }
      });
  }

  cancel(memberLink: MemberLinkDTO, manager = false) {
    let email;
    if (manager) {
      email = this.individual ? this.individual?.manager?.email : this.legalEntity?.manager.email;
    } else {
      email = this.individual?.email;
    }
    const id = this.individual ? this.individual.id : this.legalEntity?.id;
    if (memberLink.id) {
      this.invitationService.cancelMemberInvitation(memberLink.id).subscribe((response) => {
        if (response) {
          if (manager) {
            this.loadInvitationStatusManager(id as number, email as string);
          } else {
            this.loadInvitationStatusIndividual(id as number, email as string);
          }
        }
      });
    }
  }
  delete(memberLink: MemberLinkDTO, manager = false) {
    let email;
    if (manager) {
      email = this.individual ? this.individual?.manager?.email : this.legalEntity?.manager.email;
    } else {
      email = this.individual?.email;
    }
    const id = this.individual ? this.individual.id : this.legalEntity?.id;
    this.memberService.deleteMemberLink(memberLink.id!).subscribe((response) => {
      if (response) {
        if (manager) {
          this.loadInvitationStatusManager(id as number, email as string);
        } else {
          this.loadInvitationStatusIndividual(id as number, email as string);
        }
      }
    });
  }

  protected readonly MemberType = MemberType;
  protected readonly MemberStatus = MemberStatus;
  protected readonly InvitationStatus = InvitationStatus;
}
