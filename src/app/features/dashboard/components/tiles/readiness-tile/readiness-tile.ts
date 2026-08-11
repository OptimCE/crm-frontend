import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Tag } from 'primeng/tag';

import { CommunityDashboardDTO } from '../../../../../shared/dtos/dashboard.dtos';
import { DashboardService } from '../../../../../shared/services/dashboard.service';
import {
  envelopeData,
  readinessItems,
  ReadinessItem,
  tagSeverity,
  TileState,
  worstSeverity,
} from '../../../dashboard-format';
import { DashboardTile } from '../dashboard-tile/dashboard-tile';

/**
 * "Is my community able to operate?" — the most valuable tile on the page, and
 * 100% core: it needs no subscription at all.
 *
 * It is also the natural upsell path, because the fields it chases (IBAN, VAT,
 * legal name) are exactly the ones billing and administrative-document later
 * require.
 *
 * Every row is a count, a plain-language sentence and a named link to the screen
 * that fixes it. No colour-only severity: each row carries an icon and a text
 * label, because a manager reading this is not necessarily an IT specialist.
 */
@Component({
  selector: 'app-readiness-tile',
  standalone: true,
  imports: [TranslatePipe, RouterLink, Tag, DashboardTile],
  templateUrl: './readiness-tile.html',
})
export class ReadinessTile {
  private readonly dashboardService = inject(DashboardService);
  private readonly destroyRef = inject(DestroyRef);

  readonly reloadKey = input<number>(0);

  private readonly data = signal<CommunityDashboardDTO | null>(null);
  private readonly failed = signal<boolean>(false);
  private readonly loading = signal<boolean>(true);

  readonly items = computed<ReadinessItem[]>(() => {
    const data = this.data();
    return data ? readinessItems(data) : [];
  });

  readonly state = computed<TileState>(() => {
    if (this.loading()) return 'loading';
    if (this.failed()) return 'error';
    return this.items().length === 0 ? 'empty' : 'ready';
  });

  /** Aggregate badge, so the manager can triage without reading every row. */
  readonly badgeSeverity = computed(() => tagSeverity(worstSeverity(this.items())));

  constructor() {
    effect(() => {
      this.reloadKey();
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.dashboardService
      .getCommunityDashboard()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          // The backend answers 200 with `data` as a string on failure; treating
          // that as the payload would render garbage counters.
          const data = envelopeData(response);
          if (!data) this.failed.set(true);
          else this.data.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }
}
