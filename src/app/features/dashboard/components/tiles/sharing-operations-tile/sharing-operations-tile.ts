import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { SharingOperationPartialDTO } from '../../../../../shared/dtos/sharing_operation.dtos';
import { SharingOperationTypePipe } from '../../../../../shared/pipes/sharing-operation-type/sharing-operation-type-pipe';
import { TileState } from '../../../dashboard-format';
import { DashboardTile } from '../dashboard-tile/dashboard-tile';

/** How many operations the tile names before deferring to the full list. */
const VISIBLE_LIMIT = 5;

/**
 * The community's sharing operations.
 *
 * Reads nothing itself — the container fetches the list once and passes it to
 * the three tiles that need it, rather than each tile issuing the same request.
 */
@Component({
  selector: 'app-sharing-operations-tile',
  standalone: true,
  imports: [TranslatePipe, RouterLink, SharingOperationTypePipe, DashboardTile],
  templateUrl: './sharing-operations-tile.html',
})
export class SharingOperationsTile {
  readonly operations = input.required<SharingOperationPartialDTO[]>();
  readonly operationsLoading = input.required<boolean>();
  readonly operationsFailed = input.required<boolean>();
  /** Accepted for symmetry with the other tiles; the container owns the refetch. */
  readonly reloadKey = input<number>(0);

  /**
   * The tile reads nothing itself, so the only thing its retry button can do is
   * ask the container to fetch the list again. Forwarded rather than swallowed —
   * an unbound retry renders a button that does nothing.
   */
  readonly retry = output<void>();

  readonly visible = computed(() => this.operations().slice(0, VISIBLE_LIMIT));

  readonly state = computed<TileState>(() => {
    if (this.operationsLoading()) return 'loading';
    if (this.operationsFailed()) return 'error';
    return this.operations().length === 0 ? 'empty' : 'ready';
  });
}
