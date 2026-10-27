import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  OnInit,
  output,
  signal,
  untracked,
} from '@angular/core';
import { filter } from 'rxjs';
import { NavigationEnd, Router } from '@angular/router';
import { Role } from '../../core/dtos/role';
import { NgClass } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SidebarElement } from './navbar-elements/sidebar-element/sidebar-element';
import { SidebarMultiElements } from './navbar-elements/sidebar-multi-elements/sidebar-multi-elements';
import { SidebarSection } from './navbar-elements/sidebar-section/sidebar-section';
import { Links } from './navbar-elements/dtos';
import { Title } from '@angular/platform-browser';
import { LanguageSelector } from '../../shared/components/language-selector/language-selector';
import Keycloak from 'keycloak-js';
import { UserContextService } from '../../core/services/authorization/authorization.service';
import { CommunityServicesStore } from '../../core/services/community-services.store';
import { Tooltip } from 'primeng/tooltip';
import { OverlayBadge } from 'primeng/overlaybadge';
import { NotificationBell } from '../../features/notifications/components/notification-bell/notification-bell';
import { NotificationStore } from '../../features/notifications/services/notification.store';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { SteppyTours } from '@steppy/angular';
import {
  HelpDialog,
  HelpDialogResult,
} from '../../features/guided_tours/components/help-dialog/help-dialog';
import { SnackbarNotification } from '../../shared/services-ui/snackbar.notifcation.service';
import { ERROR_TYPE } from '../../core/dtos/notification';

interface RouteActiveState {
  dashboard: boolean;
  keys: boolean;
  members: boolean;
  meters: boolean;
  sharing_operations: boolean;
  audit_logs: boolean;
  communities_users: boolean;
  communities_managers: boolean;
  communities_public: boolean;
  communities_info: boolean;
  annexes_services: boolean;
  news: boolean;
  billing: boolean;
  live_data: boolean;
  administrative_document: boolean;
  users_communities: boolean;
  users_invitations: boolean;
  users: boolean;
  home: boolean;
}

/** Map each state key to its actual route prefix. Ordered longest-first for correct matching. */
const ROUTE_MAP: [keyof RouteActiveState, string][] = [
  ['dashboard', '/dashboard'],
  ['sharing_operations', '/sharing_operations'],
  ['communities_managers', '/communities/managers'],
  ['communities_public', '/communities/public'],
  ['communities_users', '/communities/users'],
  ['communities_info', '/communities/info'],
  ['annexes_services', '/annexes-services'],
  ['administrative_document', '/administrative-document'],
  ['news', '/news'],
  ['billing', '/billing'],
  ['live_data', '/live-data'],
  ['users_communities', '/users/communities'],
  ['users_invitations', '/users/invitations'],
  ['audit_logs', '/audit-logs'],
  ['members', '/members'],
  ['meters', '/meters'],
  ['keys', '/keys'],
  ['users', '/users'],
  ['home', '/home'],
];

@Component({
  selector: 'app-navbar',
  imports: [
    NgClass,
    TranslatePipe,
    SidebarElement,
    SidebarMultiElements,
    SidebarSection,
    LanguageSelector,
    Tooltip,
    OverlayBadge,
    NotificationBell,
  ],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
  providers: [DialogService],
})
export class Navbar implements OnInit {
  private router = inject(Router);
  protected userContextService = inject(UserContextService);
  protected readonly communityServicesStore = inject(CommunityServicesStore);
  private titleService = inject(Title);
  private translateService = inject(TranslateService);
  private readonly keycloak = inject(Keycloak);
  private destroyRef = inject(DestroyRef);
  protected readonly notificationStore = inject(NotificationStore);
  private readonly dialogService = inject(DialogService);
  private readonly tours = inject(SteppyTours);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly snackbar = inject(SnackbarNotification);
  private helpRef: DynamicDialogRef | null = null;

  readonly sidebarPinChanged = output<boolean>();

  /** Unread badge shown on the logo while collapsed; capped at 99+, empty when none. */
  protected readonly notificationBadge = computed(() => {
    const count = this.notificationStore.unreadCount();
    if (count <= 0) return '';
    return count > 99 ? '99+' : String(count);
  });

