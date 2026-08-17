import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Skeleton } from 'primeng/skeleton';
import { Toast } from 'primeng/toast';
import { Tooltip } from 'primeng/tooltip';
import { interval, switchMap } from 'rxjs';

import { ApiResponse, Pagination } from '../../../../../../core/dtos/api.response';
import { VALIDATION_TYPE } from '../../../../../../core/dtos/notification';
import { RealtimeService } from '../../../../../../core/services/realtime/realtime.service';
import { REALTIME_TOPICS } from '../../../../../../core/services/realtime/realtime.types';
import {
  SimulationDetailDTO,
  SimulationPartialDTO,
  SimulationQuery,
  SimulationStatus,
} from '../../../../../../shared/dtos/simulation.dtos';
import { SimulationService } from '../../../../../../shared/services/simulation.service';
import { ErrorMessageHandler } from '../../../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../../../shared/services-ui/snackbar.notifcation.service';
import { HeaderPage } from '../../../../../../layout/header-page/header-page';
import { SimulationRunRow } from '../simulation-run-row/simulation-run-row';
import { SimulationStartPanel } from '../simulation-start-panel/simulation-start-panel';

// While at least one run is PENDING, poll the list so the UI converges to the
// terminal state without the user hitting refresh. Stops automatically once
// nothing is pending, and skips work when the tab is hidden.
const POLL_INTERVAL_MS = 4000;
// Cadence while the realtime stream is live. The poll is SLOWED, never stopped:
// a live stream proves the socket is healthy, not that events are being
// published — one service missing REALTIME_REDIS_URL yields a perfectly healthy
// stream that delivers nothing, and a gated-off poller would then never
// converge. This also keeps the terminal-transition toast below on a single code
// path, so the realtime and poll routes cannot double-toast.
const SAFETY_POLL_INTERVAL_MS = 20_000;

