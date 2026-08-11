import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { MyCommunityDTO } from '../../../../shared/dtos/community.dtos';
import { CommunityService } from '../../../../shared/services/community.service';
import { UserService } from '../../../../shared/services/user.service';
import { CommunityPicker } from '../community-picker/community-picker';
import { MyDocumentsPanel } from '../panels/my-documents-panel/my-documents-panel';
import { MyEnergyPanel } from '../panels/my-energy-panel/my-energy-panel';
import { MyFilingsPanel } from '../panels/my-filings-panel/my-filings-panel';
import { MyInvoicesPanel } from '../panels/my-invoices-panel/my-invoices-panel';
import { NeedsYouBand } from '../needs-you-band/needs-you-band';

/**
 * `/home` — the post-login landing page, for every role.
 *
 * Unlike `/dashboard` this is deliberately NOT role-branched. Everything on it
 * is user-scoped rather than community-scoped, and the four questions it answers
 * are the same whoever is asking: *is anything waiting for me*, *which community
 * am I going into*, *what is mine*, *what has been said about me*.
 *
 * **Nothing here may require an active community.** This page is what a user
 * sees immediately after login, when `activeCommunityId()` is null and every
 * community-scoped request would 401 — see `activeCommunityGuard`, which
 * redirects *here*. Every read is either `/me/*`, `/notifications` or
 * `/communities/my-communities`, all of which carry `idChecker()` alone.
 *
 * Reading order is chosen for someone who is not sure why they are here: what
 * needs them first (and nothing at all when the answer is "nothing"), then the
 * way into a community, then reference material.
 */
@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [
    TranslatePipe,
    NeedsYouBand,
    CommunityPicker,
    MyEnergyPanel,
    MyDocumentsPanel,
    MyInvoicesPanel,
    MyFilingsPanel,
  ],
  templateUrl: './home-page.html',
})
export class HomePage {
  private readonly communityService = inject(CommunityService);
  private readonly userService = inject(UserService);
  private readonly userContext = inject(UserContextService);
  private readonly destroyRef = inject(DestroyRef);

  /** Where the guard wanted to send the user, round-tripped through the picker. */
  readonly returnUrl = input<string | undefined>();

  private readonly main = viewChild<ElementRef<HTMLElement>>('main');

  readonly communities = signal<MyCommunityDTO[]>([]);
  readonly communitiesLoading = signal<boolean>(true);
  readonly communitiesFailed = signal<boolean>(false);
  readonly firstName = signal<string | null>(null);

  /**
   * The greeting. Falls back to a neutral welcome rather than "Bonjour null" —
   * the profile call is allowed to fail without spoiling the first line of the
   * page.
   */
  readonly greetingKey = computed(() =>
    this.firstName() ? 'HOME.GREETING' : 'HOME.GREETING_ANON',
  );

  constructor() {
    this.load();
    // The repo has no focus management anywhere. Scoped minimum: arriving here
    // from login or from a guard redirect lands the caret at the top of the new
    // content instead of leaving it on the sidebar.
    afterNextRender(() => this.main()?.nativeElement.focus());
  }

  load(): void {
    this.communitiesLoading.set(true);
    this.communitiesFailed.set(false);

    forkJoin({
      // A high limit rather than paging: this list IS the way into a community,
      // and a paginator on the most important control in the app would be a
      // trap. Single digits in practice.
      communities: this.communityService
        .getMyCommunities({ page: 1, limit: 100 })
        .pipe(catchError(() => of(null))),
      user: this.userService.getUserInfo().pipe(catchError(() => of(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ communities, user }) => {
        const rows = communities?.data;
        if (!Array.isArray(rows)) {
          this.communitiesFailed.set(true);
        } else {
          this.communities.set(rows);
        }
        const profile = user?.data;
        this.firstName.set(
          profile && typeof profile !== 'string' ? (profile.first_name ?? null) : null,
        );
        this.communitiesLoading.set(false);
      });
  }

  /** Cheap enough to recompute; `communities()` is single digits. */
  readonly hasCommunities = computed(() => this.communities().length > 0);

  protected readonly activeCommunityId = this.userContext.activeCommunityId;
}
