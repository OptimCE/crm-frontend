import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { fromEvent, merge, Subject, timer } from 'rxjs';
import { filter, switchMap } from 'rxjs';

import { ERROR_TYPE, VALIDATION_TYPE } from '../../../core/dtos/notification';
import { SnackbarNotification } from '../../../shared/services-ui/snackbar.notifcation.service';
import { NotificationDTO } from '../dtos/notification.dto';
import { NotificationService } from './notification.service';

/** How often the unread badge is polled (backend has no realtime channel). */
const POLL_INTERVAL_MS = 30_000;
/** How many recent items the bell popover shows. */
const RECENT_LIMIT = 8;

/**
 * Single source of truth for notification state shared between the sidebar bell
 * and the full page. Holds the unread count + a small "recent" slice for the
 * popover, polls the unread count on an interval (paused while the tab is
 * hidden), and applies optimistic updates on mark-read actions.
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationStore {
  private readonly service = inject(NotificationService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly unreadCount = signal(0);
  readonly recent = signal<NotificationDTO[]>([]);
  readonly loadingRecent = signal(false);

  /** -1 until the first poll resolves, so we never toast on initial load. */
  private lastCount = -1;
  private polling = false;
  private readonly refresh$ = new Subject<void>();

  /** Start the unread-count poll. Idempotent — safe to call once from the shell. */
  startPolling(): void {
    if (this.polling) return;
    this.polling = true;

    const visibleAgain$ = fromEvent(document, 'visibilitychange').pipe(
      filter(() => !document.hidden),
    );

    merge(timer(0, POLL_INTERVAL_MS), visibleAgain$, this.refresh$)
      .pipe(
        filter(() => !document.hidden),
        switchMap(() => this.service.unreadCount()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => this.applyCount(res.data.count),
        // Swallow transient poll errors; the next tick retries.
        error: () => undefined,
      });
  }

  /** Force an immediate unread-count refresh (e.g. after navigating). */
  refreshUnread(): void {
    this.refresh$.next();
  }

  /** Reload the recent slice shown in the popover. */
  refreshRecent(): void {
    this.loadingRecent.set(true);
    this.service
      .list({ page: 1, limit: RECENT_LIMIT })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.recent.set(Array.isArray(res.data) ? res.data : []);
          this.loadingRecent.set(false);
        },
        error: () => this.loadingRecent.set(false),
      });
  }

  /** Optimistically mark one notification read, then persist. */
  markRead(id: string): void {
    const target = this.recent().find((n) => n.id === id);
    if (target && target.read_at) return; // already read — no-op

    this.patchRecent(id);
    this.unreadCount.update((c) => Math.max(0, c - 1));

    this.service
      .markRead(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => (this.lastCount = this.unreadCount()),
        error: () => this.reconcileAfterError(),
      });
  }

  /** Optimistically mark all read, then persist. */
  markAllRead(): void {
    if (this.unreadCount() === 0) return;

    const now = new Date().toISOString();
    this.recent.update((list) => list.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    this.unreadCount.set(0);

    this.service
      .markAllRead()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => (this.lastCount = 0),
        error: () => this.reconcileAfterError(),
      });
  }

  private applyCount(count: number): void {
    if (this.lastCount >= 0 && count > this.lastCount) {
      this.snackbar.openSnackBar(
        this.translate.instant('NOTIFICATIONS.NEW_TOAST') as string,
        VALIDATION_TYPE,
      );
    }
    this.lastCount = count;
    this.unreadCount.set(count);
  }

  private patchRecent(id: string): void {
    const now = new Date().toISOString();
    this.recent.update((list) => list.map((n) => (n.id === id ? { ...n, read_at: now } : n)));
  }

  /** A persist call failed — drop optimistic state and refetch the truth. */
  private reconcileAfterError(): void {
    this.snackbar.openSnackBar(
      this.translate.instant('COMMON.ERRORS.EXCEPTION') as string,
      ERROR_TYPE,
    );
    this.service.invalidate();
    this.refreshRecent();
    this.refreshUnread();
  }
}
