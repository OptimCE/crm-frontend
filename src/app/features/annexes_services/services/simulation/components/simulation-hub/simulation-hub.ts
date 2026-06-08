import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Skeleton } from 'primeng/skeleton';
import { Toast } from 'primeng/toast';
import { Tooltip } from 'primeng/tooltip';
import { interval } from 'rxjs';

import { ApiResponse, Pagination } from '../../../../../../core/dtos/api.response';
import { VALIDATION_TYPE } from '../../../../../../core/dtos/notification';
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

  readonly expandedId = signal<number | null>(null);
  readonly detailById = signal<ReadonlyMap<number, SimulationDetailDTO>>(new Map());
  readonly detailLoadingId = signal<number | null>(null);

  readonly hasMorePages = computed(() => this.pagination().total_pages > 1);
  readonly hasPending = computed(() =>
    this.runs().some((run) => run.status === SimulationStatus.PENDING),
  );

  protected readonly SimulationStatus = SimulationStatus;

  constructor() {
    interval(POLL_INTERVAL_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (this.hasPending() && !document.hidden) {
          this.silentRefresh();
        }
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
          this.runs.set(Array.isArray(response.data) ? response.data : []);
          this.pagination.set(response.pagination);
          this.lastRefreshedAt.set(Date.now());
          this.runsLoading.set(false);
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

  /** Background poll: refresh the list (and the open detail) without spinners. */
  private silentRefresh(): void {
    this.service.invalidate();
    this.service
      .listSimulations(this.filter())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const data = Array.isArray(response.data) ? response.data : [];
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
