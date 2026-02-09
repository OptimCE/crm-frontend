import {Component, Input} from '@angular/core';
import {TranslatePipe} from '@ngx-translate/core';
import {CompanyDTO, IndividualDTO} from '../../../../../../../shared/dtos/member.dtos';

@Component({
  selector: 'app-member-view-manager-tab',
  imports: [
    TranslatePipe
  ],
  templateUrl: './member-view-manager-tab.html',
  styleUrl: './member-view-manager-tab.css',
})
export class MemberViewManagerTab {
  @Input() member?: IndividualDTO|CompanyDTO;
}
