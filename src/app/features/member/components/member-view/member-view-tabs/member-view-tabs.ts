import {Component, Input} from '@angular/core';
import {Tab, TabList, TabPanel, TabPanels, Tabs} from 'primeng/tabs';
import {MemberViewMeterTab} from './tabs/member-view-meter-tab/member-view-meter-tab';
import {MemberViewBankingInfoTab} from './tabs/member-view-banking-info-tab/member-view-banking-info-tab';
import {MemberViewDocumentsTab} from './tabs/member-view-documents-tab/member-view-documents-tab';
import {MemberViewManagerTab} from './tabs/member-view-manager-tab/member-view-manager-tab';
import {CompanyDTO, IndividualDTO} from '../../../../../shared/dtos/member.dtos';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
  selector: 'app-member-view-tabs',
  imports: [
    Tabs,
    TabList,
    TabPanels,
    TabPanel,
    Tab,
    MemberViewMeterTab,
    MemberViewBankingInfoTab,
    MemberViewDocumentsTab,
    MemberViewManagerTab,
    TranslatePipe
  ],
  templateUrl: './member-view-tabs.html',
  styleUrl: './member-view-tabs.css',
})
export class MemberViewTabs {
  @Input() id!: number;
  @Input() member!: IndividualDTO|CompanyDTO
}
