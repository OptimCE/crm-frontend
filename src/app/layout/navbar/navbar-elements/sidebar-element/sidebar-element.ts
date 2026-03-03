import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Ripple } from 'primeng/ripple';
import { RouterLink } from '@angular/router';
@Component({
  selector: 'li[appSidebarItem]',
  imports: [Ripple, RouterLink],
  templateUrl: './sidebar-element.html',
  styleUrl: './sidebar-element.css',
})
export class SidebarElement {
  @Input() sidebarOpen!: boolean;
  @Input() isRouteActive!: boolean;
  @Input() name!: string;
  @Input() icon!: string;
  @Input() routerLinkUrl!: string;
  @Output() sidebarClose = new EventEmitter<void>();

  closeSideBar(): void {
    this.sidebarClose.emit();
  }
}
