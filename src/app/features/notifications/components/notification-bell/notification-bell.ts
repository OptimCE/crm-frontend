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
import { routeFor } from '../../services/notification-type.registry';
import { canNavigate } from '../../services/notification-navigation';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { CommunityServicesStore } from '../../../../core/services/community-services.store';
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
  private readonly userContext = inject(UserContextService);
  private readonly services = inject(CommunityServicesStore);
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
    // Let the store know the slice is on screen, so a realtime event refetches
    // the list too instead of only the badge count.
    this.store.popoverOpen.set(true);
    this.store.refreshRecent();
  }

  protected onHide(): void {
    this.store.popoverOpen.set(false);
  }

  /**
   * Mark read always; navigate only when the destination is actually reachable.
   *
   * Otherwise the row is marked read and the user is bounced to `/users` with no
   * explanation — the notification they clicked simply disappears. See
   * `canNavigate` for the two ways that happens.
   */
  protected onItemClick(notification: NotificationDTO): void {
    this.store.markRead(notification.id);
    this.popover().hide();

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

  protected markAll(): void {
    this.store.markAllRead();
  }
}
