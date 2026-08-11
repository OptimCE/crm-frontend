import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { PostListItem } from '../../../../../shared/dtos/news.dtos';
import { TimeAgoPipe } from '../../../../../shared/pipes/time-ago/time-ago-pipe';
import { NewsService } from '../../../../../shared/services/news.service';
import { TileState } from '../../../dashboard-format';
import { DashboardTile } from '../dashboard-tile/dashboard-tile';

const POST_LIMIT = 3;

/**
 * The community's latest posts — the one tile genuinely shared by both roles.
 *
 * Manager and member issue the identical request and render identical rows; only
 * the empty-state copy and the presence of a "publish" action differ, so those
 * are inputs rather than a second component.
 *
 * Note the pagination parameter is `page_size`, not `limit`: news-board is the
 * one service in the platform that names it differently.
 */
@Component({
  selector: 'app-news-tile',
  standalone: true,
  imports: [TranslatePipe, RouterLink, TimeAgoPipe, DashboardTile],
  templateUrl: './news-tile.html',
})
export class NewsTile {
  private readonly newsService = inject(NewsService);
  private readonly destroyRef = inject(DestroyRef);

  /** Managers may publish; members may not. Drives the empty state's call to action. */
  readonly canPublish = input<boolean>(false);
  readonly reloadKey = input<number>(0);

  readonly posts = signal<PostListItem[]>([]);
  private readonly failed = signal<boolean>(false);
  private readonly loading = signal<boolean>(true);

  /** An open poll the reader has not answered is the one thing worth nudging. */
  readonly openPolls = computed(() =>
    this.posts().filter((post) => post.is_poll && !post.poll_ended && !post.has_voted),
  );

  readonly state = computed<TileState>(() => {
    if (this.loading()) return 'loading';
    if (this.failed()) return 'error';
    return this.posts().length === 0 ? 'empty' : 'ready';
  });

  constructor() {
    effect(() => {
      this.reloadKey();
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.newsService
      .listPosts({ page: 1, page_size: POST_LIMIT })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const data = response.data;
          if (!Array.isArray(data)) this.failed.set(true);
          else this.posts.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }
}
