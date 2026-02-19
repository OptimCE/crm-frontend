import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { filter } from 'rxjs';
import { NavigationEnd, Router } from '@angular/router';
import { Role } from '../../core/dtos/role';
import { DrawerModule } from 'primeng/drawer';
import { NgStyle } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Divider } from 'primeng/divider';
import { SidebarElement } from './navbar-elements/sidebar-element/sidebar-element';
import { SidebarMultiElements } from './navbar-elements/sidebar-multi-elements/sidebar-multi-elements';
import { Links } from './navbar-elements/dtos';
import { Title } from '@angular/platform-browser';
import { LanguageSelector } from '../../shared/components/language-selector/language-selector';
import Keycloak from 'keycloak-js';
import { UserContextService } from '../../core/services/authorization/authorization.service';

@Component({
  selector: 'app-navbar',
  imports: [
    DrawerModule,
    NgStyle,
    TranslatePipe,
    Divider,
    SidebarElement,
    SidebarMultiElements,
    LanguageSelector,
  ],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar implements OnInit {
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  protected userContextService = inject(UserContextService);
  private titleService = inject(Title);
  private translateService = inject(TranslateService);
  private readonly keycloak = inject(Keycloak);
  title = 'front-end-orchestrator';
  isExpanded: boolean[] = [false];
  showSubmenu: boolean[] = [false];
  sidebarWidth = '70px';
  sidebarOpen: boolean = false;
  activeSublist: string | null = null;
  previousSublist: string | null = null;
  isRouteActive = {
    key: false,
    members: false,
    communities: false,
    communities_users: false,
    user_invitations: false,
    user: false,
  };
  mobile: any;
  isAuth: any = true;
  visibleSideBar: boolean = true;

  memberLinks: Links[] = [
    {
      name: 'NAVBAR.HANDLE_MEMBRE',
      // name: "Gérer les membres",
      icon: 'pi pi-users',
      url: '/members',
    },
    {
      name: 'NAVBAR.HANDLE_METER',
      // name: "Gérer les compteurs",
      icon: 'pi pi-gauge',
      url: '/meters',
    },
    {
      name: 'NAVBAR.HANDLE_SHARING_OP',
      // name: "Opérations de partage",
      icon: 'pi pi-building',
      url: '/sharing_operations',
    },
  ];

  constructor() {
    this.sidebarOpen = false;
    this.setSidebarWidth();
  }
  ngOnInit() {
    // Set the page title based on the current language
    this.updatePageTitle();

    // Subscribe to language changes to update the title
    this.translateService.onLangChange.subscribe(() => {
      this.updatePageTitle();
    });

    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      const new_state: any = {
        key: false,
        members: false,
        communities: false,
        communities_users: false,
        user_invitations: false,
        user: false,
      };

      this.isAuth = !this.router.url.includes('auth');
      // Sort keys to prioritize more specific paths
      const keys = Object.keys(new_state).sort((a, b) => b.length - a.length);
      console.log(keys);
      for (const key of keys) {
        const tmpKey = key.replace('_', '/');
        if (this.router.url.startsWith(`/${tmpKey}`)) {
          new_state[key] = true;
          break;
        }
      }
      this.isRouteActive = new_state;
      console.log(this.isRouteActive);
    });
  }

  openSubmenu(index: number) {
    this.showSubmenu[index] = !this.showSubmenu[index];
    this.isExpanded[index] = !this.isExpanded[index];
  }

  logout() {
    this.userContextService.logout();
    this.keycloak.logout({
      redirectUri: window.location.origin + '/auth',
    });
  }
  onMouseEnter(_$event: MouseEvent) {
    this.sidebarOpen = true;
    this.setSidebarWidth();
  }

  onMouseLeave(_$event: MouseEvent) {
    this.sidebarOpen = false;
    this.setSidebarWidth();
  }

  setSidebarWidth() {
    this.sidebarWidth = this.sidebarOpen ? '300px' : '70px';
  }
  toggleSublist(sublist: string): void {
    if (this.activeSublist === sublist) {
      this.previousSublist = this.activeSublist;
      this.activeSublist = null;
    } else {
      this.previousSublist = this.activeSublist;
      this.activeSublist = sublist;
    }
    this.cdr.detectChanges();
  }

  openSideBar() {
    this.visibleSideBar = true;
    this.sidebarOpen = true;
  }

  closeSideBar() {
    if (this.mobile) {
      this.visibleSideBar = false;
      this.sidebarOpen = false;
    }
  }

  protected readonly GESTIONNAIRE = Role.GESTIONNAIRE;
  protected readonly MEMBER = Role.MEMBER;

  /**
   * Updates the page title based on the current language
   */
  private updatePageTitle(): void {
    this.translateService.get('TITLE').subscribe((title: string) => {
      this.titleService.setTitle(title);
    });
  }

  protected readonly Role = Role;
}
