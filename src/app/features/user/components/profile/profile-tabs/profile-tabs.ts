import { Component, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { UserDTO } from '../../../../../shared/dtos/user.dtos';
import { TranslatePipe } from '@ngx-translate/core';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { MetersComponent } from './tabs/meters/meters.component';
import { BankingInfoComponent } from './tabs/banking-info/banking-info.component';
import { DocumentsComponent } from './tabs/documents/documents.component';
import { RepresentationsComponent } from './tabs/representations/representations.component';
import { NotificationPreferencesComponent } from './tabs/notification-preferences/notification-preferences.component';
import { DataExportPanel } from '../../../../data_export/components/data-export-panel/data-export-panel';

/**
 * The tabs in order, by the name `?tab=` carries: `/users?tab=exports` is where
 * the export notifications and e-mails send the requester.
 */
export const PROFILE_TABS = [
  'meters',
  'banking',
  'documents',
  'representations',
  'notifications',
  'exports',
] as const;
export type ProfileTabName = (typeof PROFILE_TABS)[number];

/** The tab index for a `?tab=` value; an unknown or missing one opens the first tab. */
export function profileTabIndex(name: string | null): number {
  const index = PROFILE_TABS.indexOf(name as ProfileTabName);
  return index >= 0 ? index : 0;
}

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
    NotificationPreferencesComponent,
    DataExportPanel,
  ],
  templateUrl: './profile-tabs.html',
  styleUrl: './profile-tabs.css',
})
export class ProfileTabs {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly user = input<UserDTO | null>();
  readonly activeTab = signal(0);

  constructor() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed())
      .subscribe((params) => this.activeTab.set(profileTabIndex(params.get('tab'))));
  }

  /** A click on a tab: the URL follows, so a link to another tab still opens it. */
  onTabChange(value: string | number | undefined): void {
    const index = Number(value);
    const name = PROFILE_TABS[index];
    if (!name || index === this.activeTab()) return;
    this.activeTab.set(index);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: name },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
