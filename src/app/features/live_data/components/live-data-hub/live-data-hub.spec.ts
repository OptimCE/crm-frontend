import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateModule, TranslatePipe } from '@ngx-translate/core';
import { Message } from 'primeng/message';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { INFO_TYPE } from '../../../../core/dtos/notification';
import { Role } from '../../../../core/dtos/role';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { CommunityServicesStore } from '../../../../core/services/community-services.store';
import { HeaderPage } from '../../../../layout/header-page/header-page';
import { LiveDataService } from '../../../../shared/services/live-data.service';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { LiveDataHub } from './live-data-hub';

// Lightweight stand-ins so the hub's own structure can be tested without
// pulling four screens' worth of HTTP into the fixture. Each records its own
// construction: a screen's requests start in its constructor and `ngOnInit`, so
// "which screens exist" is "which requests were issued".
let created: string[] = [];

@Component({ selector: 'app-live-dashboard', standalone: true, template: '' })
class StubDashboard {
  constructor() {
    created.push('dashboard');
  }
}
@Component({ selector: 'app-live-devices', standalone: true, template: '' })
class StubDevices {
  constructor() {
    created.push('devices');
  }
}
@Component({ selector: 'app-live-ops', standalone: true, template: '' })
class StubOps {
  constructor() {
    created.push('ops');
  }
}
@Component({ selector: 'app-live-settings', standalone: true, template: '' })
class StubSettings {
  constructor() {
    created.push('settings');
  }
}
@Component({ selector: 'app-live-member-view', standalone: true, template: '' })
class StubMemberView {
  constructor() {
    created.push('member-view');
  }
}

/** Who is looking: a manager unless a test says otherwise. */
let isManager = true;

