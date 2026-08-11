import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';

import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { CommunityServicesStore } from '../../../../core/services/community-services.store';
import { ActiveCommunityStore } from '../../../../core/services/active-community.store';
import { HeaderPage } from '../../../../layout/header-page/header-page';
import { BillingService } from '../../../../shared/services/billing.service';
import { NewsService } from '../../../../shared/services/news.service';
import { AboutCommunityTile } from '../tiles/about-community-tile/about-community-tile';
import { MyDocumentsTile } from '../tiles/my-documents-tile/my-documents-tile';
import { MyEnergyTile } from '../tiles/my-energy-tile/my-energy-tile';
import { MyInvoicesTile } from '../tiles/my-invoices-tile/my-invoices-tile';
import { MyMemberRecordTile } from '../tiles/my-member-record-tile/my-member-record-tile';
import { MyParticipationTile } from '../tiles/my-participation-tile/my-participation-tile';
import { NewsTile } from '../tiles/news-tile/news-tile';

interface AnnexAvailability {
  billing: boolean;
  news: boolean;
}

/**
 * The member dashboard: "what am I getting out of this community, and is my part
 * in order?".
 *
 * **Not the manager dashboard minus tiles.** Every endpoint here is member-safe:
 * `/me/*` (no roleChecker at all), `GET /communities/:id` (idChecker only), and
 * the two member-reachable annexe reads. `/members`, `/meters`, `/keys`,
 * `/sharing_operations`, `/invitations` and `/audit-logs` are all
 * `roleChecker(GESTIONNAIRE)` and would 401 — no tile here may touch them.
 *
 * **No module discovery strip.** A member cannot subscribe to anything, so
 * advertising modules to them is noise. Enforced by not importing the component.
 *
 * "What has been filed about me" is deliberately absent: it needs a
 * member-scoped read in administrative-document that does not exist yet.
 */
@Component({
  selector: 'app-member-dashboard',
  standalone: true,
  imports: [
    TranslatePipe,
    Button,
    HeaderPage,
    MyEnergyTile,
    MyParticipationTile,
    MyMemberRecordTile,
    AboutCommunityTile,
    MyDocumentsTile,
    MyInvoicesTile,
    NewsTile,
  ],
  templateUrl: './member-dashboard.html',
})
export class MemberDashboard {
  private readonly servicesStore = inject(CommunityServicesStore);
  private readonly activeCommunityStore = inject(ActiveCommunityStore);
  private readonly billingService = inject(BillingService);
  private readonly newsService = inject(NewsService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly userContext = inject(UserContextService);

  readonly reloadKey = signal<number>(0);
  readonly annexes = signal<AnnexAvailability | null>(null);

  readonly subtitle = computed(
    () =>
      this.userContext.activeCommunity()?.name ??
      (this.translate.instant('DASHBOARD.SUBTITLE') as string),
  );

  constructor() {
    this.loadAnnexes();
  }

  refresh(): void {
    this.billingService.invalidate();
    this.newsService.invalidate();
    this.activeCommunityStore.invalidate();
    this.reloadKey.update((n) => n + 1);
  }

  private loadAnnexes(): void {
    this.servicesStore
      .ensureLoaded()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () =>
          this.annexes.set({
            billing: this.servicesStore.canReach('billing'),
            news: this.servicesStore.canReach('news'),
          }),
        // Fail closed — hiding a tile costs a click, showing one for an
        // unsubscribed annexe costs a 403 the member cannot act on.
        error: () => this.annexes.set({ billing: false, news: false }),
      });
  }
}
