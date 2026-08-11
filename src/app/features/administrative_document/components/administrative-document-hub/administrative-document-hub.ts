import { Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';

import { Role } from '../../../../core/dtos/role';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { HeaderPage } from '../../../../layout/header-page/header-page';
import { DeadlineDashboard } from '../deadline-dashboard/deadline-dashboard';
import { DossierList } from '../dossier-list/dossier-list';
import { MyFilings } from '../my-filings/my-filings';

/**
 * Entry point for `/administrative-document`, role-branched exactly like
 * `BillingHub`.
 *
 * The route is gated only by subscription now. Managers get the console;
 * members get the one thing this annex owes them — what has been filed about
 * them. The branch is presentation, not protection: every manager read is gated
 * server-side with `manager_only`, and the member read filters rows before the
 * payload is built.
 */
@Component({
  selector: 'app-administrative-document-hub',
  standalone: true,
  imports: [
    TranslatePipe,
    Tabs,
    TabList,
    TabPanels,
    TabPanel,
    Tab,
    HeaderPage,
    DossierList,
    DeadlineDashboard,
    MyFilings,
  ],
  templateUrl: './administrative-document-hub.html',
})
export class AdministrativeDocumentHub {
  protected readonly userContext = inject(UserContextService);
  protected readonly Role = Role;
}
