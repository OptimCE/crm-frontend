import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs';
import { Message } from 'primeng/message';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';

import { INFO_TYPE } from '../../../../core/dtos/notification';
import { Role } from '../../../../core/dtos/role';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { CommunityServicesStore } from '../../../../core/services/community-services.store';
import { HeaderPage } from '../../../../layout/header-page/header-page';
import { LiveDataService } from '../../../../shared/services/live-data.service';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { LiveDashboard } from '../live-dashboard/live-dashboard';
import { LiveDevices } from '../live-devices/live-devices';
import { LiveMemberView } from '../live-member-view/live-member-view';
import { LiveOps } from '../live-ops/live-ops';
import { LiveSettings } from '../live-settings/live-settings';

/**
 * Entry point for `/live-data`. Four manager screens behind one route - or, for
 * a member, one view of their own.
 *
 * ---------------------------------------------------------------------------
 * A MEMBER BRANCH, LIKE BILLING'S HUB (D-14, 2026-10-04 - D-5 lifted).
 *
 * A member sees ONLY the sharing operation(s) they hold an ACTIVE meter in:
 * `LiveMemberView`, INSTEAD of the tabs, never alongside them. The route keeps
 * `activeFeatureGuard` only and the catalogue declares `minRole: MEMBER` - the
 * catalogue is filtered by role before it reaches the SPA, so MANAGER there
 * would hide the annex from every member entirely.
 *
 * The branch is UX. The line is drawn on the backend: `/summary`, `/series` and
 * `/forecast` (the community) are manager-only, and the member reads are the
 * `/mine` routes, whose DTO cannot carry the grid offtake or the shared estimate.
 * ---------------------------------------------------------------------------
 *
 * The four tabs are mounted lazily: `lazy` on `p-tabs`, AND each screen inside
 * an `<ng-template #content>`. Both halves are needed. PrimeNG's `lazy` defaults
 * to false, and even when on it defers only template content - screens
 * projected as plain children are created regardless. For a while this comment
 * claimed the deferral while the template had neither, and opening the hub
 * issued six requests instead of three and started the Ops tab's poller unseen.
 * A screen stays mounted once its tab has been opened.
 *
 * ---------------------------------------------------------------------------
 * A SWITCH-OFF MID-SESSION IS HANDLED HERE, NOT IN THE TABS.
 *
 * The hub is the one component alive whenever any live-data call is in flight.
 * When a call is refused with 1003 (the community's subscription was switched
 * off), `LiveDataService` completes it empty and announces the loss; the hub
 * shows one info toast, reloads the catalogue so the navbar link disappears,
 * and leaves for `/`. Every tab gets the same 403 under strict parity, so a
 * banner here would sit above four dead tabs — and `activeFeatureGuard` would
 * bounce the next entry anyway.
 * ---------------------------------------------------------------------------
 */
@Component({
  selector: 'app-live-data-hub',
  standalone: true,
  imports: [
    TranslatePipe,
    Tabs,
    TabList,
    TabPanels,
    TabPanel,
    Tab,
    Message,
    HeaderPage,
    LiveDashboard,
    LiveDevices,
    LiveMemberView,
    LiveOps,
    LiveSettings,
  ],
  templateUrl: './live-data-hub.html',
})
export class LiveDataHub {
  private readonly service = inject(LiveDataService);
  private readonly store = inject(CommunityServicesStore);
  private readonly router = inject(Router);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly translate = inject(TranslateService);
  protected readonly userContext = inject(UserContextService);
  protected readonly Role = Role;

  readonly activeTab = signal<number>(0);

  constructor() {
    // `take(1)`: the dashboard's first load fires summary, series and forecast
    // together, so one switch-off arrives as three refusals.
    this.service.subscriptionLost$
      .pipe(take(1), takeUntilDestroyed())
      .subscribe(() => this.leave());
  }

  private leave(): void {
    this.snackbar.openSnackBar(
      this.translate.instant('LIVE_DATA.SUBSCRIPTION_LOST') as string,
      INFO_TYPE,
    );
    // NOT `takeUntilDestroyed`: the navigation below destroys this component and
    // would cancel the very request that removes the navbar link. A failure is
    // swallowed — the guard's own fetch bounces any re-entry.
    this.store.reload().subscribe({ error: () => undefined });
    // `replaceUrl`, so Back does not return to a page that would only bounce.
    void this.router.navigateByUrl('/', { replaceUrl: true });
  }
}
