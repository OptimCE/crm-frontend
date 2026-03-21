import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, NavigationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import Keycloak from 'keycloak-js';
import { MessageService } from 'primeng/api';

import { App } from './app';
import { UserContextService } from './core/services/authorization/authorization.service';
import { EventBusService } from './core/services/event_bus/eventbus.service';
import { Navbar } from './layout/navbar/navbar';
import { Toast } from 'primeng/toast';
import { VALIDATION_TYPE, ERROR_TYPE } from './core/dtos/notification';

// ── Stubs ──────────────────────────────────────────────────────────

@Component({ selector: 'app-navbar', standalone: true, template: '' })
class NavbarStub {}

@Component({ selector: 'app-toast-stub', standalone: true, template: '' })
class ToastStub {}

// ── Test Suite ─────────────────────────────────────────────────────

describe('App', () => {
  let component: App;
  let fixture: ComponentFixture<App>;

  let routerEvents$: Subject<NavigationEnd>;
  let keycloakMock: { authenticated: boolean };
  let ctxMock: { refreshUserContext: ReturnType<typeof vi.fn> };
  let eventBusMock: {
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    emit: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: { add: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    routerEvents$ = new Subject<NavigationEnd>();
    keycloakMock = { authenticated: false };
    ctxMock = { refreshUserContext: vi.fn() };
    eventBusMock = { on: vi.fn(), off: vi.fn(), emit: vi.fn() };
    messageServiceMock = { add: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: Router, useValue: { events: routerEvents$.asObservable() } },
        { provide: Keycloak, useValue: keycloakMock },
        { provide: UserContextService, useValue: ctxMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: MessageService, useValue: messageServiceMock },
      ],
    })
      .overrideComponent(App, {
        remove: { imports: [Navbar, Toast], providers: [MessageService] },
        add: {
          imports: [NavbarStub, ToastStub],
          schemas: [NO_ERRORS_SCHEMA],
          providers: [{ provide: MessageService, useValue: messageServiceMock }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(App);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. Creation ─────────────────────────────────────────────────

  it('should create the app', () => {
    expect(component).toBeTruthy();
  });

  // ── 2. Default state ────────────────────────────────────────────

  describe('defaults', () => {
    it('should have showNavbar set to true', () => {
      expect(component.showNavbar).toBe(true);
    });

    it('should have sidebarPinned set to false', () => {
      expect(component.sidebarPinned).toBe(false);
    });
  });

  // ── 3. Router subscription (showNavbar) ─────────────────────────

  describe('router navigation', () => {
    it('should hide navbar when navigating to /auth route', () => {
      fixture.detectChanges(); // triggers ngOnInit
      routerEvents$.next(new NavigationEnd(1, '/auth', '/auth'));
      expect(component.showNavbar).toBe(false);
    });

    it('should show navbar when navigating to a non-auth route', () => {
      fixture.detectChanges();
      routerEvents$.next(new NavigationEnd(1, '/members', '/members'));
      expect(component.showNavbar).toBe(true);
    });

    it('should hide navbar for nested auth paths', () => {
      fixture.detectChanges();
      routerEvents$.next(new NavigationEnd(1, '/auth/login', '/auth/login'));
      expect(component.showNavbar).toBe(false);
    });
  });

  // ── 4. Keycloak authentication ──────────────────────────────────

  describe('keycloak auth check', () => {
    it('should call refreshUserContext when keycloak is authenticated', () => {
      keycloakMock.authenticated = true;
      fixture.detectChanges();
      expect(ctxMock.refreshUserContext).toHaveBeenCalled();
    });

    it('should NOT call refreshUserContext when keycloak is not authenticated', () => {
      keycloakMock.authenticated = false;
      fixture.detectChanges();
      expect(ctxMock.refreshUserContext).not.toHaveBeenCalled();
    });
  });

  // ── 5. EventBus listener ────────────────────────────────────────

  describe('event bus', () => {
    it('should register snack-notification listener on init', () => {
      fixture.detectChanges();
      expect(eventBusMock.on).toHaveBeenCalledWith('snack-notification', expect.any(Function));
    });

    it('should unregister snack-notification listener on destroy', () => {
      fixture.detectChanges();
      fixture.destroy();
      expect(eventBusMock.off).toHaveBeenCalledWith('snack-notification', expect.any(Function));
    });

    it('should use the same callback reference for on and off', () => {
      fixture.detectChanges();
      const onCallback = eventBusMock.on.mock.calls[0][1] as unknown;
      fixture.destroy();
      const offCallback = eventBusMock.off.mock.calls[0][1] as unknown;
      expect(onCallback).toBe(offCallback);
    });
  });

  // ── 6. Snack notification handler ───────────────────────────────

  describe('onSnackNotification', () => {
    let handler: (event: CustomEvent) => void;

    beforeEach(() => {
      fixture.detectChanges();
      handler = eventBusMock.on.mock.calls[0][1] as (event: CustomEvent) => void;
    });

    it('should add success toast for VALIDATION_TYPE', () => {
      handler(
        new CustomEvent('snack-notification', {
          detail: { type: VALIDATION_TYPE, message: 'Saved!' },
        }),
      );

      expect(messageServiceMock.add).toHaveBeenCalledWith({
        key: 'br',
        severity: 'success',
        icon: 'pi pi-check-circle',
        summary: 'Saved!',
        life: 3000,
      });
    });

    it('should add error toast for ERROR_TYPE', () => {
      handler(
        new CustomEvent('snack-notification', {
          detail: { type: ERROR_TYPE, message: 'Something failed' },
        }),
      );

      expect(messageServiceMock.add).toHaveBeenCalledWith({
        key: 'br',
        severity: 'error',
        icon: 'pi pi-times-circle',
        summary: 'Something failed',
        life: 3000,
      });
    });
  });

  // ── 7. Template rendering ───────────────────────────────────────

  describe('template', () => {
    it('should render navbar when showNavbar is true', () => {
      component.showNavbar = true;
      fixture.detectChanges();
      const navbar = (fixture.nativeElement as HTMLElement).querySelector('app-navbar');
      expect(navbar).toBeTruthy();
    });

    it('should render app-content-auth when showNavbar is false', () => {
      component.showNavbar = false;
      fixture.detectChanges();
      const authContent = (fixture.nativeElement as HTMLElement).querySelector('.app-content-auth');
      expect(authContent).toBeTruthy();
    });

    it('should not render navbar when showNavbar is false', () => {
      component.showNavbar = false;
      fixture.detectChanges();
      const navbar = (fixture.nativeElement as HTMLElement).querySelector('app-navbar');
      expect(navbar).toBeFalsy();
    });

    it('should render p-toast element', () => {
      fixture.detectChanges();
      const toast = (fixture.nativeElement as HTMLElement).querySelector('p-toast');
      expect(toast).toBeTruthy();
    });
  });
});
