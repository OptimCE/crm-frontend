import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { interval, switchMap } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';

import { ApiResponse } from '../../../../core/dtos/api.response';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { BillingRunOut, InvoiceOut } from '../../../../shared/dtos/billing.dtos';
import { SharingOperationPartialDTO } from '../../../../shared/dtos/sharing_operation.dtos';
import { BillingService } from '../../../../shared/services/billing.service';
import { SharingOperationService } from '../../../../shared/services/sharing_operation.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import {
  isRunPending,
  runStatusLabelKey,
  runStatusSeverity,
  TagSeverity,
  toApiDate,
} from '../../billing-format';
import { ConsumptionCoverage } from '../../../../shared/components/consumption-coverage/consumption-coverage';
import { ConsumptionUpload } from '../../../../shared/components/consumption-upload/consumption-upload';
import { InvoiceList } from '../invoice-list/invoice-list';
import { RealtimeService } from '../../../../core/services/realtime/realtime.service';
import { REALTIME_TOPICS } from '../../../../core/services/realtime/realtime.types';

const OPERATIONS_PAGE_LIMIT = 100;
// Poll the active run while it computes so the UI converges without a manual refresh.
const POLL_INTERVAL_MS = 4000;
// Cadence while the realtime stream is live. SLOWED, not stopped: a live stream
// proves the socket is healthy, not that events are being published, and this
// poller is also the only code path that loads the invoices and refreshes the run
// list when a run finishes.
const SAFETY_POLL_INTERVAL_MS = 20_000;

