import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { TimeAgoPipe } from '../../../../shared/pipes/time-ago/time-ago-pipe';
import { NotificationDTO } from '../../dtos/notification.dto';
import { presentationFor } from '../../services/notification-type.registry';

/**
 * Presentational row for a single notification. Renders the type icon, the
 * i18n title (resolved from the notification `type`), a relative timestamp and
 * an unread accent. Like the audit log, the backend sets only the machine key
 * (`type`); this component owns the translated text via ngx-translate, with
 * `data` passed as interpolation params.
 * Emits {@link itemClick}; the parent decides what to do (mark read, navigate).
 */
@Component({
  selector: 'app-notification-item',
  imports: [TimeAgoPipe, TranslatePipe],
  templateUrl: './notification-item.html',
  styleUrl: './notification-item.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationItem {
  readonly notification = input.required<NotificationDTO>();
  readonly itemClick = output<NotificationDTO>();

  protected readonly presentation = computed(() => presentationFor(this.notification().type));
  protected readonly isUnread = computed(() => !this.notification().read_at);
  /** i18n key for the title, derived from the notification type (e.g. `NOTIFICATIONS.TYPES.document.uploaded.title`). */
  protected readonly titleKey = computed(
    () => `NOTIFICATIONS.TYPES.${this.notification().type}.title`,
  );

  protected onClick(): void {
    this.itemClick.emit(this.notification());
  }
}
