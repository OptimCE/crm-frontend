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

  startTaskSSE(): void {
    if (this.connected) return;

    this.connected = true;
    this.sseService.getServerSentEvent(environments.apiUrl + '/notification/event').subscribe({
      next: (response: ApiResponse<string>) => {
        const data = Array.isArray(response) ? (response as ApiResponse<string>[])[0] : response;
        if (data?.data) {
          this.eventBus.emit('snack-notification', { message: data.data, type: VALIDATION_TYPE });
        }
      },
      error: (err: unknown) => {
        const message: string =
          err instanceof ApiResponse
            ? String((err as ApiResponse<string>).data)
            : 'Error';
        this.eventBus.emit('snack-notification', { message, type: ERROR_TYPE });
      },
    });
  }
}
