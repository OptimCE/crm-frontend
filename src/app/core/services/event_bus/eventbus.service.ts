// shared/event-bus.service.ts
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class EventBusService {
  emit(eventName: string, payload: any) {
    window.dispatchEvent(new CustomEvent(eventName, { detail: payload }));
  }

  on(eventName: string, callback: (event: any) => void) {
    window.addEventListener(eventName, callback);
  }
}