describe('LiveDataHub', () => {
  // The hub reacts to `subscriptionLost$`; everything it then touches is a spy,
  // so a switch-off can be driven by hand and the reaction read back.
  let lost$: Subject<void>;
  let storeSpy: { reload: ReturnType<typeof vi.fn> };
  let routerSpy: { navigateByUrl: ReturnType<typeof vi.fn> };
  let snackbarSpy: { openSnackBar: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    created = [];
    isManager = true;
    lost$ = new Subject<void>();
    storeSpy = { reload: vi.fn(() => of([])) };
    routerSpy = { navigateByUrl: vi.fn().mockResolvedValue(true) };
    snackbarSpy = { openSnackBar: vi.fn() };
  });

  function render(): ComponentFixture<LiveDataHub> {
    TestBed.configureTestingModule({
      imports: [LiveDataHub, TranslateModule.forRoot()],
      providers: [
        { provide: LiveDataService, useValue: { subscriptionLost$: lost$.asObservable() } },
        { provide: CommunityServicesStore, useValue: storeSpy },
        { provide: Router, useValue: routerSpy },
        { provide: SnackbarNotification, useValue: snackbarSpy },
        {
          provide: UserContextService,
          useValue: {
            compareWithActiveRole: (role: Role) => (role === Role.GESTIONNAIRE ? isManager : true),
          },
        },
      ],
    });
    // `set` REPLACES the whole imports array, so the real chrome has to be
    // listed back: without `Tabs`/`Message`/`TranslatePipe` the template renders
    // nothing and every assertion below fails for the wrong reason. Only the
    // four screens are swapped for stubs.
    TestBed.overrideComponent(LiveDataHub, {
      set: {
        imports: [
          TranslatePipe,
          Tabs,
          TabList,
          TabPanels,
          TabPanel,
          Tab,
          Message,
          HeaderPage,
          StubDashboard,
          StubDevices,
          StubOps,
          StubSettings,
          StubMemberView,
        ],
      },
    });
    const fixture = TestBed.createComponent(LiveDataHub);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the indicative notice on the hub, not per screen', () => {
    // Stamped once, where no tab can be added without it. Plan section 2: live
    // data is indicative, and the grid operator's figures remain the only basis
    // for allocation keys and invoicing.
    const el = render().nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="live-data-hub__indicative"]')).not.toBeNull();
  });

  it('offers exactly the four screens', () => {
    const el = render().nativeElement as HTMLElement;
    for (const tab of ['dashboard', 'devices', 'ops', 'settings']) {
      expect(
        el.querySelector(`[data-testid="live-data-hub__tab--${tab}"]`),
        `the ${tab} tab is missing`,
      ).not.toBeNull();
    }
  });

  it('opens on the dashboard', () => {
    const fixture = render();
    expect(fixture.componentInstance.activeTab()).toBe(0);
  });

  it('builds only the dashboard on arrival', () => {
    // BUG: all four screens were built - and fetched - when the hub opened, six
    // requests instead of three plus a second 60 s poller. `p-tabpanel`'s `lazy`
    // defaults to false, and even with it on, CONTENT PROJECTED as children is
    // created regardless; only an `<ng-template #content>` is deferred.
    render();
    expect(created).toEqual(['dashboard']);
  });

  it('builds a screen the first time its tab is opened, and keeps it', () => {
    const fixture = render();
    const el = fixture.nativeElement as HTMLElement;
    const open = (tab: string): void => {
      (el.querySelector(`[data-testid="live-data-hub__tab--${tab}"]`) as HTMLElement).click();
      fixture.detectChanges();
    };

    open('ops');
    expect(created).toEqual(['dashboard', 'ops']);

    // Kept, not rebuilt: going back and forth re-issues nothing.
    open('dashboard');
    open('ops');
    expect(created).toEqual(['dashboard', 'ops']);
  });

  describe('the member branch (D-14)', () => {
    it('gives a manager the four tabs and never the member view', () => {
      const el = render().nativeElement as HTMLElement;
      expect(el.querySelector('[data-testid="live-data-hub__tabs"]')).not.toBeNull();
      expect(el.querySelector('[data-testid="live-data-hub__member-view"]')).toBeNull();
      expect(created).not.toContain('member-view');
    });

    it('gives a member their own view INSTEAD of the tabs', () => {
      // Not alongside them: no manager screen may even be constructed, because
      // a screen's requests start in its constructor - and the community reads
      // they would issue are refused to a member anyway.
      isManager = false;
      const el = render().nativeElement as HTMLElement;
      expect(el.querySelector('[data-testid="live-data-hub__member-view"]')).not.toBeNull();
      expect(el.querySelector('[data-testid="live-data-hub__tabs"]')).toBeNull();
      expect(created).toEqual(['member-view']);
    });

    it('still stamps the indicative notice for a member', () => {
      isManager = false;
      const el = render().nativeElement as HTMLElement;
      expect(el.querySelector('[data-testid="live-data-hub__indicative"]')).not.toBeNull();
    });
  });

  describe('live data switched off mid-session', () => {
    it('leaves for the home page when live data is deactivated mid-session', () => {
      render();
      lost$.next();

      // The loader-less TranslateModule answers the key itself.
      expect(snackbarSpy.openSnackBar).toHaveBeenCalledWith(
        'LIVE_DATA.SUBSCRIPTION_LOST',
        INFO_TYPE,
      );
      expect(storeSpy.reload).toHaveBeenCalledTimes(1);
      // `replaceUrl`: Back must not return to a page that would only bounce.
      expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/', { replaceUrl: true });
      // Toast, then reload, then navigate — the reload has to be issued before
      // the navigation destroys the component.
      const [toastAt] = snackbarSpy.openSnackBar.mock.invocationCallOrder;
      const [reloadAt] = storeSpy.reload.mock.invocationCallOrder;
      const [navigateAt] = routerSpy.navigateByUrl.mock.invocationCallOrder;
      expect(toastAt).toBeLessThan(reloadAt);
      expect(reloadAt).toBeLessThan(navigateAt);
    });

    it('reacts once however many calls were refused together', () => {
      // The dashboard's first load fires summary, series and forecast at once,
      // so one switch-off arrives as three refusals.
      render();
      lost$.next();
      lost$.next();
      lost$.next();

      expect(snackbarSpy.openSnackBar).toHaveBeenCalledTimes(1);
      expect(storeSpy.reload).toHaveBeenCalledTimes(1);
      expect(routerSpy.navigateByUrl).toHaveBeenCalledTimes(1);
    });

    it('does not cancel the catalog reload when it is destroyed', () => {
      // The navigation destroys the hub. Tying the reload to the hub's lifetime
      // would cancel the very request that removes the navbar link.
      const reload$ = new Subject<unknown[]>();
      storeSpy.reload.mockReturnValue(reload$);
      const fixture = render();
      lost$.next();
      fixture.destroy();

      expect(reload$.observed).toBe(true);
    });

    it('still leaves when the catalog reload fails', () => {
      storeSpy.reload.mockReturnValue(throwError(() => new Error('crm-backend down')));
      render();
      lost$.next();

      expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/', { replaceUrl: true });
    });
  });
});