  readonly sidebarOpen = signal(false);
  readonly mobile = signal(false);
  readonly visibleSideBar = signal(true);
  readonly activeSublist = signal<string | null>(null);
  readonly pinned = signal(false);
  readonly isRouteActive = signal<RouteActiveState>({
    dashboard: false,
    keys: false,
    members: false,
    meters: false,
    sharing_operations: false,
    audit_logs: false,
    communities_users: false,
    communities_managers: false,
    communities_public: false,
    communities_info: false,
    annexes_services: false,
    news: false,
    billing: false,
    live_data: false,
    administrative_document: false,
    users_communities: false,
    users_invitations: false,
    users: false,
    home: false,
  });

  private hoverTimeout: ReturnType<typeof setTimeout> | null = null;
  /** Pointer currently over the <aside>; read when the notification popover closes. */
  private hovered = false;
  /** Last value of `tours.active()` seen by the effect, so it only acts on a start or an end. */
  private touring = false;

  memberLinks: Links[] = [
    { name: 'NAVBAR.HANDLE_MEMBRE', icon: 'pi pi-users', url: '/members' },
    { name: 'NAVBAR.HANDLE_METER', icon: 'pi pi-gauge', url: '/meters' },
    { name: 'NAVBAR.HANDLE_SHARING_OP', icon: 'pi pi-building', url: '/sharing_operations' },
  ];

  constructor() {
    const savedPin = localStorage.getItem('sidebar-pinned');
    if (savedPin === 'true') {
      this.pinned.set(true);
      this.sidebarOpen.set(true);
    }

    // Finishes the collapse onMouseLeave held back while the notification popover
    // was open — unless the pointer came back over the rail in the meantime.
    effect(() => {
      if (this.notificationStore.popoverOpen()) return;
      untracked(() => {
        if (!this.hovered) this.collapse();
      });
    });

    // The tour overlay takes every pointer event outside the highlighted element,
    // so the rail would get a mouseleave between steps and on the way to the
    // popover's buttons. While a tour runs, the desktop rail follows the tour
    // instead: expanded while the step shown points inside it, collapsed on the
    // other steps so it never covers the page they show (`collapse()` defers to
    // it meanwhile). Between two steps it keeps its state. It goes back to the
    // hover rules after. `active` is also true for a tour resumed after a page load.
    effect(() => {
      const active = this.tours.active();
      const step = this.tours.current();
      untracked(() => {
        const ended = this.touring && !active;
        this.touring = active;
        if (this.mobile() || this.pinned()) return;
        if (active) {
          if (this.hoverTimeout) {
            clearTimeout(this.hoverTimeout);
            this.hoverTimeout = null;
          }
          if (step) this.sidebarOpen.set(this.tourStepInRail());
        } else if (ended && !this.hovered && !this.notificationStore.popoverOpen()) {
          this.collapse();
        }
      });
    });

    this.destroyRef.onDestroy(() => this.helpRef?.destroy());
  }

