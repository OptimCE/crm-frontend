import { Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';

import { ApiResponse } from '../../../../core/dtos/api.response';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import {
  MemberDisplay,
  PollResults,
  PostDetail,
  PostListItem,
  PostType,
  VoterIdentity,
} from '../../../../shared/dtos/news.dtos';
import { NewsService } from '../../../../shared/services/news.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { timeUntil } from '../../news-format';

@Component({
  selector: 'app-news-poll',
  standalone: true,
  imports: [TranslatePipe, Button],
  templateUrl: './news-poll.html',
  styleUrl: './news-poll.css',
})
export class NewsPoll implements OnInit {
  readonly post = input.required<PostListItem>();

  private readonly service = inject(NewsService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  readonly detail = signal<PostDetail | null>(null);
  readonly results = signal<PollResults | null>(null);
  readonly loading = signal<boolean>(true);
  readonly submitting = signal<boolean>(false);
  readonly editing = signal<boolean>(false);

  /** Currently selected option ids (single = one element). */
  readonly selection = signal<number[]>([]);

  readonly isSingle = computed(() => this.post().type === PostType.POLL_SINGLE_CHOICE);
  readonly ended = computed(() => this.post().poll_ended);
  readonly hasVoted = computed(() => (this.detail()?.my_option_ids.length ?? 0) > 0);
  readonly showVoting = computed(() => !this.ended() && (this.editing() || !this.hasVoted()));
  readonly resultsVisible = computed(() => this.results()?.visible === true);
  readonly totalVoters = computed(() => this.results()?.total_voters ?? 0);
  readonly canSubmit = computed(() => this.selection().length > 0);

  ngOnInit(): void {
    this.refresh(true);
  }

  // ----- selection -------------------------------------------------------

  isSelected(optionId: number): boolean {
    return this.selection().includes(optionId);
  }

  select(optionId: number): void {
    if (this.submitting()) return;
    if (this.isSingle()) {
      this.selection.set([optionId]);
    } else {
      this.selection.update((cur) =>
        cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId],
      );
    }
  }

  // ----- results display -------------------------------------------------

  isMine(optionId: number): boolean {
    return (this.detail()?.my_option_ids ?? []).includes(optionId);
  }

  countFor(optionId: number): number {
    return this.results()?.options?.find((o) => o.option_id === optionId)?.count ?? 0;
  }

  votersFor(optionId: number): VoterIdentity[] | null {
    return this.results()?.options?.find((o) => o.option_id === optionId)?.voters ?? null;
  }

  percentFor(optionId: number): number {
    const total = this.totalVoters();
    return total <= 0 ? 0 : Math.round((this.countFor(optionId) / total) * 100);
  }

  barWidth(optionId: number): number {
    const options = this.results()?.options ?? [];
    const max = Math.max(1, ...options.map((o) => o.count));
    return Math.round((this.countFor(optionId) / max) * 100);
  }

  hiddenReason(): string {
    switch (this.detail()?.member_display) {
      case MemberDisplay.AFTER_VOTE:
        return this.translate.instant('NEWS_BOARD.POLL.HIDDEN_AFTER_VOTE') as string;
      case MemberDisplay.WHEN_POLL_ENDS:
        return this.translate.instant('NEWS_BOARD.POLL.HIDDEN_WHEN_ENDS') as string;
      default:
        return this.translate.instant('NEWS_BOARD.POLL.HIDDEN_DEFAULT') as string;
    }
  }

  expiryLabel(): string {
    const expires = this.post().expires_at;
    if (!expires) return '';
    if (this.ended()) return this.translate.instant('NEWS_BOARD.POLL.CLOSED') as string;
    const when = timeUntil(expires, this.translate.currentLang);
    return this.translate.instant('NEWS_BOARD.POLL.CLOSES', { when }) as string;
  }

  // ----- actions ---------------------------------------------------------

  startEdit(): void {
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
    this.resetSelectionFromDetail();
  }

  submitVote(): void {
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    this.service
      .castVote(this.post().id, this.selection())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackbar.openSnackBar(
            this.translate.instant('NEWS_BOARD.POLL.VOTE_SUCCESS') as string,
            VALIDATION_TYPE,
          );
          this.editing.set(false);
          this.refresh(false);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.handleError(error);
        },
      });
  }

  retract(): void {
    this.submitting.set(true);
    this.service
      .retractVote(this.post().id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackbar.openSnackBar(
            this.translate.instant('NEWS_BOARD.POLL.RETRACT_SUCCESS') as string,
            VALIDATION_TYPE,
          );
          this.editing.set(false);
          this.refresh(false);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.handleError(error);
        },
      });
  }

  // ----- loading ---------------------------------------------------------

  private refresh(initial: boolean): void {
    if (initial) this.loading.set(true);
    else this.service.invalidate();

    const id = this.post().id;
    forkJoin({ detail: this.service.getPost(id), results: this.service.getResults(id) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ detail, results }) => {
          this.detail.set(detail.data);
          this.results.set(results.data);
          this.resetSelectionFromDetail();
          this.loading.set(false);
          this.submitting.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.submitting.set(false);
          this.handleError(error);
        },
      });
  }

  private resetSelectionFromDetail(): void {
    this.selection.set([...(this.detail()?.my_option_ids ?? [])]);
  }

  private handleError(error: unknown): void {
    this.errorHandler.handleError(error instanceof ApiResponse ? (error.data as string) : null);
  }
}
