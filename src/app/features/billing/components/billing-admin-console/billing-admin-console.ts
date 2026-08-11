import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';

import { HeaderPage } from '../../../../layout/header-page/header-page';
import { BillingMemberInvoices } from '../billing-member-invoices/billing-member-invoices';
import { RunGenerate } from '../run-generate/run-generate';
import { TariffsPanel } from '../tariffs-panel/tariffs-panel';
import { TrackingBoard } from '../tracking-board/tracking-board';

/** Tab slugs, in panel order — the deep-link `?tab=` vocabulary. */
const TABS = ['tariffs', 'generate', 'tracking', 'my-invoices'] as const;

/**
 * Manager/admin billing console. Tariffs, bill generation and the tracking board,
 * plus a "My invoices" tab (the member view reused) for dual-role users.
 *
 * All four panels render eagerly (the tabs are not `lazy`), so a preselected
 * filter is applied whichever tab happens to be showing.
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
export class BillingAdminConsole {
  /** Tab slug from `?tab=`; an unknown value falls back to the first tab. */
  readonly tab = input<string | null>(null);
  readonly participant = input<number | null>(null);
  readonly operation = input<number | null>(null);

  readonly activeTab = computed<number>(() => {
    const index = TABS.indexOf((this.tab() ?? '') as (typeof TABS)[number]);
    return index === -1 ? 0 : index;
  });
}
