import { Component, input, output } from '@angular/core';
import { Links } from '../dtos';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Tooltip } from 'primeng/tooltip';

@Component({
  selector: 'li[appSidebarMultiItems]',
  imports: [RouterLink, TranslatePipe, Tooltip],
  templateUrl: './sidebar-multi-elements.html',
  styleUrl: './sidebar-multi-elements.css',
})
export class SidebarMultiElements {
  readonly name = input.required<string>();
  readonly icon = input.required<string>();
  readonly sidebarOpen = input.required<boolean>();
  readonly isRouteActive = input.required<boolean>();
  readonly links = input.required<Links[]>();
  readonly activeSublist = input.required<boolean>();
  readonly sidebarClose = output<void>();

  closeSideBar(): void {
    this.sidebarClose.emit();
  }
}
