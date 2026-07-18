import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';

import { HeaderPage } from '../../../../layout/header-page/header-page';
import { BillingMemberInvoices } from '../billing-member-invoices/billing-member-invoices';
import { RunGenerate } from '../run-generate/run-generate';
import { TariffsPanel } from '../tariffs-panel/tariffs-panel';
import { TrackingBoard } from '../tracking-board/tracking-board';

/**
 * Manager/admin billing console. Tariffs, bill generation and the tracking board,
 * plus a "My invoices" tab (the member view reused) for dual-role users.
 */
@Component({
  selector: 'app-billing-admin-console',
  standalone: true,
  imports: [
    TranslatePipe,
    Tabs,
    TabList,
    TabPanels,
    TabPanel,
    Tab,
    HeaderPage,
    TariffsPanel,
    RunGenerate,
    TrackingBoard,
    BillingMemberInvoices,
  ],
  templateUrl: './billing-admin-console.html',
})
export class BillingAdminConsole {}
