import { Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Menu } from 'primeng/menu';

import { ApiResponse } from '../../../../core/dtos/api.response';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { PostListItem } from '../../../../shared/dtos/news.dtos';
import { NewsService } from '../../../../shared/services/news.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { timeAgo } from '../../news-format';
import { NewsPoll } from '../news-poll/news-poll';

@Component({
  selector: 'app-news-post',
  standalone: true,
  imports: [TranslatePipe, Button, Menu, NewsPoll],
  templateUrl: './news-post.html',
  styleUrl: './news-post.css',
})
export class NewsPost {
  readonly post = input.required<PostListItem>();
  readonly canManage = input<boolean>(false);
  readonly edit = output<PostListItem>();
  readonly changed = output<void>();

  private readonly service = inject(NewsService);
  private readonly translate = inject(TranslateService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  readonly deleting = signal<boolean>(false);

  readonly authorInitial = computed(() => {
    const email = this.post().author_email?.trim();
    return (email?.charAt(0) ?? '?').toUpperCase();
  });

  readonly menuItems = computed<MenuItem[]>(() => [
    {
      label: this.translate.instant('NEWS_BOARD.ACTIONS.EDIT') as string,
      icon: 'pi pi-pencil',
      command: () => this.edit.emit(this.post()),
    },
    {
      label: this.translate.instant('NEWS_BOARD.ACTIONS.DELETE') as string,
      icon: 'pi pi-trash',
      command: () => this.confirmDelete(),
    },
  ]);

  authoredAgo(): string {
    return timeAgo(this.post().created_at, this.translate.currentLang);
  }

  private confirmDelete(): void {
    this.confirmation.confirm({
      header: this.translate.instant('NEWS_BOARD.DELETE.HEADER') as string,
      message: this.translate.instant('NEWS_BOARD.DELETE.MESSAGE') as string,
      acceptLabel: this.translate.instant('COMMON.ACTIONS.VALIDATE') as string,
      rejectLabel: this.translate.instant('COMMON.ACTIONS.CANCEL') as string,
      acceptButtonProps: { severity: 'danger' },
      accept: () => this.doDelete(),
    });
  }

  private doDelete(): void {
    this.deleting.set(true);
    this.service
      .deletePost(this.post().id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.snackbar.openSnackBar(
            this.translate.instant('NEWS_BOARD.DELETE.SUCCESS') as string,
            VALIDATION_TYPE,
          );
          this.changed.emit();
        },
        error: (error: unknown) => {
          this.deleting.set(false);
          this.errorHandler.handleError(
            error instanceof ApiResponse ? (error.data as string) : null,
          );
        },
      });
  }
}
