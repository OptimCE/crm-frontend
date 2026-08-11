import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';

import { Role } from '../../../../core/dtos/role';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { CommunityServicesStore } from '../../../../core/services/community-services.store';
import { CacheService } from '../../../../core/services/cache/cache.service';
import { HeaderPage } from '../../../../layout/header-page/header-page';
import { SharingOperationPartialDTO } from '../../../../shared/dtos/sharing_operation.dtos';
import { AdministrativeDocumentService } from '../../../../shared/services/administrative-document.service';
import { BillingService } from '../../../../shared/services/billing.service';
import { DashboardService } from '../../../../shared/services/dashboard.service';
import { NewsService } from '../../../../shared/services/news.service';
import { SharingOperationService } from '../../../../shared/services/sharing_operation.service';
import { envelopeData } from '../../dashboard-format';
import { DeadlinesTile } from '../tiles/deadlines-tile/deadlines-tile';
import { DossiersTile } from '../tiles/dossiers-tile/dossiers-tile';
import { EnergyGlanceTile } from '../tiles/energy-glance-tile/energy-glance-tile';
import { ModuleDiscoveryStrip } from '../tiles/module-discovery-strip/module-discovery-strip';
import { NewsTile } from '../tiles/news-tile/news-tile';
import { OnboardingFunnelTile } from '../tiles/onboarding-funnel-tile/onboarding-funnel-tile';
import { ReadinessTile } from '../tiles/readiness-tile/readiness-tile';
import { RecentActivityTile } from '../tiles/recent-activity-tile/recent-activity-tile';
import { SharingOperationsTile } from '../tiles/sharing-operations-tile/sharing-operations-tile';
import { UnpaidInvoicesTile } from '../tiles/unpaid-invoices-tile/unpaid-invoices-tile';

/** Annexe subscriptions this dashboard reacts to. */
interface AnnexAvailability {
  billing: boolean;
  news: boolean;
  administrativeDocument: boolean;
}

/**
 * The manager / admin dashboard: "is my community healthy, compliant and
 * operating?".
 *
 * The core spine (readiness, operations, onboarding, activity, energy) never
 * depends on a subscription — a community that has bought nothing is the state
 * of every new community and every prospect, and this page has to be worth
 * opening for them. Annexe tiles are ADDITIVE: each is instantiated only inside
 * an `@if` over the catalogue, so an unsubscribed feature produces **zero**
 * requests rather than a swallowed 403.
 *
 * ADMIN and MANAGER see the same content — the ADMIN-only surface is community
 * lifecycle (edit, delete, kick, invite a manager, subscribe an annexe), not
 * operations. The one place the difference shows is the module strip, where only
 * an ADMIN can actually subscribe.
 */
@Component({
  selector: 'app-manager-dashboard',
  standalone: true,
  imports: [
    TranslatePipe,
    Button,
    HeaderPage,
    ReadinessTile,
    EnergyGlanceTile,
    SharingOperationsTile,
    OnboardingFunnelTile,
    RecentActivityTile,
    DeadlinesTile,
    DossiersTile,
    UnpaidInvoicesTile,
    NewsTile,
    ModuleDiscoveryStrip,
  ],
  templateUrl: './manager-dashboard.html',
})
export class ManagerDashboard {
  private readonly servicesStore = inject(CommunityServicesStore);
  private readonly sharingOperationService = inject(SharingOperationService);
  private readonly dashboardService = inject(DashboardService);
  private readonly billingService = inject(BillingService);
  private readonly newsService = inject(NewsService);
  private readonly administrativeDocumentService = inject(AdministrativeDocumentService);
  private readonly cache = inject(CacheService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly userContext = inject(UserContextService);
  protected readonly Role = Role;

  /**
   * Bumped by the refresh control. Every tile takes it as an input and reloads
   * when it changes — the same idiom `ConsumptionCoverage` already uses.
   */
  readonly reloadKey = signal<number>(0);

  /**
   * Which annexes are subscribed. Starts null so the template can render a
   * placeholder instead of briefly claiming "not subscribed" and flashing a
   * discovery card at a community that has in fact bought everything.
   */
  readonly annexes = signal<AnnexAvailability | null>(null);

  /**
   * Sharing operations, fetched ONCE here and passed down. Three tiles need this
   * list; fetching it per tile would triple the calls for identical data.
   */
  readonly operations = signal<SharingOperationPartialDTO[]>([]);
  readonly operationsFailed = signal<boolean>(false);
  readonly operationsLoading = signal<boolean>(true);

  readonly canSubscribe = computed(() => this.userContext.compareWithActiveRole(Role.ADMIN));
  readonly subtitle = computed(
    () =>
      this.userContext.activeCommunity()?.name ??
      (this.translate.instant('DASHBOARD.SUBTITLE') as string),
  );

  constructor() {
    this.loadAnnexes();
    this.loadOperations();
  }

  refresh(): void {
    // Drop everything the tiles read, then let the reload key re-trigger them.
    this.dashboardService.invalidate();
    this.billingService.invalidate();
    this.newsService.invalidate();
    this.administrativeDocumentService.invalidate();
    this.cache.invalidate('audit-logs-list');
    this.cache.invalidate('sharing-operation');
    this.cache.invalidate('members-invitation');
    this.cache.invalidate('managers-invitation');

    this.loadOperations();
    this.reloadKey.update((n) => n + 1);
  }

  /**
   * What the operations-backed tiles' retry buttons call. Deliberately narrower
   * than `refresh()`: one tile failing is no reason to drop every other tile's
   * cache and make the whole page reload.
   */
  retryOperations(): void {
    this.loadOperations();
  }

  private loadAnnexes(): void {
    this.servicesStore
      .ensureLoaded()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.setAnnexes(),
        // Failing closed is the right direction: hiding a tile costs a click,
        // rendering one for an unsubscribed annexe costs a 403 the user cannot act on.
        error: () =>
          this.annexes.set({ billing: false, news: false, administrativeDocument: false }),
      });
  }

  private setAnnexes(): void {
    this.annexes.set({
      billing: this.servicesStore.canReach('billing'),
      news: this.servicesStore.canReach('news'),
      administrativeDocument: this.servicesStore.canReach('administrative-document'),
    });
  }

  private loadOperations(): void {
    this.operationsLoading.set(true);
    this.operationsFailed.set(false);
    this.sharingOperationService
      .getSharingOperationList({ page: 1, limit: 50 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const data = envelopeData(response);
          if (!data) {
            this.operationsFailed.set(true);
          } else {
            this.operations.set(data);
          }
          this.operationsLoading.set(false);
        },
        error: () => {
          this.operationsFailed.set(true);
          this.operationsLoading.set(false);
        },
      });
  }
}
