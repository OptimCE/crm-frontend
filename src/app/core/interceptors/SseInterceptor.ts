import {inject, Injectable} from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TaskSSEServie } from '../services/sse/task_sse.service';
@Injectable()
export class NotificationInterceptor implements HttpInterceptor {
  private taskSSEService = inject(TaskSSEServie);

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    this.taskSSEService.startTaskSSE();

    return next.handle(req);
  }
}
