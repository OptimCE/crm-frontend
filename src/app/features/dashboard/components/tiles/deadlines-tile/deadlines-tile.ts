import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Tag } from 'primeng/tag';

import { LocaleService } from '../../../../../core/services/language/locale.service';
import { ProcedureDeadlineOut } from '../../../../../shared/dtos/administrative-procedure.dtos';
import { AdministrativeProcedureService } from '../../../../../shared/services/administrative-procedure.service';
import { formatApiDate } from '../../../../administrative_document/administrative-document-format';
import { pickLabel } from '../../../../administrative_document/procedures/procedure-format';
import { envelopeData, TileState } from '../../../dashboard-format';
import { DashboardTile } from '../dashboard-tile/dashboard-tile';

/** How many upcoming deadlines are named in the tile. */
const VISIBLE_LIMIT = 3;

/**
 * The espace administratif's open deadlines, split into "overdue" and "still
 * coming". Both are the annex's: the agenda without a period is every deadline
 * still owed (a community's missed one included), and `overdue` is decided
 * server-side.
 */
@Component({
  selector: 'app-deadlines-tile',
  standalone: true,
  imports: [TranslatePipe, RouterLink, Tag, DashboardTile],
  templateUrl: './deadlines-tile.html',
})
export class DeadlinesTile {
  private readonly service = inject(AdministrativeProcedureService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lang = inject(LocaleService).locale;

  readonly reloadKey = input<number>(0);

  readonly deadlines = signal<ProcedureDeadlineOut[]>([]);
  private readonly failed = signal<boolean>(false);
  private readonly loading = signal<boolean>(true);

  readonly overdue = computed(() => this.deadlines().filter((d) => d.overdue));
  readonly upcoming = computed(() => this.deadlines().filter((d) => !d.overdue));
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

  label(deadline: ProcedureDeadlineOut): string {
    return (
      pickLabel(deadline.labels, this.lang()) ||
      pickLabel(deadline.procedure_labels, this.lang(), deadline.procedure_code)
    );
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.service
      .listDeadlines()
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
