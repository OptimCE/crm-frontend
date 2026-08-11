import { DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, forkJoin, map, of } from 'rxjs';

import { InvoiceOut } from '../../../../../shared/dtos/billing.dtos';
import { BillingService } from '../../../../../shared/services/billing.service';
import { invoiceStatusLabelKey } from '../../../../billing/billing-format';
import { TileState, UNPAID_INVOICE_STATUSES } from '../../../dashboard-format';
import { DashboardTile } from '../dashboard-tile/dashboard-tile';

const VISIBLE_LIMIT = 3;

/**
 * The member's own invoices, unpaid first.
 *
 * Uses `/billing/invoices/mine`, which resolves the caller's members server-side
 * — the manager's `/billing/invoices` would show the whole community ledger.
 *
 * "Unpaid" is ISSUED ∪ SENT ∪ OVERDUE: `status` takes one value per request, so
 * the definition costs one small read each.
 */
@Component({
  selector: 'app-my-invoices-tile',
  standalone: true,
  imports: [DecimalPipe, TranslatePipe, RouterLink, DashboardTile],
  templateUrl: './my-invoices-tile.html',
})
export class MyInvoicesTile {
  private readonly billingService = inject(BillingService);
  private readonly destroyRef = inject(DestroyRef);

  readonly reloadKey = input<number>(0);

  readonly unpaid = signal<InvoiceOut[]>([]);
  private readonly failed = signal<boolean>(false);
  private readonly loading = signal<boolean>(true);

  readonly visible = computed(() => this.unpaid().slice(0, VISIBLE_LIMIT));

  readonly state = computed<TileState>(() => {
    if (this.loading()) return 'loading';
    if (this.failed()) return 'error';
    return this.unpaid().length === 0 ? 'empty' : 'ready';
  });

  protected readonly invoiceStatusLabelKey = invoiceStatusLabelKey;

  constructor() {
    effect(() => {
      this.reloadKey();
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);

    forkJoin(
      UNPAID_INVOICE_STATUSES.map((status) =>
        this.billingService
          .listMyInvoices({ page: 1, limit: VISIBLE_LIMIT, status, sort: 'due_date', order: 'asc' })
          .pipe(map((response) => (Array.isArray(response.data) ? response.data : []))),
      ),
    )
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((results) => {
        if (!results) this.failed.set(true);
        else this.unpaid.set(results.flat().sort(byDueDate));
        this.loading.set(false);
      });
  }
}

function byDueDate(a: InvoiceOut, b: InvoiceOut): number {
  return (a.due_date ?? '').localeCompare(b.due_date ?? '');
}
