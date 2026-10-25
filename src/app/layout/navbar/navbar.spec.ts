import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Subject, of } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import Keycloak from 'keycloak-js';

import { Navbar } from './navbar';
import { UserContextService } from '../../core/services/authorization/authorization.service';
import { NotificationStore } from '../../features/notifications/services/notification.store';
import { DialogService } from 'primeng/dynamicdialog';
import { SteppyTours } from '@steppy/angular';
import { HelpDialog } from '../../features/guided_tours/components/help-dialog/help-dialog';
import { SnackbarNotification } from '../../shared/services-ui/snackbar.notifcation.service';
import { ERROR_TYPE } from '../../core/dtos/notification';

describe('Navbar', () => {
  let component: Navbar;
  let fixture: ComponentFixture<Navbar>;

  let routerEvents$: Subject<NavigationEnd>;

  let userContextServiceSpy: {
    activeCommunityId: ReturnType<typeof signal<string | null>>;
    compareWithActiveRole: ReturnType<typeof vi.fn>;
    isActiveRole: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };
  let keycloakSpy: { logout: ReturnType<typeof vi.fn> };
  let titleSpy: { setTitle: ReturnType<typeof vi.fn> };
  let routerSpy: { events: Subject<NavigationEnd>; url: string };
  let helpClose$: Subject<unknown>;
  let dialogServiceSpy: { open: ReturnType<typeof vi.fn> };
  let toursSpy: { start: ReturnType<typeof vi.fn> };
  let snackbarSpy: { openSnackBar: ReturnType<typeof vi.fn> };

  const mockMatchMedia = (matches: boolean) => {
    const listeners: ((e: MediaQueryListEvent) => void)[] = [];
    const mql = {
      matches,
      media: '(max-width: 1023px)',
      addEventListener: vi.fn((_: string, cb: (e: MediaQueryListEvent) => void) =>
        listeners.push(cb),
      ),
      removeEventListener: vi.fn(),
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList;

    window.matchMedia = vi.fn().mockReturnValue(mql);
    return { mql, listeners };
  };

  const setupTestBed = async (localStoragePinValue: string | null = null) => {
    routerEvents$ = new Subject<NavigationEnd>();

    userContextServiceSpy = {
      activeCommunityId: signal<string | null>(null),
      compareWithActiveRole: vi.fn().mockReturnValue(false),
      isActiveRole: vi.fn().mockReturnValue(false),
      logout: vi.fn(),
    };

    keycloakSpy = { logout: vi.fn().mockResolvedValue(undefined) };
    titleSpy = { setTitle: vi.fn() };
    routerSpy = { events: routerEvents$, url: '/' };
    helpClose$ = new Subject<unknown>();
    dialogServiceSpy = {
      open: vi.fn().mockReturnValue({ onClose: helpClose$.asObservable(), destroy: vi.fn() }),
    };
    toursSpy = { start: vi.fn().mockResolvedValue(true) };
    snackbarSpy = { openSnackBar: vi.fn() };

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      if (key === 'sidebar-pinned') return localStoragePinValue;
      return null;
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => undefined);

    await TestBed.configureTestingModule({
      imports: [Navbar, TranslateModule.forRoot()],
      providers: [
        { provide: UserContextService, useValue: userContextServiceSpy },
        { provide: Keycloak, useValue: keycloakSpy },
        { provide: Title, useValue: titleSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: {} },
        { provide: DialogService, useValue: dialogServiceSpy },
        { provide: SteppyTours, useValue: toursSpy },
        { provide: SnackbarNotification, useValue: snackbarSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(Navbar, {
        set: {
          imports: [TranslateModule],
          providers: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(Navbar);
    component = fixture.componentInstance;
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Creation & Defaults', () => {
    beforeEach(async () => {
      mockMatchMedia(false);
      await setupTestBed();
      fixture.detectChanges();
    });

    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with default signal values', () => {
      expect(component.sidebarOpen()).toBe(false);
      expect(component.mobile()).toBe(false);
      expect(component.visibleSideBar()).toBe(true);
      expect(component.activeSublist()).toBeNull();
      expect(component.pinned()).toBe(false);
    });

    it('should initialize isRouteActive with all false', () => {
      const state = component.isRouteActive();
      expect(state.keys).toBe(false);
      expect(state.members).toBe(false);
      expect(state.meters).toBe(false);
      expect(state.sharing_operations).toBe(false);
      expect(state.communities_users).toBe(false);
      expect(state.communities_managers).toBe(false);
      expect(state.communities_info).toBe(false);
      expect(state.users_communities).toBe(false);
      expect(state.users_invitations).toBe(false);
      expect(state.users).toBe(false);
    });

    it('should have 3 memberLinks with correct URLs', () => {
      expect(component.memberLinks).toHaveLength(3);
      expect(component.memberLinks[0].url).toBe('/members');
      expect(component.memberLinks[1].url).toBe('/meters');
      expect(component.memberLinks[2].url).toBe('/sharing_operations');
    });
  });

  describe('Constructor — localStorage pin restore', () => {
    it('should restore pinned=true and sidebarOpen=true from localStorage', async () => {
      mockMatchMedia(false);
      await setupTestBed('true');
      fixture.detectChanges();

      expect(component.pinned()).toBe(true);
      expect(component.sidebarOpen()).toBe(true);
    });

    it('should remain unpinned when localStorage has no value', async () => {
      mockMatchMedia(false);
      await setupTestBed(null);
      fixture.detectChanges();

      expect(component.pinned()).toBe(false);
    });
  });

  describe('ngOnInit — Media Query', () => {
    it('should set mobile=true and visibleSideBar=false when matchMedia matches', async () => {
      mockMatchMedia(true);
      await setupTestBed();
      fixture.detectChanges();

      expect(component.mobile()).toBe(true);
      expect(component.visibleSideBar()).toBe(false);
      expect(component.sidebarOpen()).toBe(false);
    });

    it('should set mobile=false and sidebarOpen to pinned state on desktop', async () => {
      mockMatchMedia(false);
      await setupTestBed('true');
      fixture.detectChanges();

      expect(component.mobile()).toBe(false);
      expect(component.visibleSideBar()).toBe(true);
      expect(component.sidebarOpen()).toBe(true);
    });
  });

  describe('ngOnInit — Route Tracking', () => {
    beforeEach(async () => {
      mockMatchMedia(false);
      await setupTestBed();
      fixture.detectChanges();
    });

    const routeTests: [string, string][] = [
      ['keys', '/keys'],
      ['members', '/members'],
      ['meters', '/meters'],
      ['sharing_operations', '/sharing_operations'],
      ['communities_users', '/communities/users'],
      ['communities_managers', '/communities/managers'],
      ['communities_info', '/communities/info'],
      ['users_communities', '/users/communities'],
      ['users_invitations', '/users/invitations'],
      ['users', '/users'],
      ['home', '/home'],
    ];

    routeTests.forEach(([stateKey, routeUrl]) => {
      it(`should activate ${stateKey} for route ${routeUrl}`, () => {
        routerSpy.url = routeUrl;
        routerEvents$.next(new NavigationEnd(1, routeUrl, routeUrl));

        const state = component.isRouteActive();
        expect(state[stateKey as keyof typeof state]).toBe(true);

        // All other keys should be false
        const otherKeys = routeTests.map(([k]) => k).filter((k) => k !== stateKey);
        for (const otherKey of otherKeys) {
          expect(state[otherKey as keyof typeof state]).toBe(false);
        }
      });
    });

    it('should keep all states false for an unrecognized route', () => {
      routerSpy.url = '/unknown';
      routerEvents$.next(new NavigationEnd(1, '/unknown', '/unknown'));

      const state = component.isRouteActive();
      expect(Object.values(state).every((v) => v === false)).toBe(true);
    });
  });

  describe('ngOnInit — Page Title', () => {
    beforeEach(async () => {
      mockMatchMedia(false);
      await setupTestBed();
    });

    it('should set page title on init', () => {
      const translateService = TestBed.inject(TranslateService);
      vi.spyOn(translateService, 'get').mockReturnValue(of('OptimCE'));

      fixture.detectChanges();

      expect(titleSpy.setTitle).toHaveBeenCalledWith('OptimCE');
    });

    it('should update page title when language changes', () => {
      const translateService = TestBed.inject(TranslateService);
      vi.spyOn(translateService, 'get').mockReturnValue(of('OptimCE FR'));

      fixture.detectChanges();
      titleSpy.setTitle.mockClear();

      vi.spyOn(translateService, 'get').mockReturnValue(of('OptimCE EN'));
      translateService.use('en');

      expect(titleSpy.setTitle).toHaveBeenCalledWith('OptimCE EN');
    });
  });

  describe('Mouse Hover', () => {
    beforeEach(async () => {
      vi.useFakeTimers();
      mockMatchMedia(false);
      await setupTestBed();
      fixture.detectChanges();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should open sidebar after timeout on mouse enter', () => {
      component.onMouseEnter();
      expect(component.sidebarOpen()).toBe(false);

      vi.advanceTimersByTime(120);
      expect(component.sidebarOpen()).toBe(true);
    });

    it('should not open sidebar on mouse enter when mobile', () => {
      component['mobile'].set(true);

      component.onMouseEnter();
      vi.advanceTimersByTime(200);

      expect(component.sidebarOpen()).toBe(false);
    });

    it('should not open sidebar on mouse enter when pinned', () => {
      component['pinned'].set(true);
      component['sidebarOpen'].set(true);

      component.onMouseEnter();
      vi.advanceTimersByTime(200);

      // Should remain as-is (already open from pin)
      expect(component.sidebarOpen()).toBe(true);
    });

    it('should close sidebar and clear active sublist on mouse leave', () => {
      component['sidebarOpen'].set(true);
      component['activeSublist'].set('members');

      component.onMouseLeave();

      expect(component.sidebarOpen()).toBe(false);
      expect(component.activeSublist()).toBeNull();
    });

    it('should clear pending hover timeout on mouse leave without opening', () => {
      component.onMouseEnter();
      vi.advanceTimersByTime(50); // Not yet at 120ms

      component.onMouseLeave();
      vi.advanceTimersByTime(200); // Past the timeout

      expect(component.sidebarOpen()).toBe(false);
    });

    it('should not close sidebar on mouse leave when mobile', () => {
      component['mobile'].set(true);
      component['sidebarOpen'].set(true);

      component.onMouseLeave();

      expect(component.sidebarOpen()).toBe(true);
    });

    // The popover is appended to <body>: moving into it is a mouseleave on the
    // <aside>, and collapsing then would hide the bell under the open popover.
    describe('with the notification popover open', () => {
      let store: NotificationStore;

      beforeEach(() => {
        store = TestBed.inject(NotificationStore);
        component.onMouseEnter();
        vi.advanceTimersByTime(120);
        store.popoverOpen.set(true);
        TestBed.tick();
      });

      it('should keep the sidebar open when the pointer leaves for the popover', () => {
        component.onMouseLeave();

        expect(component.sidebarOpen()).toBe(true);
      });

      it('should collapse once the popover closes with the pointer outside the sidebar', () => {
        component['activeSublist'].set('members');
        component.onMouseLeave();

        store.popoverOpen.set(false);
        TestBed.tick();

        expect(component.sidebarOpen()).toBe(false);
        expect(component.activeSublist()).toBeNull();
      });

      it('should stay open when the popover closes with the pointer back over the sidebar', () => {
        component.onMouseLeave();
        component.onMouseEnter();

        store.popoverOpen.set(false);
        TestBed.tick();
        vi.advanceTimersByTime(200);

        expect(component.sidebarOpen()).toBe(true);
      });

      it('should not collapse a pinned sidebar when the popover closes', () => {
        component.togglePin();
        component.onMouseLeave();

        store.popoverOpen.set(false);
        TestBed.tick();

        expect(component.sidebarOpen()).toBe(true);
      });
    });
  });

  describe('Pin Toggle', () => {
    beforeEach(async () => {
      mockMatchMedia(false);
      await setupTestBed();
      fixture.detectChanges();
    });

    it('should toggle pinned state from false to true', () => {
      component.togglePin();

      expect(component.pinned()).toBe(true);
      expect(component.sidebarOpen()).toBe(true);
    });

    it('should toggle pinned state from true to false', () => {
      component['pinned'].set(true);
      component['sidebarOpen'].set(true);

      component.togglePin();

      expect(component.pinned()).toBe(false);
    });

    it('should persist pin state to localStorage', () => {
      component.togglePin();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(localStorage.setItem).toHaveBeenCalledWith('sidebar-pinned', 'true');
    });

    it('should emit sidebarPinChanged output', () => {
      const emitSpy = vi.fn();
      component.sidebarPinChanged.subscribe(emitSpy);

      component.togglePin();

      expect(emitSpy).toHaveBeenCalledWith(true);
    });
  });

  describe('Sublist Toggle', () => {
    beforeEach(async () => {
      mockMatchMedia(false);
      await setupTestBed();
      fixture.detectChanges();
    });

    it('should set activeSublist to given value', () => {
      component.toggleSublist('members');

      expect(component.activeSublist()).toBe('members');
    });

    it('should toggle activeSublist to null when called with same value', () => {
      component.toggleSublist('members');
      component.toggleSublist('members');

      expect(component.activeSublist()).toBeNull();
    });

    it('should switch activeSublist when called with different value', () => {
      component.toggleSublist('members');
      component.toggleSublist('other');

      expect(component.activeSublist()).toBe('other');
    });
  });

  describe('Sidebar Open/Close', () => {
    beforeEach(async () => {
      mockMatchMedia(false);
      await setupTestBed();
      fixture.detectChanges();
    });

    it('should open sidebar and make it visible', () => {
      component['visibleSideBar'].set(false);
      component['sidebarOpen'].set(false);

      component.openSideBar();

      expect(component.visibleSideBar()).toBe(true);
      expect(component.sidebarOpen()).toBe(true);
    });

    it('should close sidebar on mobile', () => {
      component['mobile'].set(true);
      component['visibleSideBar'].set(true);
      component['sidebarOpen'].set(true);

      component.closeSideBar();

      expect(component.visibleSideBar()).toBe(false);
      expect(component.sidebarOpen()).toBe(false);
    });

    it('should not close sidebar on desktop', () => {
      component['mobile'].set(false);
      component['visibleSideBar'].set(true);
      component['sidebarOpen'].set(true);

      component.closeSideBar();

      expect(component.visibleSideBar()).toBe(true);
      expect(component.sidebarOpen()).toBe(true);
    });
  });

  describe('User guide link', () => {
    let queryGuideLink: () => HTMLAnchorElement | null;

    beforeEach(async () => {
      mockMatchMedia(false);
      await setupTestBed();
      fixture.detectChanges();

      queryGuideLink = () =>
        (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
          '[data-testid="navbar__btn--user-guide"]',
        );
    });

    it('should render the user guide link in the footer', () => {
      expect(queryGuideLink()).toBeTruthy();
    });

    it('should point to the public user guide URL', () => {
      expect(queryGuideLink()?.getAttribute('href')).toBe('https://guide.optimce.be');
    });

    it('should open in a new tab with safe rel attributes', () => {
      const link = queryGuideLink();
      expect(link?.getAttribute('target')).toBe('_blank');
      expect(link?.getAttribute('rel')).toContain('noopener');
      expect(link?.getAttribute('rel')).toContain('noreferrer');
    });

    it('should hide the label when the sidebar is collapsed', () => {
      component['sidebarOpen'].set(false);
      fixture.detectChanges();

      expect(queryGuideLink()?.querySelector('span')).toBeNull();
    });

    it('should show the translated label when the sidebar is expanded', () => {
      component['sidebarOpen'].set(true);
      fixture.detectChanges();

      const label = queryGuideLink()?.querySelector('span');
      expect(label).toBeTruthy();
      expect(label?.textContent?.trim()).toBe('NAVBAR.USER_GUIDE');
    });
  });

  describe('Help dialog', () => {
    const click = (init: MouseEventInit = {}) =>
      new MouseEvent('click', { button: 0, cancelable: true, bubbles: true, ...init });

    beforeEach(async () => {
      mockMatchMedia(false);
      await setupTestBed();
      fixture.detectChanges();
    });

    it('should open the Help dialog on a plain click of the user guide link, instead of the guide', () => {
      const link = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
        '[data-testid="navbar__btn--user-guide"]',
      );
      const event = click();
      link?.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
      expect(dialogServiceSpy.open).toHaveBeenCalledWith(
        HelpDialog,
        expect.objectContaining({ modal: true }),
      );
    });

    it('should let a ctrl-, meta-, shift- or middle-click open the guide itself', () => {
      for (const init of [
        { ctrlKey: true },
        { metaKey: true },
        { shiftKey: true },
        { button: 1 },
      ]) {
        const event = click(init);
        component.openHelp(event);
        expect(event.defaultPrevented).toBe(false);
      }
      expect(dialogServiceSpy.open).not.toHaveBeenCalled();
    });

    it('should not open a second dialog while one is open', () => {
      component.openHelp(click());
      component.openHelp(click());

      expect(dialogServiceSpy.open).toHaveBeenCalledTimes(1);
    });

    it('should start the chosen tour, with its params, once the dialog has closed', async () => {
      component.openHelp(click());
      helpClose$.next({ tourId: 'meter-deactivate', params: { meterEan: '541448820000000001' } });
      await Promise.resolve();

      expect(toursSpy.start).toHaveBeenCalledWith('meter-deactivate', {
        params: { meterEan: '541448820000000001' },
      });
      expect(snackbarSpy.openSnackBar).not.toHaveBeenCalled();
    });

    it('should start a tour without params as is', async () => {
      component.openHelp(click());
      helpClose$.next({ tourId: 'key-update' });
      await Promise.resolve();

      expect(toursSpy.start).toHaveBeenCalledWith('key-update', undefined);
    });

    it('should close the mobile drawer before the tour starts', async () => {
      component['mobile'].set(true);
      component.openSideBar();
      component.openHelp(click());
      helpClose$.next({ tourId: 'home-overview' });
      await Promise.resolve();

      expect(component['visibleSideBar']()).toBe(false);
      expect(toursSpy.start).toHaveBeenCalled();
    });

    it('should say so when the tour cannot start', async () => {
      toursSpy.start.mockResolvedValue(false);
      component.openHelp(click());
      helpClose$.next({ tourId: 'key-update' });
      await vi.waitFor(() => expect(snackbarSpy.openSnackBar).toHaveBeenCalled());

      expect(snackbarSpy.openSnackBar).toHaveBeenCalledWith('HELP.TOURS.START_FAILED', ERROR_TYPE);
    });

    it('should start nothing when the dialog is dismissed', async () => {
      component.openHelp(click());
      helpClose$.next(undefined);
      await Promise.resolve();

      expect(toursSpy.start).not.toHaveBeenCalled();
      component.openHelp(click());
      expect(dialogServiceSpy.open).toHaveBeenCalledTimes(2);
    });
  });

  describe('Logout', () => {
    beforeEach(async () => {
      mockMatchMedia(false);
      await setupTestBed();
      fixture.detectChanges();
    });

    it('should call userContextService.logout()', () => {
      component.logout();

      expect(userContextServiceSpy.logout).toHaveBeenCalled();
    });

    it('should call keycloak.logout() with correct redirect URI', () => {
      component.logout();

      expect(keycloakSpy.logout).toHaveBeenCalledWith({
        redirectUri: window.location.origin + '/auth',
      });
    });
  });
});
