import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { OverlayBadge } from 'primeng/overlaybadge';
import { Popover } from 'primeng/popover';
import { Tooltip } from 'primeng/tooltip';

import { NotificationDTO } from '../../dtos/notification.dto';
import { presentationFor } from '../../services/notification-type.registry';
import { NotificationStore } from '../../services/notification.store';
import { NotificationItem } from '../notification-item/notification-item';

/**
 * Sidebar-header bell: an unread badge + a popover of the most recent
 * notifications. Owns the lifecycle hook that starts the unread-count poll.
 */
@Component({
  selector: 'app-notification-bell',
  imports: [OverlayBadge, Popover, Tooltip, RouterLink, TranslatePipe, NotificationItem],
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationBell implements OnInit {
  private readonly router = inject(Router);
  protected readonly store = inject(NotificationStore);
  private readonly popover = viewChild.required<Popover>('op');

  /** Badge label, capped at 99+; empty while there is nothing unread. */
  protected readonly badgeValue = computed(() => {
    const count = this.store.unreadCount();
    if (count <= 0) return '';
    return count > 99 ? '99+' : String(count);
  });

  ngOnInit(): void {
    this.store.startPolling();
  }

  protected toggle(event: Event): void {
    this.popover().toggle(event);
  }

  protected onShow(): void {
    this.store.refreshRecent();
  }

  protected onItemClick(notification: NotificationDTO): void {
    this.store.markRead(notification.id);
    this.popover().hide();
    const route = presentationFor(notification.type).route;
    if (route) void this.router.navigateByUrl(route);
  }

  protected markAll(): void {
    this.store.markAllRead();
  }
}