  ngOnInit(): void {
    const mq = window.matchMedia('(max-width: 1023px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      this.mobile.set(e.matches);
      this.visibleSideBar.set(!e.matches);
      this.sidebarOpen.set(e.matches ? false : this.pinned() || this.tourStepInRail());
    };
    handler(mq);
    mq.addEventListener('change', handler);
    this.destroyRef.onDestroy(() => mq.removeEventListener('change', handler));

    this.updatePageTitle();
    this.translateService.onLangChange.subscribe(() => {
      this.updatePageTitle();
    });

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        const newState: RouteActiveState = {
          dashboard: false,
          keys: false,
          members: false,
          meters: false,
          sharing_operations: false,
          audit_logs: false,
          communities_users: false,
          communities_managers: false,
          communities_public: false,
          communities_info: false,
          annexes_services: false,
          news: false,
          billing: false,
          live_data: false,
          administrative_document: false,
          users_communities: false,
          users_invitations: false,
          users: false,
          home: false,
        };

        for (const [stateKey, routePrefix] of ROUTE_MAP) {
          if (this.router.url.startsWith(routePrefix)) {
            newState[stateKey] = true;
            break;
          }
        }
        this.isRouteActive.set(newState);
      });
  }

  onMouseEnter(): void {
    this.hovered = true;
    // During a tour the step shown decides (see the constructor).
    if (this.mobile() || this.pinned() || this.tours.active()) return;
    this.hoverTimeout = setTimeout(() => {
      this.sidebarOpen.set(true);
    }, 120);
  }

  onMouseLeave(): void {
    this.hovered = false;
    if (this.mobile() || this.pinned()) return;
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
    // The bell's popover is appended to <body>, so moving into it leaves the
    // <aside>. Collapsing now would display:none the bell right under its own
    // open popover; the effect in the constructor collapses once it closes.
    if (this.notificationStore.popoverOpen()) return;
    this.collapse();
  }

  private collapse(): void {
    if (this.mobile() || this.pinned()) return;
    // During a tour the step shown decides, not the pointer; the submenu stays
    // as the tour left it, for a later step inside it.
    if (this.tours.active()) {
      this.sidebarOpen.set(this.tourStepInRail());
      return;
    }
    this.sidebarOpen.set(false);
    this.activeSublist.set(null);
  }

  /**
   * A tour runs and the step it shows points at an element of the navbar, or the
   * bell's popover is open: it is appended to <body>, and collapsing would hide
   * the bell right under it (`notification-view` points at its "see all").
   */
  private tourStepInRail(): boolean {
    const step = this.tours.current();
    if (!this.tours.active() || !step) return false;
    if (this.notificationStore.popoverOpen()) return true;
    if (!step.testId) return false;
    const target = this.host.nativeElement.querySelector(`[data-testid="${step.testId}"]`);
    return target !== null;
  }

  togglePin(): void {
    const newState = !this.pinned();
    this.pinned.set(newState);
    if (newState) {
      this.sidebarOpen.set(true);
    }
    localStorage.setItem('sidebar-pinned', String(newState));
    this.sidebarPinChanged.emit(newState);
  }

  toggleSublist(sublist: string): void {
    this.activeSublist.set(this.activeSublist() === sublist ? null : sublist);
  }

  openSideBar(): void {
    this.visibleSideBar.set(true);
    this.sidebarOpen.set(true);
  }

  closeSideBar(): void {
    if (this.mobile()) {
      this.visibleSideBar.set(false);
      this.sidebarOpen.set(false);
    }
  }

  /**
   * The footer's "User guide" link opens the Help dialog on a plain click. It
   * stays the same link (same element, href and look), so nothing changes in
   * the guide's sidebar screenshots, and a ctrl-, shift- or middle-click still
   * opens the guide in a new tab.
   */
  openHelp(event: MouseEvent): void {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    if (this.helpRef) return;

    this.helpRef = this.dialogService.open(HelpDialog, {
      header: this.translateService.instant('HELP.TITLE') as string,
      modal: true,
      closable: true,
      closeOnEscape: true,
      dismissableMask: true,
      width: '40rem',
      breakpoints: { '1024px': '90vw', '640px': '100vw' },
    });
    this.helpRef?.onClose.subscribe((result?: HelpDialogResult) => {
      this.helpRef = null;
      if (result) void this.startTour(result);
    });
  }

  /** After the dialog has closed, so the tour's first step is not under it. */
  private async startTour({ tourId, params }: HelpDialogResult): Promise<void> {
    // The mobile drawer would cover the page; the tours open it themselves when a step needs it.
    this.closeSideBar();
    const started = await this.tours.start(tourId, params ? { params } : undefined);
    if (!started) {
      this.snackbar.openSnackBar(
        this.translateService.instant('HELP.TOURS.START_FAILED') as string,
        ERROR_TYPE,
      );
    }
  }

  logout(): void {
    this.userContextService.logout();
    void this.keycloak.logout({
      redirectUri: window.location.origin + '/auth',
    });
  }

  private updatePageTitle(): void {
    this.translateService.get('TITLE').subscribe((title: string) => {
      this.titleService.setTitle(title);
    });
  }

  protected readonly Role = Role;
}
