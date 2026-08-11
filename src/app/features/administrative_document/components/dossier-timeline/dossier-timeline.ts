import { DatePipe, JsonPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';

import { DocumentOut, StatusEventOut } from '../../../../shared/dtos/administrative-document.dtos';
import { TimelineEntry, toTimelineEntries } from '../../administrative-document-format';

/**
 * The dossier's immutable journal.
 *
 * Purely presentational — it makes no service call, so the whole projection is
 * unit-testable without a TestBed.
 */
@Component({
  selector: 'app-dossier-timeline',
  standalone: true,
  imports: [TranslatePipe, Button, Tag, DatePipe, JsonPipe],
  templateUrl: './dossier-timeline.html',
})
export class DossierTimeline {
  readonly events = input<StatusEventOut[]>([]);
  readonly documentsById = input<ReadonlyMap<number, DocumentOut>>(new Map());
  readonly dossierLabel = input<string>('');
  readonly loading = input<boolean>(false);

  readonly newestFirst = signal<boolean>(true);
  private readonly rawOpen = signal<ReadonlySet<number>>(new Set());

  readonly entries = computed<readonly TimelineEntry[]>(() =>
    toTimelineEntries(this.events(), this.documentsById(), this.dossierLabel(), this.newestFirst()),
  );

  toggleOrder(): void {
    this.newestFirst.update((value) => !value);
  }

  isRawOpen(entry: TimelineEntry): boolean {
    return this.rawOpen().has(entry.id);
  }

  toggleRaw(entry: TimelineEntry): void {
    this.rawOpen.update((set) => {
      const next = new Set(set);
      if (next.has(entry.id)) {
        next.delete(entry.id);
      } else {
        next.add(entry.id);
      }
      return next;
    });
  }

  hasRawContext(entry: TimelineEntry): boolean {
    return Object.keys(entry.rawContext).length > 0;
  }
}
