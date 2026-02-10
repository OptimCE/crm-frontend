import { Component } from '@angular/core';
import {TableModule} from 'primeng/table';
import {TagModule} from 'primeng/tag';
import {Tab, TabList, TabPanel, TabPanels, Tabs} from 'primeng/tabs';
import {TranslateModule} from '@ngx-translate/core';
import {PendingMemberInvitation} from './pending-member-invitation/pending-member-invitation';
import {PendingManagerInvitation} from './pending-manager-invitation/pending-manager-invitation';
import {ErrorMessageHandler} from '../../../../shared/services-ui/error.message.handler';

@Component({
  selector: 'app-community-pending-invitation',
  standalone: true,
  imports: [TableModule, TagModule, Tabs, TabList, Tab, TabPanel,
    TabPanels, TranslateModule, PendingMemberInvitation, PendingManagerInvitation],
  templateUrl: './community-pending-invitation.html',
  styleUrl: './community-pending-invitation.css',
  providers: [ErrorMessageHandler],
})
export class CommunityPendingInvitation {

}
