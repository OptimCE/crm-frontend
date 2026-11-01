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
  /** A count to show on the entry (« 3 », « 99+ »); nothing when null or empty. */
  readonly badge = input<string | null>(null);
  /** `danger` when something is late, `info` otherwise. */
  readonly badgeSeverity = input<'info' | 'danger'>('info');
  /** What the badge counts, for the tooltip and screen readers. */
  readonly badgeTitle = input<string | null>(null);
  readonly sidebarClose = output<void>();

  closeSideBar(): void {
    this.sidebarClose.emit();
  }
}
