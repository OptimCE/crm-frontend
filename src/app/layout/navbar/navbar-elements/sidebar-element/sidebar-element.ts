import { Component, input, output } from '@angular/core';
import { Ripple } from 'primeng/ripple';
import { RouterLink } from '@angular/router';
import { Tooltip } from 'primeng/tooltip';

@Component({
  selector: 'li[appSidebarItem]',
  imports: [Ripple, RouterLink, Tooltip],
  templateUrl: './sidebar-element.html',
  styleUrl: './sidebar-element.css',
})
export class SidebarElement {
  readonly sidebarOpen = input.required<boolean>();
  readonly isRouteActive = input.required<boolean>();
  readonly name = input.required<string>();
  readonly icon = input.required<string>();
  readonly routerLinkUrl = input.required<string>();
  readonly sidebarClose = output<void>();

  closeSideBar(): void {
    this.sidebarClose.emit();
  }
}
