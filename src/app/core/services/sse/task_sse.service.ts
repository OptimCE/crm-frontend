import { SSEService } from './sse.service';
import { inject, Injectable } from '@angular/core';
import { environments } from '../../../../environments/environments';
import { ERROR_TYPE, VALIDATION_TYPE } from '../../dtos/notification';
import { EventBusService } from '../event_bus/eventbus.service';
import { ApiResponse } from '../../dtos/api.response';

@Injectable({
  providedIn: 'root',
})
export class TaskSSEServie {
  connected: boolean = false;
  private sseService = inject(SSEService);
  private eventBus = inject(EventBusService);
  constructor() {
    this.connected = false;
  }

  startTaskSSE() {
    if (!this.connected) {
      this.connected = true;
      this.sseService.getServerSentEvent(environments.apiUrl + '/notification/event').subscribe({
        next: (d: any) => {
          let data = d.msg as ApiResponse<unknown>;
          if (Array.isArray(data)) {
            data = data[0];
          }
          if (data && data.data) {
            this.eventBus.emit('snack-notification', { message: data.data, type: VALIDATION_TYPE });
          }
        },
        error: (err) => {
          if (err.data) {
            this.eventBus.emit('snack-notification', { message: err.data, type: ERROR_TYPE });
          } else {
            this.eventBus.emit('snack-notification', { message: 'Error', type: ERROR_TYPE });
          }
        },
      });
    }
  }
}
