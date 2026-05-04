import { Component, DestroyRef, inject, OnInit, output, signal } from '@angular/core';
import { filter } from 'rxjs';
import { NavigationEnd, Router } from '@angular/router';
import { Role } from '../../core/dtos/role';
import { NgClass } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SidebarElement } from './navbar-elements/sidebar-element/sidebar-element';
import { SidebarMultiElements } from './navbar-elements/sidebar-multi-elements/sidebar-multi-elements';
import { Links } from './navbar-elements/dtos';
import { Title } from '@angular/platform-browser';
import { LanguageSelector } from '../../shared/components/language-selector/language-selector';
import Keycloak from 'keycloak-js';
import { UserContextService } from '../../core/services/authorization/authorization.service';
import { Tooltip } from 'primeng/tooltip';

interface RouteActiveState {
  keys: boolean;
  members: boolean;
  meters: boolean;
  sharing_operations: boolean;
  communities_users: boolean;
  communities_managers: boolean;
  communities_public: boolean;
  communities_info: boolean;
  users_communities: boolean;
  users_invitations: boolean;
  users: boolean;
}

/** Map each state key to its actual route prefix. Ordered longest-first for correct matching. */
const ROUTE_MAP: [keyof RouteActiveState, string][] = [
  ['sharing_operations', '/sharing_operations'],
  ['communities_managers', '/communities/managers'],
  ['communities_public', '/communities/public'],
  ['communities_users', '/communities/users'],
  ['communities_info', '/communities/info'],
  ['users_communities', '/users/communities'],
  ['users_invitations', '/users/invitations'],
  ['members', '/members'],
  ['meters', '/meters'],
  ['keys', '/keys'],
  ['users', '/users'],
];

@Component({
  selector: 'app-navbar',
  imports: [
    NgClass,
    TranslatePipe,
    SidebarElement,
    SidebarMultiElements,
    LanguageSelector,
    Tooltip,
  ],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar implements OnInit {
  private router = inject(Router);
  protected userContextService = inject(UserContextService);
  private titleService = inject(Title);
  private translateService = inject(TranslateService);
  private readonly keycloak = inject(Keycloak);
  private destroyRef = inject(DestroyRef);

  readonly sidebarPinChanged = output<boolean>();

  readonly sidebarOpen = signal(false);
  readonly mobile = signal(false);
  readonly visibleSideBar = signal(true);
  readonly activeSublist = signal<string | null>(null);
  readonly pinned = signal(false);
  readonly isRouteActive = signal<RouteActiveState>({
    keys: false,
    members: false,
    meters: false,
    sharing_operations: false,
    communities_users: false,
    communities_managers: false,
    communities_public: false,
    communities_info: false,
    users_communities: false,
    users_invitations: false,
    users: false,
  });

  private hoverTimeout: ReturnType<typeof setTimeout> | null = null;

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
  }

  ngOnInit(): void {
    const mq = window.matchMedia('(max-width: 1023px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      this.mobile.set(e.matches);
      this.visibleSideBar.set(!e.matches);
      this.sidebarOpen.set(e.matches ? false : this.pinned());
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
          keys: false,
          members: false,
          meters: false,
          sharing_operations: false,
          communities_users: false,
          communities_managers: false,
          communities_public: false,
          communities_info: false,
          users_communities: false,
          users_invitations: false,
          users: false,
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
    if (this.mobile() || this.pinned()) return;
    this.hoverTimeout = setTimeout(() => {
      this.sidebarOpen.set(true);
    }, 120);
  }

  onMouseLeave(): void {
    if (this.mobile() || this.pinned()) return;
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
    this.sidebarOpen.set(false);
    this.activeSublist.set(null);
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