@Component({
  selector: 'app-simulation-hub',
  standalone: true,
  imports: [
    DatePipe,
    TranslatePipe,
    Toast,
    ConfirmDialog,
    Button,
    Skeleton,
    Tooltip,
    HeaderPage,
    SimulationStartPanel,
    SimulationRunRow,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './simulation-hub.html',
  styleUrl: './simulation-hub.css',
})
export class SimulationHub implements OnInit {
  private readonly service = inject(SimulationService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly runs = signal<SimulationPartialDTO[]>([]);
  readonly runsLoading = signal<boolean>(true);
  readonly pagination = signal<Pagination>(new Pagination(1, 20, 0, 0));
  readonly filter = signal<SimulationQuery>({ page: 1, page_size: 20, sort_id: 'DESC' });
  readonly lastRefreshedAt = signal<number | null>(null);

  /**
   * Status of each run as of the previous list read, so a PENDING -> terminal
   * transition can be observed exactly once.
   *
   * Toasting from the observed DELTA rather than from event arrival is what makes
   * a double toast impossible: the realtime path and the poll path both funnel
   * into silentRefresh(), so whichever wins the race the other sees no change.
   * It is the same principle as the notification store's `lastCount = -1` guard,
   * and it means the toast still fires when realtime is down.
   */
  private lastStatusById = new Map<number, SimulationStatus>();

  readonly expandedId = signal<number | null>(null);
  readonly detailById = signal<ReadonlyMap<number, SimulationDetailDTO>>(new Map());
  readonly detailLoadingId = signal<number | null>(null);

  readonly hasMorePages = computed(() => this.pagination().total_pages > 1);
  readonly hasPending = computed(() =>
    this.runs().some((run) => run.status === SimulationStatus.PENDING),
  );

  protected readonly SimulationStatus = SimulationStatus;

  private readonly realtime = inject(RealtimeService);

  constructor() {
    toObservable(this.realtime.live)
      .pipe(
        switchMap((live) => interval(live ? SAFETY_POLL_INTERVAL_MS : POLL_INTERVAL_MS)),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        if (this.hasPending() && !document.hidden) {
          this.silentRefresh();
        }
      });

    // The fast path. `realtime.reconnected` comes along for free, so a dropped
    // event heals on the next connect instead of needing a replay buffer.
    // Never trust the payload as data — refetch and let the list be the truth.
    this.realtime
      .on(REALTIME_TOPICS.SIMULATION_FINISHED)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (!document.hidden) this.silentRefresh();
      });
  }

  ngOnInit(): void {
    this.loadRuns();
  }

  // ====== list ===========================================================

  loadRuns(page = 1): void {
    const filter: SimulationQuery = { ...this.filter(), page };
    this.filter.set(filter);
    this.runsLoading.set(true);
    this.service
      .listSimulations(filter)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const data = Array.isArray(response.data) ? response.data : [];
          this.runs.set(data);
          this.pagination.set(response.pagination);
          this.lastRefreshedAt.set(Date.now());
          this.runsLoading.set(false);
          // Seed only: an explicit load must never toast about work that
          // finished before the user got here.
          this.snapshotStatuses(data);
        },
        error: (error: unknown) => {
          this.runsLoading.set(false);
          this.handleApiError(error);
        },
      });
  }

  refresh(): void {
    this.service.invalidate();
    this.loadRuns(this.filter().page);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.pagination().total_pages) return;
    this.loadRuns(page);
  }

  onLaunched(): void {
    this.refresh();
  }

  /**
   * Toast once per run that just left PENDING, then re-snapshot.
   *
   * Text comes from the i18n bundle keyed on the observed status — never from a
   * realtime payload. Anything holding the Redis password can publish, so
   * rendering payload strings would make a compromised service a text-injection
   * channel into every browser.
   */
  private toastTerminalTransitions(data: readonly SimulationPartialDTO[]): void {
    for (const run of data) {
      const before = this.lastStatusById.get(run.id);
      if (before !== SimulationStatus.PENDING || run.status === SimulationStatus.PENDING) continue;
      this.snackbar.openSnackBar(
        this.translate.instant(
          run.status === SimulationStatus.SUCCESS
            ? 'SIMULATION_HUB.TOAST_FINISHED'
            : 'SIMULATION_HUB.TOAST_FAILED',
        ) as string,
        VALIDATION_TYPE,
      );
    }
    this.snapshotStatuses(data);
  }

  private snapshotStatuses(data: readonly SimulationPartialDTO[]): void {
    this.lastStatusById = new Map(data.map((run) => [run.id, run.status]));
  }

  /** Background poll: refresh the list (and the open detail) without spinners. */
  private silentRefresh(): void {
    this.service.invalidate();
    this.service
      .listSimulations(this.filter())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const data = Array.isArray(response.data) ? response.data : [];
          this.toastTerminalTransitions(data);
          this.runs.set(data);
          this.pagination.set(response.pagination);
          this.lastRefreshedAt.set(Date.now());

          // If the open run just reached a terminal state, refresh its detail.
          const expanded = this.expandedId();
          if (expanded !== null) {
            const run = data.find((item) => item.id === expanded);
            const detail = this.detailById().get(expanded);
            if (
              run &&
              run.status !== SimulationStatus.PENDING &&
              (!detail || detail.status === SimulationStatus.PENDING)
            ) {
              this.loadDetail(expanded);
            }
          }
        },
        error: () => {
          /* silent — the next manual refresh surfaces persistent errors */
        },
      });
  }

  // ====== expansion + detail ============================================

  toggleRun(id: number): void {
    if (this.expandedId() === id) {
      this.expandedId.set(null);
      return;
    }
    this.expandedId.set(id);
    const cached = this.detailById().get(id);
    if (!cached || cached.status === SimulationStatus.PENDING) {
      this.loadDetail(id);
    }
  }

  loadDetail(id: number): void {
    this.detailLoadingId.set(id);
    this.service
      .getSimulation(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const detail =
            response.data && typeof response.data !== 'string' ? response.data : undefined;
          if (detail) {
            this.detailById.update((map) => {
              const next = new Map(map);
              next.set(id, detail);
              return next;
            });
          }
          this.detailLoadingId.set(null);
        },
        error: (error: unknown) => {
          this.detailLoadingId.set(null);
          this.handleApiError(error);
        },
      });
  }

  // ====== delete =========================================================

  deleteRun(id: number): void {
    this.confirmation.confirm({
      header: this.translate.instant('SIMULATION_HUB.CONFIRM.DELETE_HEADER') as string,
      message: this.translate.instant('SIMULATION_HUB.CONFIRM.DELETE_MESSAGE') as string,
      acceptLabel: this.translate.instant('COMMON.ACTIONS.VALIDATE') as string,
      rejectLabel: this.translate.instant('COMMON.ACTIONS.CANCEL') as string,
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this.service
          .deleteSimulation(id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.snackbar.openSnackBar(
                this.translate.instant('SIMULATION_HUB.SUCCESS.RUN_DELETED') as string,
                VALIDATION_TYPE,
              );
              this.removeRun(id);
            },
            error: (error: unknown) => this.handleApiError(error),
          });
      },
    });
  }

  private removeRun(id: number): void {
    this.runs.update((list) => list.filter((run) => run.id !== id));
    this.detailById.update((map) => {
      if (!map.has(id)) return map;
      const next = new Map(map);
      next.delete(id);
      return next;
    });
    if (this.expandedId() === id) this.expandedId.set(null);
  }

  // ====== template helpers ==============================================

  isExpanded(id: number): boolean {
    return this.expandedId() === id;
  }

  detailFor(id: number): SimulationDetailDTO | undefined {
    return this.detailById().get(id);
  }

  isDetailLoading(id: number): boolean {
    return this.detailLoadingId() === id;
  }

  private handleApiError(error: unknown): void {
    const errorData = error instanceof ApiResponse ? (error.data as string) : null;
    this.errorHandler.handleError(errorData);
  }
}
