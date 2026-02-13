import { Component, Input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CompanyDTO, IndividualDTO } from '../../../../../../../shared/dtos/member.dtos';

@Component({
  selector: 'app-member-view-banking-info-tab',
  imports: [TranslatePipe],
  templateUrl: './member-view-banking-info-tab.html',
  styleUrl: './member-view-banking-info-tab.css',
})
export class MemberViewBankingInfoTab {
  @Input() member?: IndividualDTO | CompanyDTO;
}
