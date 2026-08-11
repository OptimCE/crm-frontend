import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, forkJoin, map, of } from 'rxjs';

import { BillingRunOut } from '../../../../../shared/dtos/billing.dtos';
import { SharingOperationPartialDTO } from '../../../../../shared/dtos/sharing_operation.dtos';
import { BillingService } from '../../../../../shared/services/billing.service';
import { TileState, UNPAID_INVOICE_STATUSES } from '../../../dashboard-format';
import { DashboardTile } from '../dashboard-tile/dashboard-tile';

/**
 * How many operations get probed for their last billing run.
 *
 * Bounded on purpose: the console shows every run, so probing all of them here
 * would be a lot of requests for one line of text.
 */
const RUN_PROBE_LIMIT = 5;

interface LastRun {
  operation: SharingOperationPartialDTO;
  run: BillingRunOut;
}

/**
 * What the community is still owed, and when it last billed.
 *
 * `GET /billing/invoices` has **no `unpaid` filter** — `status` takes a single
 * value — so "unpaid" is defined here as ISSUED ∪ SENT ∪ OVERDUE and costs one
 * `limit=1` count per status.
 *
 * The two halves fail differently, on purpose: a failed COUNT fails the tile,
 * because a wrong money figure is worse than no figure, while a failed last-run
 * probe just degrades to "no billing run yet".
 */
@Component({
  selector: 'app-unpaid-invoices-tile',
  standalone: true,
  imports: [TranslatePipe, RouterLink, DashboardTile],
  templateUrl: './unpaid-invoices-tile.html',
})
export class UnpaidInvoicesTile {
  private readonly billingService = inject(BillingService);
  private readonly destroyRef = inject(DestroyRef);

  readonly operations = input.required<SharingOperationPartialDTO[]>();
  readonly operationsLoading = input.required<boolean>();
  readonly reloadKey = input<number>(0);

  readonly unpaidCount = signal<number | null>(null);
  readonly lastRun = signal<LastRun | null>(null);
  private readonly failed = signal<boolean>(false);
  private readonly loading = signal<boolean>(true);

  readonly state = computed<TileState>(() => {
    if (this.loading()) return 'loading';
    if (this.failed()) return 'error';
    return this.unpaidCount() === 0 && !this.lastRun() ? 'empty' : 'ready';
  });

  constructor() {
    effect(() => {
      this.reloadKey();
      const operations = this.operations();
      if (this.operationsLoading()) return;
      this.load(operations);
    });
  }

  load(operations: SharingOperationPartialDTO[]): void {
    this.loading.set(true);
    this.failed.set(false);

    const counts = forkJoin(
      UNPAID_INVOICE_STATUSES.map((status) =>
        this.billingService
          .listInvoices({ page: 1, limit: 1, status })
          .pipe(map((response) => response.pagination.total)),
      ),
    );

    const runs = forkJoin(
      operations.slice(0, RUN_PROBE_LIMIT).map((operation) =>
        this.billingService.listBillingRuns(operation.id).pipe(
          map((response) => {
            const list = Array.isArray(response.data) ? response.data : [];
            return list.length ? { operation, run: list[0] } : null;
          }),
          // A missing run history is normal for a new operation, and it must not
          // cost the user their unpaid figure.
          catchError(() => of(null)),
        ),
      ),
    );

    forkJoin({
      counts,
      runs: operations.length ? runs : of<(LastRun | null)[]>([]),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ counts: totals, runs: probed }) => {
          this.unpaidCount.set(totals.reduce((sum, total) => sum + total, 0));
          this.lastRun.set(mostRecent(probed));
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }
}

function mostRecent(runs: (LastRun | null)[]): LastRun | null {
  return (
    runs
      .filter((entry): entry is LastRun => entry !== null)
      .sort((a, b) => (b.run.created_at ?? '').localeCompare(a.run.created_at ?? ''))[0] ?? null
  );
}
