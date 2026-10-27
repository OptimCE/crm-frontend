import { Component, NO_ERRORS_SCHEMA, output, signal } from '@angular/core';
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
import { SteppyToursComponent, TourErrorDetail } from '@steppy/angular';
import { VALIDATION_TYPE, ERROR_TYPE, INFO_TYPE } from './core/dtos/notification';
import { OnboardingCoordinator } from './features/onboarding/services/onboarding-coordinator.service';
import { OnboardingRoleBanner } from './features/onboarding/components/onboarding-role-banner/onboarding-role-banner';
import { OnboardingWelcomeDialog } from './features/onboarding/components/onboarding-welcome-dialog/onboarding-welcome-dialog';

// ── Stubs ──────────────────────────────────────────────────────────

@Component({ selector: 'app-navbar', standalone: true, template: '' })
class NavbarStub {}

@Component({ selector: 'app-toast-stub', standalone: true, template: '' })
class ToastStub {}

// eslint-disable-next-line @angular-eslint/component-selector -- must match @steppy/angular's element
@Component({ selector: 'steppy-tours', standalone: true, template: '' })
class SteppyToursStub {
  readonly tourError = output<TourErrorDetail>();
}

// ── Test Suite ─────────────────────────────────────────────────────

describe('App', () => {
  let component: App;
  let fixture: ComponentFixture<App>;

  let routerEvents$: Subject<NavigationEnd>;
  let keycloakMock: { authenticated: boolean };
  let ctxMock: { refreshUserContext: ReturnType<typeof vi.fn> };
  let onboardingMock: { offer: ReturnType<typeof signal<null>>; start: ReturnType<typeof vi.fn> };
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
    onboardingMock = { offer: signal(null), start: vi.fn() };
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
        { provide: OnboardingCoordinator, useValue: onboardingMock },
      ],
    })
      .overrideComponent(App, {
        remove: {
          imports: [
            Navbar,
            Toast,
            SteppyToursComponent,
            OnboardingRoleBanner,
            OnboardingWelcomeDialog,
          ],
          providers: [MessageService],
        },
        add: {
          imports: [NavbarStub, ToastStub, SteppyToursStub],
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

    it('should start the onboarding offers after the context refresh, signed in only', () => {
      keycloakMock.authenticated = true;
      fixture.detectChanges();
      expect(onboardingMock.start).toHaveBeenCalledTimes(1);
      expect(ctxMock.refreshUserContext.mock.invocationCallOrder[0]).toBeLessThan(
        onboardingMock.start.mock.invocationCallOrder[0],
      );
    });

    it('should not start the onboarding offers signed out', () => {
      keycloakMock.authenticated = false;
      fixture.detectChanges();
      expect(onboardingMock.start).not.toHaveBeenCalled();
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

    it('should add an info toast for INFO_TYPE', () => {
      // Two sentences (live data switched off mid-session), so it stays up
      // twice as long as a success or an error.
      handler(
        new CustomEvent('snack-notification', {
          detail: { type: INFO_TYPE, message: 'Live data has been disabled.' },
        }),
      );

      expect(messageServiceMock.add).toHaveBeenCalledWith({
        key: 'br',
        severity: 'info',
        icon: 'pi pi-info-circle',
        summary: 'Live data has been disabled.',
        life: 6000,
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

    it('should keep the same <steppy-tours> when the navbar branch switches', () => {
      // Destroying it would suspend a running tour (e.g. a step that leaves /auth).
      component.showNavbar = true;
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      const before = host.querySelectorAll('steppy-tours');
      expect(before.length).toBe(1);

      component.showNavbar = false;
      fixture.componentRef.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      const after = host.querySelectorAll('steppy-tours');
      expect(after.length).toBe(1);
      expect(after[0]).toBe(before[0]);
    });
  });

  // ── 8. Tour errors ──────────────────────────────────────────────

  describe('onTourError', () => {
    it('should log the tour, step and test-id the overlay reports', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      fixture.detectChanges();
      const detail: TourErrorDetail = {
        reason: 'target-timeout',
        fatal: false,
        message: 'the target did not appear in time',
        tourId: 'key-update',
        stepId: 'keys-list__row--desktop--1',
        testId: 'keys-list__row--mobile--1',
        kind: 'waitFor',
      };

      fixture.debugElement
        .query((el) => el.name === 'steppy-tours')
        .triggerEventHandler('tourError', detail);

      expect(warn).toHaveBeenCalledWith(
        '[tours] tour-error target-timeout: tour "key-update", step "keys-list__row--desktop--1", ' +
          'test-id "keys-list__row--mobile--1" (waitFor). the target did not appear in time',
        detail,
      );
    });

    it('should still log an error that names no step', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      fixture.detectChanges();
      const detail: TourErrorDetail = {
        reason: 'load-failed',
        fatal: true,
        message: 'HTTP 404',
        tourId: 'x',
      };

      fixture.debugElement
        .query((el) => el.name === 'steppy-tours')
        .triggerEventHandler('tourError', detail);

      expect(warn).toHaveBeenCalledWith(
        '[tours] tour-error load-failed: tour "x". HTTP 404',
        detail,
      );
    });
  });
});
