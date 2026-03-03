// shared/event-bus.service.ts
import { Injectable } from '@angular/core';
export interface SnackNotificationEvent<T> {
  type: number;
  message: T;
}
@Injectable({
  providedIn: 'root',
})
export class EventBusService {
  emit<T>(eventName: string, payload: T): void {
    window.dispatchEvent(new CustomEvent<T>(eventName, { detail: payload }));
  }

  on<T>(eventName: string, callback: (event: CustomEvent<T>) => void): void {
    window.addEventListener(eventName, callback as EventListener);
  }

  off<T>(eventName: string, callback: (event: CustomEvent<T>) => void): void {
    window.removeEventListener(eventName, callback as EventListener);
  }
}
