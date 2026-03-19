import { Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { CompanyDTO, IndividualDTO } from '../../../../../../../shared/dtos/member.dtos';

@Component({
  selector: 'app-member-view-banking-info-tab',
  imports: [TranslatePipe, Button, Tooltip],
  templateUrl: './member-view-banking-info-tab.html',
  styleUrl: './member-view-banking-info-tab.css',
})
export class MemberViewBankingInfoTab {
  readonly member = input<IndividualDTO | CompanyDTO>();

  copyIban(): void {
    const iban = this.member()?.iban;
    if (iban) {
      void navigator.clipboard.writeText(iban);
    }
  }
}
