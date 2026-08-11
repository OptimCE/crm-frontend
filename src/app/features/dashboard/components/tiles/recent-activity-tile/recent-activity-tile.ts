import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { AuditLogDTO } from '../../../../../shared/dtos/audit-log.dtos';
import { TimeAgoPipe } from '../../../../../shared/pipes/time-ago/time-ago-pipe';
import { AuditLogService } from '../../../../../shared/services/audit-log.service';
import { envelopeData, TileState } from '../../../dashboard-format';
import { DashboardTile } from '../dashboard-tile/dashboard-tile';

/** The last few things that changed in this community — "who did what". */
@Component({
  selector: 'app-recent-activity-tile',
  standalone: true,
  imports: [TranslatePipe, RouterLink, TimeAgoPipe, DashboardTile],
  templateUrl: './recent-activity-tile.html',
})
export class RecentActivityTile {
  private readonly auditLogService = inject(AuditLogService);
  private readonly destroyRef = inject(DestroyRef);

  readonly reloadKey = input<number>(0);

  readonly entries = signal<AuditLogDTO[]>([]);
  private readonly failed = signal<boolean>(false);
  private readonly loading = signal<boolean>(true);

  readonly state = computed<TileState>(() => {
    if (this.loading()) return 'loading';
    if (this.failed()) return 'error';
    return this.entries().length === 0 ? 'empty' : 'ready';
  });

  constructor() {
    effect(() => {
      this.reloadKey();
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.auditLogService
      .getAuditLogList({ page: 1, limit: 5, sort_timestamp: 'DESC' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const data = envelopeData(response);
          if (!data) this.failed.set(true);
          else this.entries.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }
}
