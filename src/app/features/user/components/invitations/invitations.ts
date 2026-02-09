import { Component } from '@angular/core';
import {Tab, TabList, TabPanel, TabPanels, Tabs} from 'primeng/tabs';
import {InvitationMember} from './invitation-tables/invitation-member/invitation-member';
import {InvitationGestionnaire} from './invitation-tables/invitation-gestionnaire/invitation-gestionnaire';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
  selector: 'app-invitations',
  imports: [
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    InvitationMember,
    InvitationGestionnaire,
    TranslatePipe
  ],
  templateUrl: './invitations.html',
  styleUrl: './invitations.css',
})
export class Invitations {

}
