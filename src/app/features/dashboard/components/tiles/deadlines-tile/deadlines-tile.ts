import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Tag } from 'primeng/tag';

import {
  DeadlineOut,
  DeadlineStatus,
} from '../../../../../shared/dtos/administrative-document.dtos';
import { AdministrativeDocumentService } from '../../../../../shared/services/administrative-document.service';
import {
  formatApiDate,
  isOverdue,
} from '../../../../administrative_document/administrative-document-format';
import { envelopeData, TileState } from '../../../dashboard-format';
import { DashboardTile } from '../dashboard-tile/dashboard-tile';

/** Deadlines fetched to classify. Enough to see the near horizon, not the archive. */
const FETCH_LIMIT = 20;
/** How many upcoming deadlines are named in the tile. */
const VISIBLE_LIMIT = 3;

/**
 * Open regulatory deadlines, split into "overdue" and "still coming".
 *
 * The split has to happen here, not in the query: `status = MISSED` is only set
 * by the nightly sweep, so an OPEN deadline whose due date has passed is overdue
 * but still reads as OPEN. A `limit=1` count would therefore report the wrong
 * number until the sweep next runs.
 */
@Component({
  selector: 'app-deadlines-tile',
  standalone: true,
  imports: [TranslatePipe, RouterLink, Tag, DashboardTile],
  templateUrl: './deadlines-tile.html',
})
export class DeadlinesTile {
  private readonly service = inject(AdministrativeDocumentService);
  private readonly destroyRef = inject(DestroyRef);

  readonly reloadKey = input<number>(0);

  readonly deadlines = signal<DeadlineOut[]>([]);
  private readonly failed = signal<boolean>(false);
  private readonly loading = signal<boolean>(true);

  readonly overdue = computed(() => this.deadlines().filter((d) => isOverdue(d.due_date)));
  readonly upcoming = computed(() => this.deadlines().filter((d) => !isOverdue(d.due_date)));
  readonly visible = computed(() => this.upcoming().slice(0, VISIBLE_LIMIT));

  readonly state = computed<TileState>(() => {
    if (this.loading()) return 'loading';
    if (this.failed()) return 'error';
    return this.deadlines().length === 0 ? 'empty' : 'ready';
  });

  protected readonly formatApiDate = formatApiDate;

  constructor() {
    effect(() => {
      this.reloadKey();
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.service
      .listDeadlines({
        page: 1,
        limit: FETCH_LIMIT,
        status: DeadlineStatus.OPEN,
        sort: 'due_date',
        order: 'asc',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const data = envelopeData(response);
          if (!data) this.failed.set(true);
          else this.deadlines.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }
}
