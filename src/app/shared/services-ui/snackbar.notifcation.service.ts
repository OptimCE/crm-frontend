import { inject, Injectable } from '@angular/core';
import { EventBusService } from '../../core/services/event_bus/eventbus.service';

@Injectable({
  providedIn: 'root',
})
export class SnackbarNotification {
  private eventBus = inject(EventBusService);

  openSnackBar(message: string, type: number) {
    this.eventBus.emit('snack-notification', { message: message, type: type });
  }
}
