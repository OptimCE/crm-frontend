import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import {TaskSSEServie} from '../services/sse/task_sse.service';
@Injectable()
export class NotificationInterceptor implements HttpInterceptor {
  constructor(
    private router: Router,
    private taskSSEService: TaskSSEServie,
  ) {}
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    this.taskSSEService.startTaskSSE();

    return next.handle(req);
  }
}
