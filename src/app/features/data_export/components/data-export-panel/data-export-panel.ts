import { Location } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  OnInit,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import Keycloak from 'keycloak-js';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Skeleton } from 'primeng/skeleton';
import { TableModule, TablePageEvent } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { EMPTY, fromEvent, interval, merge, Subscription, switchMap } from 'rxjs';
import { filter } from 'rxjs/operators';

import { INFO_TYPE, VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { Pagination } from '../../../../core/dtos/api.response';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { LocaleDatePipe } from '../../../../shared/pipes/locale-format/locale-format-pipes';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import {
  extractApiErrorCode,
  extractApiErrorMessage,
} from '../../../../shared/utils/api-error.utils';
import {
  DATA_EXPORT_ERRORS,
  hasOwnInProgress,
  isInProgress,
  requesterName,
  RESUME_PARAM,
  RESUME_VALUE,
  resumePath,
  savePendingExport,
  statusKey,
  statusSeverity,
  takePendingExport,
} from '../../data-export-format';
import { CreateDataExportDTO, DataExportDTO, DataExportScope } from '../../data-export.dto';
import { DataExportService } from '../../data-export.service';

/** While an export is in preparation and the page is visible, the list is read again this often. */
export const DATA_EXPORT_POLL_MS = 5000;
const PAGE_LIMIT = 10;
/** The login age the API asks for (spec: `max_age=300`). */
const STEP_UP_MAX_AGE_SECONDS = 300;

/**
 * The export screen, for either scope:
 *  - `user` (Profil > Mes exports): « Exporter mes données » and the caller's own
 *    exports, of both scopes, since a community export's requester downloads it
 *    from here too;
 *  - `community` (Gestion > Exports, ADMIN): « Exporter les données de la
 *    communauté » behind a warning, and every export of the active community.
 *    Only its requester gets a download button (`can_download`).
 *
 * Step-up: the API wants a login of less than 5 minutes (401 35000). The
 * request goes to sessionStorage, Keycloak is asked for a login with
 * `max_age=300`, back to this screen with `?resume=export`, where the request
 * is replayed ONCE: a second 35000 ends in a message, never in another login.
 *
 * The file itself is never fetched by the app: the presigned URL is opened by
 * navigation and the browser saves it (the URL carries the Content-Disposition).
 */
@Component({
  selector: 'app-data-export-panel',
  standalone: true,
  imports: [TranslatePipe, Button, Dialog, Skeleton, TableModule, Tag, LocaleDatePipe],
  providers: [ErrorMessageHandler],
  templateUrl: './data-export-panel.html',
  styleUrl: './data-export-panel.css',
})
export class DataExportPanel implements OnInit {
  private readonly service = inject(DataExportService);
  private readonly userContext = inject(UserContextService);
  private readonly keycloak = inject(Keycloak);
  private readonly location = inject(Location);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  /** Which export this screen asks for, and which list it shows. */
  readonly scope = input.required<DataExportScope>();

  readonly rows = signal<DataExportDTO[]>([]);
  readonly pagination = signal<Pagination>(new Pagination(1, PAGE_LIMIT, 0, 1));
  readonly page = signal(1);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly requesting = signal(false);
  readonly downloadingId = signal<string | null>(null);
  readonly warningVisible = signal(false);

  readonly firstRow = computed(() => (this.pagination().page - 1) * this.pagination().limit);
  readonly showPaginator = computed(() => this.pagination().total_pages > 1);
  readonly anyInProgress = computed(() => this.rows().some((row) => isInProgress(row.status)));
  /** One export at a time per requester and scope: the button waits for the one in preparation. */
  readonly ownInProgress = computed(() =>
    hasOwnInProgress(this.rows(), this.scope(), this.userContext.activeCommunityId()),
  );
  readonly communityName = computed(() => this.userContext.activeCommunity()?.name ?? '');

  protected readonly statusKey = statusKey;
  protected readonly statusSeverity = statusSeverity;
  protected readonly requesterName = requesterName;

  private loadSub: Subscription | null = null;

  constructor() {
    // A first read, and again whenever the active community or the page changes.
    effect(() => {
      this.scope();
      this.userContext.activeCommunityId();
      this.page();
      untracked(() => this.load());
    });

    // Polling only while something is in preparation, and only while the page is
    // visible; coming back to the page reads at once instead of waiting a period.
    toObservable(this.anyInProgress)
      .pipe(
        switchMap((active) =>
          active
            ? merge(
                interval(DATA_EXPORT_POLL_MS),
                fromEvent(document, 'visibilitychange').pipe(filter(() => !document.hidden)),
              )
            : EMPTY,
        ),
        filter(() => !document.hidden),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.load(true));

    this.destroyRef.onDestroy(() => this.loadSub?.unsubscribe());
  }

  ngOnInit(): void {
    this.resume();
  }

  /** Read the list. `silent` (a poll) keeps the rows on screen and swallows a failure. */
  load(silent = false): void {
    this.loadSub?.unsubscribe();
    if (!silent) {
      this.loading.set(true);
      this.loadError.set(false);
    }
    this.loadSub = this.service
      .list({
        view: this.scope() === 'user' ? 'mine' : 'community',
        page: this.page(),
        limit: PAGE_LIMIT,
      })
      .subscribe({
        next: (response) => {
          this.rows.set(Array.isArray(response.data) ? response.data : []);
          if (response.pagination) this.pagination.set(response.pagination);
          this.loading.set(false);
          this.loadError.set(false);
        },
        error: () => {
          this.loading.set(false);
          if (!silent) this.loadError.set(true);
        },
      });
  }

  onPage(event: TablePageEvent): void {
    const page = Math.floor(event.first / event.rows) + 1;
    if (page !== this.page()) this.page.set(page);
  }

  /** The button: a user export at once, a community export after the warning. */
  onRequest(): void {
    if (this.requesting() || this.ownInProgress()) return;
    if (this.scope() === 'community') {
      this.warningVisible.set(true);
      return;
    }
    this.send({ scope: 'user' });
  }

  /** « Exporter » in the warning dialog. */
  confirmCommunityExport(): void {
    const communityId = this.userContext.activeCommunityId();
    this.warningVisible.set(false);
    if (!communityId) return;
    this.send({ scope: 'community', community_id: communityId });
  }

  download(row: DataExportDTO): void {
    if (!row.can_download || this.downloadingId()) return;
    this.downloadingId.set(row.id);
    this.service
      .downloadUrl(row.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.downloadingId.set(null);
          this.navigate(response.data.url);
        },
        error: (error: unknown) => {
          this.downloadingId.set(null);
          this.errorHandler.handleError(extractApiErrorMessage(error));
          const code = extractApiErrorCode(error);
          // The row no longer says what the server knows: read it again.
          if (code === DATA_EXPORT_ERRORS.EXPIRED || code === DATA_EXPORT_ERRORS.NOT_READY) {
            this.load();
          }
        },
      });
  }

  /** Opening the presigned URL: the browser saves the file and stays on this page. */
  protected navigate(url: string): void {
    window.location.assign(url);
  }

  private send(body: CreateDataExportDTO, replay = false): void {
    this.requesting.set(true);
    this.service
      .request(body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.requesting.set(false);
          this.snackbar.openSnackBar(
            this.translate.instant('DATA_EXPORT.REQUESTED') as string,
            VALIDATION_TYPE,
          );
          if (this.page() === 1) this.load();
          else this.page.set(1);
        },
        error: (error: unknown) => {
          this.requesting.set(false);
          const code = extractApiErrorCode(error);
          if (code === DATA_EXPORT_ERRORS.REAUTH_REQUIRED) {
            if (replay) {
              this.errorHandler.handleError(
                this.translate.instant('DATA_EXPORT.STEP_UP_FAILED') as string,
              );
            } else {
              this.stepUp(body);
            }
            return;
          }
          this.errorHandler.handleError(extractApiErrorMessage(error));
          // An export is already in preparation: show it.
          if (code === DATA_EXPORT_ERRORS.ALREADY_ACTIVE) this.load();
        },
      });
  }

  /** Keep the request, then a fresh login that comes back here with the resume marker. */
  private stepUp(body: CreateDataExportDTO): void {
    savePendingExport({
      scope: body.scope,
      community_id: body.community_id ?? null,
      at: Date.now(),
    });
    this.snackbar.openSnackBar(this.translate.instant('DATA_EXPORT.STEP_UP') as string, INFO_TYPE);
    const path = this.location.prepareExternalUrl(resumePath(body.scope));
    void this.keycloak.login({
      // Absolute, on this origin, under the app's base href.
      redirectUri: new URL(path, window.location.origin).href,
      maxAge: STEP_UP_MAX_AGE_SECONDS,
    });
  }

  /**
   * Back from the step-up login: replay the kept request once, if it is this
   * screen's, recent, and (for a community) still the active community's.
   * The marker leaves the URL either way, so a reload never replays.
   */
  private resume(): void {
    if (this.route.snapshot.queryParamMap.get(RESUME_PARAM) !== RESUME_VALUE) return;
    const pending = takePendingExport();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [RESUME_PARAM]: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    if (!pending || pending.scope !== this.scope()) return;
    if (pending.scope === 'community') {
      const communityId = this.userContext.activeCommunityId();
      if (!communityId || pending.community_id !== communityId) return;
      this.send({ scope: 'community', community_id: communityId }, true);
      return;
    }
    this.send({ scope: 'user' }, true);
  }
}
