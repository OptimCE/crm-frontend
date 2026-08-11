import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';

import { MyFilingOut } from '../../../../shared/dtos/administrative-document.dtos';
import { AdministrativeDocumentService } from '../../../../shared/services/administrative-document.service';
import {
  FilingRowField,
  filingRowFields,
  formatApiDate,
} from '../../administrative-document-format';

/** One block of the caller's rows, ready to render as label/value pairs. */
export interface MyFilingSection {
  labelKey: string;
  rows: FilingRowField[][];
}

/**
 * "Ce qui a été déclaré à mon sujet" — the member branch of
 * `/administrative-document`.
 *
 * Answers one question in plain terms: *you appear in these filings, with these
 * values, as of this date*. Everything shown is read from the frozen snapshot,
 * never from the CRM, because the point is what was **filed** — a value the
 * community has since corrected must still show as it went to the regulator.
 *
 * There is no action here on purpose. A member cannot amend a filing: the
 * versions are append-only by database trigger, and correcting one is a
 * manager's regulatory act. The empty state says who to ask instead.
 */
@Component({
  selector: 'app-my-filings',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './my-filings.html',
})
export class MyFilings {
  private readonly service = inject(AdministrativeDocumentService);
  private readonly destroyRef = inject(DestroyRef);

  readonly reloadKey = input<number>(0);

  readonly filings = signal<MyFilingOut[]>([]);
  readonly loading = signal<boolean>(true);
  readonly failed = signal<boolean>(false);

  readonly isEmpty = computed(
    () => !this.loading() && !this.failed() && this.filings().length === 0,
  );

  /** Bare `YYYY-MM-DD` must not go through `| date` — it parses as UTC midnight. */
  protected readonly formatApiDate = formatApiDate;

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.service
      .listMyFilings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const data = response.data;
          if (!Array.isArray(data)) {
            // The backend reuses the success envelope for failures: HTTP 200
            // with `data` as a message string and a non-zero error_code.
            this.failed.set(true);
          } else {
            this.filings.set(data);
          }
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  /** The non-empty row blocks of a filing, in the order a reader expects. */
  sections(filing: MyFilingOut): MyFilingSection[] {
    const blocks: [keyof MyFilingOut['my_rows'], string][] = [
      ['members', 'ADMINISTRATIVE_DOCUMENT.MY_FILINGS.BLOCKS.MEMBERS'],
      ['participants', 'ADMINISTRATIVE_DOCUMENT.MY_FILINGS.BLOCKS.PARTICIPANTS'],
      ['installations', 'ADMINISTRATIVE_DOCUMENT.MY_FILINGS.BLOCKS.INSTALLATIONS'],
      ['storage', 'ADMINISTRATIVE_DOCUMENT.MY_FILINGS.BLOCKS.STORAGE'],
    ];
    return blocks
      .filter(([block]) => filing.my_rows[block].length > 0)
      .map(([block, labelKey]) => ({
        labelKey,
        rows: filing.my_rows[block].map((row) => filingRowFields(row)),
      }));
  }
}
