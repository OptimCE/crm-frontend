import { Component, inject, OnInit, signal } from '@angular/core';
import { AddressPipe } from '../../../../../../../../shared/pipes/address/address-pipe';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { DividerModule } from 'primeng/divider';
import { TagModule } from 'primeng/tag';
import { TranslatePipe } from '@ngx-translate/core';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { FormsModule } from '@angular/forms';
import { CompanyDTO, IndividualDTO } from '../../../../../../../../shared/dtos/member.dtos';
import { MemberType } from '../../../../../../../../shared/types/member.types';
import { DynamicDialogConfig } from 'primeng/dynamicdialog';

interface InvitationDetailDialogData {
  member: IndividualDTO | CompanyDTO;
  member_type: MemberType;
}

@Component({
  selector: 'app-invitation-detail',
  imports: [
    AddressPipe,
    CheckboxModule,
    DialogModule,
    DividerModule,
    TagModule,
    TranslatePipe,
    ProgressSpinnerModule,
    FormsModule,
  ],
  templateUrl: './invitation-detail.component.html',
  styleUrl: './invitation-detail.component.css',
})
export class InvitationDetailComponent implements OnInit {
  private config = inject(DynamicDialogConfig);
  readonly isLoading = signal<boolean>(true);
  readonly individual = signal<IndividualDTO | undefined>(undefined);
  readonly legalEntity = signal<CompanyDTO | undefined>(undefined);
  readonly membersType = signal<MemberType | undefined>(undefined);

  ngOnInit(): void {
    const data = this.config.data as InvitationDetailDialogData;
    if (data && data.member && data.member_type) {
      this.membersType.set(data.member_type);
      if (this.membersType() === MemberType.INDIVIDUAL) {
        this.individual.set(data.member as IndividualDTO);
      } else {
        this.legalEntity.set(data.member as CompanyDTO);
      }
      this.isLoading.set(false);
    }
  }

  protected readonly MemberType = MemberType;
}
