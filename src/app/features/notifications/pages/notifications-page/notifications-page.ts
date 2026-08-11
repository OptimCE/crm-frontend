import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Paginator, PaginatorState } from 'primeng/paginator';

import { HeaderPage } from '../../../../layout/header-page/header-page';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { NotificationItem } from '../../components/notification-item/notification-item';
import { NotificationDTO } from '../../dtos/notification.dto';
import { routeFor } from '../../services/notification-type.registry';
import { canNavigate } from '../../services/notification-navigation';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { CommunityServicesStore } from '../../../../core/services/community-services.store';
import { NotificationService } from '../../services/notification.service';
import { NotificationStore } from '../../services/notification.store';

const PAGE_SIZE = 20;

/** Full paginated notification history, reached via the bell's "See all" link. */
@Component({
  selector: 'app-notifications-page',
  imports: [HeaderPage, Paginator, TranslatePipe, NotificationItem],
  templateUrl: './notifications-page.html',
  styleUrl: './notifications-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ErrorMessageHandler],
})
export class NotificationsPage implements OnInit {
  private readonly service = inject(NotificationService);
  private readonly store = inject(NotificationStore);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly router = inject(Router);
  private readonly userContext = inject(UserContextService);
  private readonly services = inject(CommunityServicesStore);

  protected readonly items = signal<NotificationDTO[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  /** 0-based first record, the shape PrimeNG's paginator expects. */
  protected readonly first = signal(0);
  protected readonly rows = PAGE_SIZE;

  protected readonly hasUnread = computed(() => this.store.unreadCount() > 0);
  protected readonly showPaginator = computed(() => this.total() > this.rows);
  protected readonly isEmpty = computed(
    () => !this.loading() && !this.failed() && this.items().length === 0,
  );

  ngOnInit(): void {
    this.store.refreshUnread();
    this.load();
  }

  protected onPageChange(event: PaginatorState): void {
    this.first.set(event.first ?? 0);
    this.load();
  }

  /**
   * Mark read always; navigate only when the destination is actually reachable.
   *
   * Otherwise the row is marked read and the user is bounced to `/users` with no
   * explanation — the notification they clicked simply disappears. See
   * `canNavigate` for the two ways that happens.
   */
  protected onItemClick(notification: NotificationDTO): void {
    if (!notification.read_at) {
      this.patchLocal(notification.id);
      this.store.markRead(notification.id);
    }

    const route = routeFor(notification);
    if (!route) return;
    if (
      !canNavigate(notification, this.userContext.activeCommunityId(), (feature) =>
        this.services.canReach(feature),
      )
    ) {
      return;
    }
    void this.router.navigateByUrl(route);
  }

  protected onMarkAll(): void {
    this.store.markAllRead();
    const now = new Date().toISOString();
    this.items.update((list) => list.map((n) => (n.read_at ? n : { ...n, read_at: now })));
  }

  protected retry(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.failed.set(false);
    const page = Math.floor(this.first() / this.rows) + 1;

    this.service.list({ page, limit: this.rows }).subscribe({
      next: (res) => {
        this.items.set(Array.isArray(res.data) ? res.data : []);
        this.total.set(res.pagination?.total ?? 0);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.failed.set(true);
        this.loading.set(false);
        this.errorHandler.handleError(error);
      },
    });
  }

  private patchLocal(id: string): void {
    const now = new Date().toISOString();
    this.items.update((list) => list.map((n) => (n.id === id ? { ...n, read_at: now } : n)));
  }
}
