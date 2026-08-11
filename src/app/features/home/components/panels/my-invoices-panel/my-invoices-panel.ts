import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { CommunityServicesStore } from '../../../../../core/services/community-services.store';
import { UserContextService } from '../../../../../core/services/authorization/authorization.service';
import { DashboardTile } from '../../../../dashboard/components/tiles/dashboard-tile/dashboard-tile';
import { TileState } from '../../../../dashboard/dashboard-format';
import { InvoiceOut, InvoiceStatus } from '../../../../../shared/dtos/billing.dtos';
import { MyCommunityDTO } from '../../../../../shared/dtos/community.dtos';
import { BillingService } from '../../../../../shared/services/billing.service';
import { envelopeData } from '../../../home-format';

/** Issued, sent or overdue — an invoice the member still owes. */
const UNPAID: readonly InvoiceStatus[] = [
  InvoiceStatus.ISSUED,
  InvoiceStatus.SENT,
  InvoiceStatus.OVERDUE,
];

/** One community's unpaid invoices, for a per-community sub-list. */
export interface CommunityInvoices {
  community: MyCommunityDTO;
  invoices: InvoiceOut[];
}

/**
 * "Mes factures" — unpaid invoices across every community, via a fan-out.
 *
 * `/billing/invoices/mine` is member-scoped but resolves its tenant from
 * `X-Community-ID`, so there is no single call that spans communities. Each is
 * asked in turn with the header pinned, and **only where billing is actually
 * subscribed** — an unsubscribed annexe must produce zero requests, not a
 * swallowed 403.
 *
 * Failures are per community: one dead billing service must degrade that row,
 * not blank the panel. N is single digits.
 */
@Component({
  selector: 'app-my-invoices-panel',
  standalone: true,
  imports: [TranslatePipe, DashboardTile],
  templateUrl: './my-invoices-panel.html',
})
export class MyInvoicesPanel {
  private readonly billingService = inject(BillingService);
  private readonly servicesStore = inject(CommunityServicesStore);
  private readonly userContext = inject(UserContextService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly communities = input.required<MyCommunityDTO[]>();

  readonly rows = signal<CommunityInvoices[]>([]);
  private readonly failed = signal<boolean>(false);
  private readonly loading = signal<boolean>(true);

  readonly total = computed(() => this.rows().reduce((sum, row) => sum + row.invoices.length, 0));

  readonly state = computed<TileState>(() => {
    if (this.loading()) return 'loading';
    if (this.failed()) return 'error';
    return this.total() === 0 ? 'empty' : 'ready';
  });

  constructor() {
    // An effect, not a direct call: `load()` reads the required `communities`
    // input, and a required input is not bound yet when the constructor runs
    // (NG0950). It also makes the fan-out re-run when the community list
    // resolves, which is exactly when the parent has something to fan out over.
    effect(() => {
      this.communities();
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);

    const communities = this.communities();
    if (communities.length === 0) {
      this.rows.set([]);
      this.loading.set(false);
      return;
    }

    forkJoin(
      communities.map((community) =>
        // The catalogue read decides whether the invoice read happens at all,
        // so an unsubscribed community issues exactly one request (the
        // catalogue, which is needed anyway) and never a 403.
        this.servicesStore.catalogFor(community.auth_community_id).pipe(
          switchMap((annexes) => {
            const subscribed = annexes.some((a) => a.feature === 'billing' && a.subscribed);
            if (!subscribed) return of<CommunityInvoices | null>(null);
            return forkJoin(
              UNPAID.map((status) =>
                this.billingService
                  .listMyInvoicesForCommunity(community.auth_community_id, {
                    status,
                    page: 1,
                    limit: 20,
                  })
                  .pipe(catchError(() => of(null))),
              ),
            ).pipe(
              switchMap((responses) => {
                const invoices = responses.flatMap(
                  (response) => envelopeData<InvoiceOut[]>(response) ?? [],
                );
                return of<CommunityInvoices | null>(
                  invoices.length > 0 ? { community, invoices } : null,
                );
              }),
            );
          }),
          catchError(() => of<CommunityInvoices | null>(null)),
        ),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (results) => {
          this.rows.set(results.filter((row): row is CommunityInvoices => row !== null));
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  /**
   * Enter the community, then open its billing page.
   *
   * NOT a plain `routerLink="/billing"`: that route carries
   * `activeFeatureGuard`, which reads the ACTIVE community — and on this page
   * there may not be one, so the link would silently bounce back here. Setting
   * the context first is the difference between a working link and a dead one.
   */
  openBilling(community: MyCommunityDTO): void {
    this.userContext.switchCommunity(community.auth_community_id);
    void this.router.navigateByUrl('/billing');
  }
}
