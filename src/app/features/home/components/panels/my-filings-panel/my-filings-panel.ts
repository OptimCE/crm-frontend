import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { UserContextService } from '../../../../../core/services/authorization/authorization.service';
import { CommunityServicesStore } from '../../../../../core/services/community-services.store';
import { DashboardTile } from '../../../../dashboard/components/tiles/dashboard-tile/dashboard-tile';
import { TileState } from '../../../../dashboard/dashboard-format';
import { formatApiDate } from '../../../../administrative_document/administrative-document-format';
import { MyFilingOut } from '../../../../../shared/dtos/administrative-document.dtos';
import { MyCommunityDTO } from '../../../../../shared/dtos/community.dtos';
import { AdministrativeDocumentService } from '../../../../../shared/services/administrative-document.service';
import { envelopeData } from '../../../home-format';

/** One community's filings that name the caller. */
export interface CommunityFilings {
  community: MyCommunityDTO;
  filings: MyFilingOut[];
}

/**
 * "Ce qui a été déclaré à mon sujet" — the transparency surface, across every
 * community.
 *
 * Answers, in one line per filing: *you appear in this document, filed on this
 * date*. The values themselves live one click away in the annexe's member view;
 * repeating a regulatory form's fields on a landing page would bury everything
 * else on it.
 *
 * Fanned out per community and gated on subscription, exactly like the invoices
 * panel — and for the same reason: this annexe resolves its tenant from
 * `X-Community-ID`, and an unsubscribed one must issue zero requests.
 */
@Component({
  selector: 'app-my-filings-panel',
  standalone: true,
  imports: [TranslatePipe, DashboardTile],
  templateUrl: './my-filings-panel.html',
})
export class MyFilingsPanel {
  private readonly service = inject(AdministrativeDocumentService);
  private readonly servicesStore = inject(CommunityServicesStore);
  private readonly userContext = inject(UserContextService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly communities = input.required<MyCommunityDTO[]>();

  readonly rows = signal<CommunityFilings[]>([]);
  private readonly failed = signal<boolean>(false);
  private readonly loading = signal<boolean>(true);

  readonly total = computed(() => this.rows().reduce((sum, row) => sum + row.filings.length, 0));

  readonly state = computed<TileState>(() => {
    if (this.loading()) return 'loading';
    if (this.failed()) return 'error';
    return this.total() === 0 ? 'empty' : 'ready';
  });

  /** Bare `YYYY-MM-DD` must not go through `| date` — it parses as UTC midnight. */
  protected readonly formatApiDate = formatApiDate;

  constructor() {
    // An effect, not a direct call: `load()` reads the required `communities`
    // input, and a required input is not bound yet when the constructor runs
    // (NG0950). It also makes the fan-out re-run when the community list
    // resolves, which is exactly when the parent has something to fan out over.
    effect(() => {
      this.communities();
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);

    const communities = this.communities();
    if (communities.length === 0) {
      this.rows.set([]);
      this.loading.set(false);
      return;
    }

    forkJoin(
      communities.map((community) =>
        this.servicesStore.catalogFor(community.auth_community_id).pipe(
          switchMap((annexes) => {
            const subscribed = annexes.some(
              (a) => a.feature === 'administrative-document' && a.subscribed,
            );
            if (!subscribed) return of<CommunityFilings | null>(null);
            return this.service.listMyFilingsForCommunity(community.auth_community_id, 20).pipe(
              switchMap((response) => {
                const filings = envelopeData<MyFilingOut[]>(response) ?? [];
                return of<CommunityFilings | null>(
                  filings.length > 0 ? { community, filings } : null,
                );
              }),
              catchError(() => of<CommunityFilings | null>(null)),
            );
          }),
          catchError(() => of<CommunityFilings | null>(null)),
        ),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (results) => {
          this.rows.set(results.filter((row): row is CommunityFilings => row !== null));
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  /**
   * Enter the community, then open the annexe's member view.
   *
   * Setting the context first, for the same reason as the invoices panel:
   * `/administrative-document` carries `activeFeatureGuard`, which reads the
   * ACTIVE community, and this page may have none.
   */
  openFilings(community: MyCommunityDTO): void {
    this.userContext.switchCommunity(community.auth_community_id);
    void this.router.navigateByUrl('/administrative-document');
  }
}