@Component({
  selector: 'app-run-generate',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    TranslatePipe,
    Button,
    DatePicker,
    Select,
    Skeleton,
    Tag,
    InvoiceList,
    ConsumptionUpload,
    ConsumptionCoverage,
  ],
  providers: [ErrorMessageHandler],
  templateUrl: './run-generate.html',
})
export class RunGenerate implements OnInit {
  private readonly service = inject(BillingService);
  private readonly operationService = inject(SharingOperationService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  readonly operations = signal<SharingOperationPartialDTO[]>([]);
  readonly operationsLoading = signal<boolean>(true);
  readonly selectedOpId = signal<number | null>(null);
  /** Operation to preselect, from `/billing?tab=generate&operation=2`. */
  readonly operation = input<number | null>(null);

  periodStart: Date | null = null;
  periodEnd: Date | null = null;

  readonly generating = signal<boolean>(false);
  readonly formError = signal<string | null>(null);

  readonly runs = signal<BillingRunOut[]>([]);
  readonly activeRun = signal<BillingRunOut | null>(null);
  readonly runInvoices = signal<InvoiceOut[]>([]);
  readonly invoicesLoading = signal<boolean>(false);
  readonly coverageReload = signal<number>(0);

  private readonly realtime = inject(RealtimeService);

  constructor() {
    toObservable(this.realtime.live)
      .pipe(
        switchMap((live) => interval(live ? SAFETY_POLL_INTERVAL_MS : POLL_INTERVAL_MS)),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        const run = this.activeRun();
        if (run && isRunPending(run.status) && !document.hidden) {
          this.pollRun(run.id);
        }
      });

    // The fast path — same handler as the poll, so there is one code path and no
    // way to double-fire. `realtime.reconnected` comes along for free.
    this.realtime
      .on(REALTIME_TOPICS.BILLING_RUN_FINISHED)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        const run = this.activeRun();
        if (run && isRunPending(run.status) && !document.hidden) {
          this.pollRun(run.id);
        }
      });
  }

  ngOnInit(): void {
    this.loadOperations();
  }

  private loadOperations(): void {
    this.operationsLoading.set(true);
    this.operationService
      .getSharingOperationList({ page: 1, limit: OPERATIONS_PAGE_LIMIT })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const operations = Array.isArray(res.data) ? res.data : [];
          this.operations.set(operations);
          this.operationsLoading.set(false);

          // Applied only once the list is in, and only if the deep-linked id is
          // actually one of this community's operations.
          const preselected = this.operation();
          if (preselected != null && operations.some((op) => op.id === preselected)) {
            this.onOperationChange(preselected);
          }
        },
        error: (error: unknown) => {
          this.operationsLoading.set(false);
          this.handleError(error);
        },
      });
  }

  onOperationChange(operationId: number | null): void {
    this.selectedOpId.set(operationId);
    this.activeRun.set(null);
    this.runInvoices.set([]);
    if (operationId != null) this.refreshRuns();
    else this.runs.set([]);
  }

  generate(): void {
    this.formError.set(null);
    const operationId = this.selectedOpId();
    if (operationId == null || !this.periodStart || !this.periodEnd) {
      this.formError.set(this.translate.instant('BILLING.GENERATE.ERRORS.REQUIRED') as string);
      return;
    }
    if (this.periodEnd < this.periodStart) {
      this.formError.set(this.translate.instant('BILLING.GENERATE.ERRORS.PERIOD_ORDER') as string);
      return;
    }

    this.generating.set(true);
    this.service
      .createBillingRun(operationId, {
        period_start: toApiDate(this.periodStart) as string,
        period_end: toApiDate(this.periodEnd) as string,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.generating.set(false);
          this.snackbar.openSnackBar(
            this.translate.instant('BILLING.GENERATE.RUN_CREATED') as string,
            VALIDATION_TYPE,
          );
          this.handleRun(res.data);
          this.refreshRuns();
        },
        error: (error: unknown) => {
          this.generating.set(false);
          this.handleError(error);
        },
      });
  }

  selectRun(run: BillingRunOut): void {
    this.handleRun(run);
  }

  private handleRun(run: BillingRunOut): void {
    this.activeRun.set(run);
    if (isRunPending(run.status)) {
      this.runInvoices.set([]);
    } else {
      this.loadRunInvoices(run.id);
    }
  }

  private pollRun(id: number): void {
    // INVALIDATE FIRST. getBillingRun is a cachedGet with a 1-minute TTL, and
    // ServiceBase also keeps an in-flight map handing back the same
    // shareReplay(1) observable — so without this the 4s poll was served from
    // cache and the real status granularity was ~60s. It also meant a
    // realtime-triggered refetch would silently do nothing at all.
    this.service.invalidate();
    this.service
      .getBillingRun(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const run = res.data;
          this.activeRun.set(run);
          if (!isRunPending(run.status)) {
            this.loadRunInvoices(run.id);
            // Already invalidated above; refreshRuns() just needs to miss the cache.
            this.refreshRuns();
          }
        },
        error: () => {
          /* silent — the next poll retries */
        },
      });
  }

  loadRunInvoices(id: number): void {
    this.invoicesLoading.set(true);
    this.service
      .getRunInvoices(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.runInvoices.set(Array.isArray(res.data) ? res.data : []);
          this.invoicesLoading.set(false);
        },
        error: (error: unknown) => {
          this.invoicesLoading.set(false);
          this.handleError(error);
        },
      });
  }

  onInvoicesChanged(): void {
    const run = this.activeRun();
    if (!run) return;
    this.service.invalidate();
    this.loadRunInvoices(run.id);
  }

  /** Consumption data was uploaded for the selected operation — refresh its coverage grid. */
  onConsumptionUploaded(): void {
    this.coverageReload.update((n) => n + 1);
  }

  private refreshRuns(): void {
    const operationId = this.selectedOpId();
    if (operationId == null) return;
    this.service
      .listBillingRuns(operationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.runs.set(Array.isArray(res.data) ? res.data : []),
        error: () => {
          /* history is non-critical */
        },
      });
  }

  // ----- display helpers -------------------------------------------------

  runStatusLabelKey(run: BillingRunOut): string {
    return runStatusLabelKey(run.status);
  }
  runStatusSeverity(run: BillingRunOut): TagSeverity {
    return runStatusSeverity(run.status);
  }
  isActiveRun(run: BillingRunOut): boolean {
    return this.activeRun()?.id === run.id;
  }
  hasInvoiceCount(run: BillingRunOut): boolean {
    return run.invoice_count != null;
  }

  private handleError(error: unknown): void {
    this.errorHandler.handleError(error instanceof ApiResponse ? (error.data as string) : null);
  }
}
