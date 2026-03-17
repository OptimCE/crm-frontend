import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
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
import { MeterDataStatus } from '../../../../shared/types/meter.types';
import { Tag } from 'primeng/tag';
import { Skeleton } from 'primeng/skeleton';
import { Card } from 'primeng/card';
import { Avatar } from 'primeng/avatar';
import { AddressPipe } from '../../../../shared/pipes/address/address-pipe';
import { MemberViewTabs } from './member-view-tabs/member-view-tabs';
import { BackArrow } from '../../../../layout/back-arrow/back-arrow';

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
    Dialog,
    TranslatePipe,
    Button,
    Ripple,
    Tag,
    Skeleton,
    Card,
    Avatar,
    AddressPipe,
    MemberViewTabs,
    BackArrow,
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
  private destroyRef = inject(DestroyRef);

  readonly isLoading = signal<boolean>(true);
  readonly hasError = signal<boolean>(false);
  readonly id = signal<number>(0);
  readonly individual = signal<IndividualDTO | undefined>(undefined);
  readonly legalEntity = signal<CompanyDTO | undefined>(undefined);
  readonly member = computed(() => this.individual() ?? this.legalEntity());
  readonly status = computed(() => this.member()?.status);
  readonly membersType = computed(() => this.member()?.member_type);
  readonly metersPartialList = signal<PartialMeterDTO[] | undefined>(undefined);
  readonly individualInvitationLink = signal<MemberLinkDTO | undefined>(undefined);
  readonly managerInvitationLink = signal<MemberLinkDTO | undefined>(undefined);
  readonly individualInvitationStatus = signal<InvitationStatus>(InvitationStatus.LOADING);
  readonly managerInvitationStatus = signal<InvitationStatus>(InvitationStatus.LOADING);
  ref?: DynamicDialogRef | null;
  readonly alertPopupVisible = signal<boolean>(false);
  readonly currentPageReportTemplate = signal<string>('');

  protected readonly memberInitials = computed(() => {
    const ind = this.individual();
    if (ind) return ((ind.first_name?.[0] ?? '') + (ind.name?.[0] ?? '')).toUpperCase() || '?';
    const le = this.legalEntity();
    if (le) return (le.name?.[0] ?? '').toUpperCase() || '?';
    return '?';
  });

  protected readonly manager = computed(
    () => this.individual()?.manager ?? this.legalEntity()?.manager,
  );

  constructor() {
    this.destroyRef.onDestroy(() => this.ref?.destroy());
  }

  ngOnInit(): void {
    this.isLoading.set(true);
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    if (id === '') {
      void this.routing.navigate(['//members/member/']);
      return;
    }
    this.id.set(+id);
    if (this.id()) {
      this.loadMember();
    }
  }

  loadMember(): void {
    this.hasError.set(false);
    this.isLoading.set(true);
    this.memberService.getMember(this.id()).subscribe({
      next: (response) => {
        if (response) {
          const memberData = response.data as IndividualDTO | CompanyDTO;
          if (memberData.member_type === MemberType.INDIVIDUAL) {
            const ind = memberData as IndividualDTO;
            this.individual.set(ind);
            this.legalEntity.set(undefined);
            this.loadInvitationStatusIndividual(ind.id, ind.email);
            if (ind.manager) {
              this.loadInvitationStatusManager(ind.id, ind.manager.email);
            }
          } else if (memberData.member_type === MemberType.COMPANY) {
            const le = memberData as CompanyDTO;
            this.legalEntity.set(le);
            this.individual.set(undefined);
            this.loadInvitationStatusManager(le.id, le.manager.email);
          }
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.hasError.set(true);
        this.isLoading.set(false);
      },
    });
  }

  loadInvitationStatusIndividual(id: number, email: string): void {
    this.individualInvitationStatus.set(InvitationStatus.LOADING);
    this.memberService.getMemberLink(id, { email: email }).subscribe(
      (response) => {
        if (response) {
          const link = response.data as MemberLinkDTO;
          this.individualInvitationLink.set(link);
          switch (link.status) {
            case MemberStatus.ACTIVE:
              this.individualInvitationStatus.set(InvitationStatus.ACCEPTED);
              break;
            case MemberStatus.PENDING:
              this.individualInvitationStatus.set(InvitationStatus.PENDING);
              break;
            case MemberStatus.INACTIVE:
              this.individualInvitationStatus.set(InvitationStatus.NO_INVITE);
              break;
          }
        }
      },
      (_error) => {
        this.individualInvitationStatus.set(InvitationStatus.NO_INVITE);
      },
    );
  }

  loadInvitationStatusManager(id: number, email: string): void {
    this.managerInvitationStatus.set(InvitationStatus.LOADING);
    this.memberService.getMemberLink(id, { email }).subscribe(
      (response) => {
        if (response) {
          const link = response.data as MemberLinkDTO;
          this.managerInvitationLink.set(link);
          switch (link.status) {
            case MemberStatus.ACTIVE:
              this.managerInvitationStatus.set(InvitationStatus.ACCEPTED);
              break;
            case MemberStatus.PENDING:
              this.managerInvitationStatus.set(InvitationStatus.PENDING);
              break;
            case MemberStatus.INACTIVE:
              this.managerInvitationStatus.set(InvitationStatus.NO_INVITE);
              break;
          }
        }
      },
      (_error) => {
        this.managerInvitationStatus.set(InvitationStatus.NO_INVITE);
      },
    );
  }

  toModify(): void {
    this.ref = this.dialogService.open(MemberCreationUpdate, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('MEMBER.VIEW.UPDATE_A_MEMBER_HEADER') as string,
      data: {
        member: this.individual() || this.legalEntity(),
      },
    });
    if (this.ref) {
      this.ref.onClose.subscribe((response) => {
        if (response) {
          this.snackbar.openSnackBar(
            this.translate.instant('MEMBER.VIEW.MEMBER_UPDATE_SUCCESSFULLY_LABEL') as string,
            VALIDATION_TYPE,
          );
          this.loadMember();
        }
      });
    }
  }

  setStatus(status: number): void {
    if (this.status() === MemberStatus.ACTIVE) {
      let found = false;
      const meters = this.metersPartialList();
      if (meters && meters.length > 0) {
        // Check if there is something else than inactif
        for (const meter of meters) {
          if (meter.status !== MeterDataStatus.INACTIVE) {
            found = true;
            break;
          }
        }
        if (found) {
          this.alertPopupVisible.set(true);
          return;
        }
      }
    }
    this.memberService
      .patchMemberStatus({ status: status, id_member: this.id() })
      .subscribe((response) => {
        if (response) {
          this.snackbar.openSnackBar(
            this.translate.instant('MEMBER.VIEW.MEMBER_STATUS_UPDATE_SUCCESSFULLY_LABEL') as string,
            VALIDATION_TYPE,
          );
          this.loadMember();
        }
      });
  }

  invite(manager = false): void {
    let email: string | undefined;
    if (manager) {
      email = this.individual()
        ? this.individual()?.manager?.email
        : this.legalEntity()?.manager.email;
    } else {
      email = this.individual()?.email;
    }
    const id = this.individual()?.id ?? this.legalEntity()?.id;
    if (id && email) {
      this.memberService
        .patchMemberLink({ id_member: id, user_email: email })
        .subscribe((response) => {
          if (response) {
            if (manager) {
              this.loadInvitationStatusManager(id, email);
            } else {
              this.loadInvitationStatusIndividual(id, email);
            }
          }
        });
    }
  }

  cancel(memberLink: MemberLinkDTO, manager = false): void {
    let email;
    if (manager) {
      email = this.individual()
        ? this.individual()?.manager?.email
        : this.legalEntity()?.manager.email;
    } else {
      email = this.individual()?.email;
    }
    const id = this.individual()?.id ?? this.legalEntity()?.id;
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
  delete(memberLink: MemberLinkDTO, manager = false): void {
    let email: string | undefined;
    if (manager) {
      email = this.individual()
        ? this.individual()?.manager?.email
        : this.legalEntity()?.manager.email;
    } else {
      email = this.individual()?.email;
    }
    const id = this.individual()?.id ?? this.legalEntity()?.id;
    const memberLinkId = memberLink.id;
    if (id && email && memberLinkId) {
      this.memberService.deleteMemberLink(id).subscribe((response) => {
        if (response) {
          if (manager) {
            this.loadInvitationStatusManager(id, email);
          } else {
            this.loadInvitationStatusIndividual(id, email);
          }
        }
      });
    }
  }

  protected readonly MemberType = MemberType;
  protected readonly MemberStatus = MemberStatus;
  protected readonly InvitationStatus = InvitationStatus;
}
