import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Skeleton } from 'primeng/skeleton';

import { ApiResponse } from '../../../../core/dtos/api.response';
import { Role } from '../../../../core/dtos/role';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { PostListItem } from '../../../../shared/dtos/news.dtos';
import { NewsService } from '../../../../shared/services/news.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { HeaderPage } from '../../../../layout/header-page/header-page';
import { NewsComposeDialog } from '../news-compose-dialog/news-compose-dialog';
import { NewsPost } from '../news-post/news-post';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-news-board',
  standalone: true,
  imports: [TranslatePipe, Button, Skeleton, ConfirmDialog, HeaderPage, NewsPost],
  providers: [DialogService, ConfirmationService, ErrorMessageHandler],
  templateUrl: './news-board.html',
  styleUrl: './news-board.css',
})
export class NewsBoard implements OnInit {
  private readonly service = inject(NewsService);
  private readonly userContext = inject(UserContextService);
  private readonly translate = inject(TranslateService);
  private readonly dialogService = inject(DialogService);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);
  private dialogRef?: DynamicDialogRef | null;

  readonly posts = signal<PostListItem[]>([]);
  readonly loading = signal<boolean>(true);
  readonly loadingMore = signal<boolean>(false);
  readonly page = signal<number>(1);
  readonly totalPages = signal<number>(1);

  readonly canManage = computed(() => this.userContext.compareWithActiveRole(Role.GESTIONNAIRE));
  readonly hasMore = computed(() => this.page() < this.totalPages());

  constructor() {
    this.destroyRef.onDestroy(() => this.dialogRef?.destroy());
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.page.set(1);
    this.service.invalidate();
    this.service
      .listPosts({ page: 1, page_size: PAGE_SIZE })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.posts.set(Array.isArray(res.data) ? res.data : []);
          this.totalPages.set(res.pagination?.total_pages ?? 1);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.handleError(error);
        },
      });
  }

  loadMore(): void {
    if (!this.hasMore() || this.loadingMore()) return;
    const next = this.page() + 1;
    this.loadingMore.set(true);
    this.service
      .listPosts({ page: next, page_size: PAGE_SIZE })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const more = Array.isArray(res.data) ? res.data : [];
          this.posts.update((current) => [...current, ...more]);
          this.page.set(next);
          this.totalPages.set(res.pagination?.total_pages ?? this.totalPages());
          this.loadingMore.set(false);
        },
        error: (error: unknown) => {
          this.loadingMore.set(false);
          this.handleError(error);
        },
      });
  }

  openComposer(): void {
    this.openDialog('create');
  }

  onEdit(post: PostListItem): void {
    this.openDialog('edit', post.id);
  }

  private openDialog(mode: 'create' | 'edit', postId?: number): void {
    this.dialogRef = this.dialogService.open(NewsComposeDialog, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      width: '42rem',
      styleClass: 'responsive-dialog',
      header: this.translate.instant(
        mode === 'create' ? 'NEWS_BOARD.COMPOSE.TITLE_CREATE' : 'NEWS_BOARD.COMPOSE.TITLE_EDIT',
      ) as string,
      data: { mode, postId },
    });
    this.dialogRef?.onClose
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((saved: boolean) => {
        if (saved) this.reload();
      });
  }

  protected readonly skeletons = [1, 2, 3];

  private handleError(error: unknown): void {
    this.errorHandler.handleError(error instanceof ApiResponse ? (error.data as string) : null);
  }
}
