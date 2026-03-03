import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Navbar } from './layout/navbar/navbar';
import { filter } from 'rxjs';
import Keycloak from 'keycloak-js';
import { UserContextService } from './core/services/authorization/authorization.service';
import {
  EventBusService,
  SnackNotificationEvent,
} from './core/services/event_bus/eventbus.service';
import { VALIDATION_TYPE } from './core/dtos/notification';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, Toast],
  templateUrl: './app.html',
  styleUrl: './app.css',
  providers: [MessageService],
})
export class App implements OnInit, OnDestroy {
  showNavbar = true;
  private router = inject(Router);
  private keycloak = inject(Keycloak);
  private ctx = inject(UserContextService);
  private eventBus = inject(EventBusService);
  private messageService = inject(MessageService);

  private readonly onSnackNotification = (event: CustomEvent<SnackNotificationEvent<string>>) => {
    const icon =
      event.detail.type === VALIDATION_TYPE ? 'pi pi-check-circle' : 'pi pi-times-circle';
    const severity = event.detail.type === VALIDATION_TYPE ? 'success' : 'error';
    this.messageService.add({
      key: 'br',
      severity,
      icon,
      summary: event.detail.message,
      life: 3000,
    });
  };

  ngOnInit(): void {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.showNavbar = !event.urlAfterRedirects.includes('/auth');
        console.log(this.showNavbar);
      });
    if (this.keycloak.authenticated) this.ctx.refreshUserContext();
    this.eventBus.on<SnackNotificationEvent<string>>(
      'snack-notification',
      this.onSnackNotification,
    );
  }

  ngOnDestroy(): void {
    this.eventBus.off<SnackNotificationEvent<string>>(
      'snack-notification',
      this.onSnackNotification,
    );
  }
}
