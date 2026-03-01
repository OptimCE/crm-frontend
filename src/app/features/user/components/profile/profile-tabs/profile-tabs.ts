import { Component, Input } from '@angular/core';
import { UserDTO } from '../../../../../shared/dtos/user.dtos';
import { TranslatePipe } from '@ngx-translate/core';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { MetersComponent } from './tabs/meters/meters.component';
import { BankingInfoComponent } from './tabs/banking-info/banking-info.component';
import { DocumentsComponent } from './tabs/documents/documents.component';
import { RepresentationsComponent } from './tabs/representations/representations.component';

@Component({
  selector: 'app-profile-tabs',
  imports: [
    TranslatePipe,
    Tabs,
    TabList,
    TabPanels,
    TabPanel,
    Tab,
    MetersComponent,
    BankingInfoComponent,
    DocumentsComponent,
    RepresentationsComponent,
  ],
  templateUrl: './profile-tabs.html',
  styleUrl: './profile-tabs.css',
})
export class ProfileTabs {
  @Input() user?: UserDTO | null;
}
