import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Links } from '../dtos';
import { NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
@Component({
  selector: 'li[appSidebarMultiItems]',
  imports: [RouterLink, NgClass, TranslatePipe],
  templateUrl: './sidebar-multi-elements.html',
  styleUrl: './sidebar-multi-elements.css',
})
export class SidebarMultiElements {
  @Input() name!: string;
  @Input() icon!: string;
  @Input() sidebarOpen!: boolean;
  @Input() isRouteActive!: boolean;
  @Input() links!: Links[];
  @Input() activeSublist!: boolean;
  @Output() sidebarClose = new EventEmitter<void>();

  closeSideBar(): void {
    this.sidebarClose.emit();
  }
}
